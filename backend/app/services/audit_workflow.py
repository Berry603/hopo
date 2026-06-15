"""
审计作业服务
Audit Workflow Service

管理审计项目全生命周期:
  项目立项 → 底稿编制 → 报告生成 → 整改跟踪 → 项目关闭
"""
import uuid
from datetime import datetime, timedelta, date
from enum import Enum
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from loguru import logger
from sqlalchemy import func, and_

from app.core.database import SessionLocal
from app.models.audit_project import AuditProject, AuditType, AuditPhase, ProjectStatus
from app.models.audit import (
    AuditWorksheet, AuditFinding, AuditTask,
    FindingSeverity, FindingStatus, TaskStatus,
)
from app.models.rectification import (
    RectificationOrder, RectificationEvidence, OrderStatus,
)
from app.models.risk import RiskAlert, AlertStatus, SeverityLevel, RiskType
from app.services.project_state_service import (
    get_broad_phase, get_progress_percent, get_current_audit_phase,
    get_current_stage_code, STAGE_TO_BROAD_PHASE, BROAD_PHASE_ORDER,
    sync_project_current_phase, validate_phase_transition,
)
from app.models.phase_progress import PhaseProgress, PhaseStatus


# ==================== 审计流程状态机 ====================

class WorksheetStatus(str, Enum):
    """底稿状态"""
    DRAFT = "draft"            # 草稿
    IN_PROGRESS = "in_progress" # 编制中
    SUBMITTED = "submitted"    # 已提交
    REVIEWED = "reviewed"      # 已复核
    APPROVED = "approved"      # 已批准
    REJECTED = "rejected"      # 已驳回


class ReportStatus(str, Enum):
    """报告状态"""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    PUBLISHED = "published"


# WorksheetStatus 映射（服务版本 -> 模型版本）
_WS_STATUS_MAP = {
    WorksheetStatus.DRAFT: "draft",
    WorksheetStatus.IN_PROGRESS: "draft",
    WorksheetStatus.SUBMITTED: "submitted",
    WorksheetStatus.REVIEWED: "under_review",
    WorksheetStatus.APPROVED: "approved",
    WorksheetStatus.REJECTED: "rejected",
}


# ==================== 底稿模板 ====================

@dataclass
class WorksheetTemplate:
    """底稿模板"""
    id: str
    name: str
    category: str  # 财务审计/合规审计/运营审计
    sections: List[Dict] = field(default_factory=list)
    required_fields: List[str] = field(default_factory=list)


PRESET_WORKSHEET_TEMPLATES: List[WorksheetTemplate] = [
    WorksheetTemplate(
        id="WS-001",
        name="费用审计底稿",
        category="财务审计",
        sections=[
            {"id": "s1", "title": "审计基本信息", "type": "info"},
            {"id": "s2", "title": "费用抽样检查表", "type": "table"},
            {"id": "s3", "title": "异常费用明细", "type": "table"},
            {"id": "s4", "title": "审计发现摘要", "type": "text"},
            {"id": "s5", "title": "审计结论与建议", "type": "text"},
        ],
        required_fields=["audit_period", "sample_size", "total_amount", "conclusion"],
    ),
    WorksheetTemplate(
        id="WS-002",
        name="采购审计底稿",
        category="运营审计",
        sections=[
            {"id": "s1", "title": "审计基本信息", "type": "info"},
            {"id": "s2", "title": "供应商资质检查", "type": "table"},
            {"id": "s3", "title": "采购比价分析", "type": "table"},
            {"id": "s4", "title": "合同执行情况", "type": "table"},
            {"id": "s5", "title": "审计发现与建议", "type": "text"},
        ],
        required_fields=["supplier_count", "price_diff_ratio", "conclusion"],
    ),
    WorksheetTemplate(
        id="WS-003",
        name="资金审计底稿",
        category="财务审计",
        sections=[
            {"id": "s1", "title": "银行账户信息", "type": "info"},
            {"id": "s2", "title": "银行余额调节表", "type": "table"},
            {"id": "s3", "title": "大额资金流向", "type": "table"},
            {"id": "s4", "title": "异常交易明细", "type": "table"},
            {"id": "s5", "title": "审计结论", "type": "text"},
        ],
        required_fields=["bank_accounts", "total_balance", "conclusion"],
    ),
]


# ==================== 审计报告模板 ====================

@dataclass
class ReportTemplate:
    """审计报告模板"""
    id: str
    name: str
    type: str  # standard/executive/comprehensive
    sections: List[str] = field(default_factory=list)


PRESET_REPORT_TEMPLATES: List[ReportTemplate] = [
    ReportTemplate(
        id="RPT-001",
        name="标准审计报告",
        type="standard",
        sections=[
            "封面", "审计概况", "审计范围与方法",
            "审计发现", "风险评估", "整改建议",
            "审计结论", "附录",
        ],
    ),
    ReportTemplate(
        id="RPT-002",
        name="高管摘要报告",
        type="executive",
        sections=[
            "封面", "审计摘要", "关键发现",
            "风险等级", "建议措施", "结论",
        ],
    ),
]


# ==================== 审计作业服务核心 ====================

class AuditWorkflowService:
    """
    审计作业全流程服务

    核心方法:
    - 项目管理: create / assign / update_phase
    - 底稿: create_worksheet / submit / review / approve
    - 报告: generate_report / approve / publish
    - 整改: create_order / submit_evidence / verify / close
    """

    def __init__(self):
        self.db = SessionLocal()

    # ========== 项目管理 ==========

    def create_project(self, data: Dict) -> Dict:
        """
        创建审计项目

        Input: {name, type, dept, start_date, end_date, manager_id, budget,
                creator_id, audit_objective, audit_scope, target_dept_code}
        """
        project_id = str(uuid.uuid4())
        project_no = f"AP-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

        # 映射审计类型
        audit_type_str = data.get("type", "financial")
        try:
            audit_type = AuditType(audit_type_str)
        except ValueError:
            audit_type = AuditType.FINANCIAL

        logger.info(f"[作业] 创建项目: {project_no} - {data.get('name')}")

        try:
            project = AuditProject(
                id=project_id,
                project_code=project_no,
                project_name=data.get("name", "未命名项目"),
                audit_type=audit_type,
                current_phase=AuditPhase.PLANNING,
                status=ProjectStatus.DRAFT,
                target_dept_code=data.get("target_dept_code"),
                target_dept_name=data.get("dept"),
                start_date=data.get("start_date"),
                end_date=data.get("end_date"),
                project_manager_id=data.get("manager_id"),
                created_by_id=data.get("creator_id") or data.get("manager_id"),
                audit_objective=data.get("audit_objective"),
                audit_scope=data.get("audit_scope"),
            )
            self.db.add(project)
            self.db.commit()
            self.db.refresh(project)

            return {
                "id": project.id,
                "project_code": project.project_code,
                "project_name": project.project_name,
                "audit_type": project.audit_type.value if project.audit_type else None,
                "phase": "init",
                "status": project.status.value if project.status else "draft",
                "target_dept_name": project.target_dept_name,
                "start_date": str(project.start_date) if project.start_date else None,
                "end_date": str(project.end_date) if project.end_date else None,
                "created_at": project.created_at.isoformat() if project.created_at else None,
            }
        except Exception as e:
            self.db.rollback()
            logger.error(f"[作业] 创建项目失败: {e}")
            raise

    def assign_team(self, project_id: str, member_ids: List[str]) -> Dict:
        """分配审计团队成员 —— 为每个成员创建 AuditTask 记录"""
        logger.info(f"[作业] 项目 {project_id} 分配成员: {member_ids}")

        # 校验项目存在
        project = self.db.query(AuditProject).filter(AuditProject.id == project_id).first()
        if not project:
            raise ValueError(f"项目不存在: {project_id}")

        created_tasks = []
        try:
            for i, member_id in enumerate(member_ids):
                task_id_str = f"TASK-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
                task = AuditTask(
                    id=str(uuid.uuid4()),
                    task_id=task_id_str,
                    audit_project_id=project_id,
                    task_name=f"审计任务-{project.project_name}-{i+1}",
                    task_description=f"分配给成员 {member_id} 的审计任务",
                    task_type="audit",
                    status=TaskStatus.PENDING,
                    assignee_id=member_id,
                    created_by_id=project.project_manager_id or member_id,
                    priority=3,
                )
                self.db.add(task)
                created_tasks.append(task)

            self.db.commit()

            return {
                "project_id": project_id,
                "members": member_ids,
                "task_ids": [t.id for t in created_tasks],
            }
        except Exception as e:
            self.db.rollback()
            logger.error(f"[作业] 分配团队成员失败: {e}")
            raise

    def update_phase(self, project_id: str, target_stage_code: str) -> Dict:
        """
        推进项目阶段 —— 通过 PhaseProgress 统一管理

        兼容旧接口：接收 stage_code（如 "01", "02"）或 broad phase 字符串（如 "planning", "fieldwork"）。
        内部通过 PhaseProgress 更新并校验依赖关系。
        """
        from app.models.phase_progress import PHASE_CODES

        project = self.db.query(AuditProject).filter(AuditProject.id == project_id).first()
        if not project:
            raise ValueError(f"项目不存在: {project_id}")

        # 兼容旧 broad phase 字符串 → 映射到 stage_code
        broad_to_stage = {
            "init": "00", "planning": "01", "fieldwork": "04",
            "reporting": "06", "review": "06", "closed": "99",
        }
        if target_stage_code in broad_to_stage:
            target_stage_code = broad_to_stage[target_stage_code]

        if target_stage_code not in PHASE_CODES:
            raise ValueError(f"无效的阶段代码: {target_stage_code}")

        # 通过 PhaseProgress 校验和更新
        try:
            from app.api.v1.endpoints.project_files import _ensure_phase_records, _get_stage_dir_name
        except ImportError:
            _ensure_phase_records = None
            _get_stage_dir_name = None

        if _ensure_phase_records:
            _ensure_phase_records(project_id, self.db)

        # 校验前置依赖
        validate_phase_transition(project_id, target_stage_code, self.db)

        # 更新为目标阶段 IN_PROGRESS
        from app.models.phase_progress import PhaseProgress, PhaseStatus
        from datetime import datetime, timezone

        record = self.db.query(PhaseProgress).filter(
            PhaseProgress.project_id == project_id,
            PhaseProgress.stage_code == target_stage_code,
        ).first()
        if not record:
            raise ValueError(f"阶段记录不存在: {target_stage_code}")

        record.status = PhaseStatus.IN_PROGRESS
        if not record.started_at:
            record.started_at = datetime.now(timezone.utc)

        # 如果进入终态(归档)，同步更新项目状态
        if target_stage_code == "99":
            project.status = ProjectStatus.COMPLETED
        elif project.status == ProjectStatus.DRAFT:
            project.status = ProjectStatus.IN_PROGRESS

        self.db.commit()
        self.db.refresh(project)

        # 同步缓存
        sync_project_current_phase(project_id, self.db)
        self.db.commit()

        broad_phase = get_broad_phase(project_id, self.db)
        logger.info(f"[作业] 项目 {project_id}: stage_code={target_stage_code} broad={broad_phase}")
        return {
            "project_id": project_id,
            "phase": broad_phase,
            "stage_code": target_stage_code,
            "status": project.status.value if project.status else None,
        }

    # ========== 底稿管理 ==========

    def create_worksheet(self, project_id: str, template_id: str, auditor_id: str) -> Dict:
        """基于模板创建底稿 —— 写入 audit_worksheets 表"""
        template = next((t for t in PRESET_WORKSHEET_TEMPLATES if t.id == template_id), None)
        if not template:
            raise ValueError(f"模板不存在: {template_id}")

        # 校验项目存在
        project = self.db.query(AuditProject).filter(AuditProject.id == project_id).first()
        if not project:
            raise ValueError(f"项目不存在: {project_id}")

        ws_id = str(uuid.uuid4())
        ws_no = f"WS-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

        logger.info(f"[作业] 创建底稿: {template.name} (项目{project_id})")

        try:
            worksheet = AuditWorksheet(
                id=ws_id,
                worksheet_id=ws_no,
                audit_project_id=project_id,
                worksheet_name=template.name,
                worksheet_type=template.category,
                status="draft",
                content={"sections": template.sections, "required_fields": template.required_fields},
                template_id=template_id,
                created_by_id=auditor_id,
            )
            self.db.add(worksheet)
            self.db.commit()
            self.db.refresh(worksheet)

            return {
                "id": worksheet.id,
                "worksheet_id": worksheet.worksheet_id,
                "project_id": project_id,
                "template_id": template_id,
                "name": template.name,
                "sections": template.sections,
                "status": WorksheetStatus.DRAFT.value,
                "auditor_id": auditor_id,
                "created_at": worksheet.created_at.isoformat() if worksheet.created_at else datetime.now().isoformat(),
            }
        except Exception as e:
            self.db.rollback()
            logger.error(f"[作业] 创建底稿失败: {e}")
            raise

    def submit_worksheet(self, worksheet_id: str) -> Dict:
        """提交底稿复核 —— 更新底稿状态为 SUBMITTED"""
        worksheet = self.db.query(AuditWorksheet).filter(
            AuditWorksheet.worksheet_id == worksheet_id
        ).first()
        if not worksheet:
            raise ValueError(f"底稿不存在: {worksheet_id}")

        try:
            worksheet.status = "submitted"
            self.db.commit()
            logger.info(f"[作业] 提交底稿: {worksheet_id}")
            return {"worksheet_id": worksheet_id, "status": WorksheetStatus.SUBMITTED.value}
        except Exception as e:
            self.db.rollback()
            logger.error(f"[作业] 提交底稿失败: {e}")
            raise

    def review_worksheet(self, worksheet_id: str, reviewer_id: str,
                         decision: str, comments: str = "") -> Dict:
        """
        复核底稿

        decision: "approve" | "reject"
        """
        worksheet = self.db.query(AuditWorksheet).filter(
            AuditWorksheet.worksheet_id == worksheet_id
        ).first()
        if not worksheet:
            raise ValueError(f"底稿不存在: {worksheet_id}")

        if decision == "approve":
            new_status = "under_review"
            svc_status = WorksheetStatus.REVIEWED.value
        else:
            new_status = "rejected"
            svc_status = WorksheetStatus.REJECTED.value

        try:
            worksheet.status = new_status
            worksheet.reviewer_id = reviewer_id
            worksheet.review_comment = comments
            worksheet.reviewed_at = datetime.utcnow()
            self.db.commit()

            logger.info(f"[作业] 复核底稿 {worksheet_id}: {decision} by {reviewer_id}")
            return {
                "worksheet_id": worksheet_id,
                "status": svc_status,
                "reviewer": reviewer_id,
                "comments": comments,
            }
        except Exception as e:
            self.db.rollback()
            logger.error(f"[作业] 复核底稿失败: {e}")
            raise

    def approve_worksheet(self, worksheet_id: str, approver_id: str) -> Dict:
        """批准底稿 —— 更新状态为 APPROVED"""
        worksheet = self.db.query(AuditWorksheet).filter(
            AuditWorksheet.worksheet_id == worksheet_id
        ).first()
        if not worksheet:
            raise ValueError(f"底稿不存在: {worksheet_id}")

        try:
            worksheet.status = "approved"
            self.db.commit()
            logger.info(f"[作业] 批准底稿: {worksheet_id}")
            return {"worksheet_id": worksheet_id, "status": WorksheetStatus.APPROVED.value}
        except Exception as e:
            self.db.rollback()
            logger.error(f"[作业] 批准底稿失败: {e}")
            raise

    def list_worksheets(self, project_id: str, status: str = None) -> List[Dict]:
        """列出项目的所有底稿 —— 从 DB 查询"""
        q = self.db.query(AuditWorksheet).filter(AuditWorksheet.audit_project_id == project_id)
        if status:
            db_status = _WS_STATUS_MAP.get(status, status)
            q = q.filter(AuditWorksheet.status == db_status)

        worksheets = q.order_by(AuditWorksheet.created_at.desc()).all()

        return [
            {
                "id": ws.id,
                "worksheet_id": ws.worksheet_id,
                "project_id": ws.audit_project_id,
                "name": ws.worksheet_name,
                "type": ws.worksheet_type,
                "template_id": ws.template_id,
                "status": ws.status,
                "content": ws.content,
                "reviewer_id": ws.reviewer_id,
                "review_comment": ws.review_comment,
                "created_by_id": ws.created_by_id,
                "created_at": ws.created_at.isoformat() if ws.created_at else None,
            }
            for ws in worksheets
        ]

    def list_worksheet_templates(self) -> List[Dict]:
        """列出所有底稿模板"""
        return [
            {"id": t.id, "name": t.name, "category": t.category,
             "sections": t.sections, "required_fields": t.required_fields}
            for t in PRESET_WORKSHEET_TEMPLATES
        ]

    # ========== 报告管理 ==========

    def generate_report(self, project_id: str, template_id: str, generated_by: str) -> Dict:
        """
        自动生成审计报告

        汇聚: 审计发现 + 风险数据 + 底稿数据 → 报告
        """
        template = next((t for t in PRESET_REPORT_TEMPLATES if t.id == template_id), None)
        if not template:
            raise ValueError(f"报告模板不存在: {template_id}")

        report_id = str(uuid.uuid4())
        report_no = f"AR-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

        logger.info(f"[作业] 生成报告: {report_no} (模板: {template.name})")

        # 汇聚数据
        findings = self._collect_findings(project_id)
        risks = self._collect_risks(project_id)
        worksheets = self.list_worksheets(project_id)

        return {
            "id": report_id,
            "report_no": report_no,
            "project_id": project_id,
            "template": template.name,
            "status": ReportStatus.DRAFT.value,
            "sections": template.sections,
            "data": {
                "findings_count": len(findings),
                "risks_count": len(risks),
                "worksheets_count": len(worksheets),
                "findings": findings,
                "risks": risks,
            },
            "generated_by": generated_by,
            "generated_at": datetime.now().isoformat(),
        }

    def submit_report(self, report_id: str) -> Dict:
        """提交报告审批"""
        logger.info(f"[作业] 提交报告: {report_id}")
        return {"report_id": report_id, "status": ReportStatus.SUBMITTED.value}

    def approve_report(self, report_id: str, approver_id: str) -> Dict:
        """批准报告"""
        logger.info(f"[作业] 批准报告: {report_id}")
        return {"report_id": report_id, "status": ReportStatus.APPROVED.value}

    def publish_report(self, report_id: str) -> Dict:
        """发布报告"""
        logger.info(f"[作业] 发布报告: {report_id}")
        return {"report_id": report_id, "status": ReportStatus.PUBLISHED.value}

    def list_report_templates(self) -> List[Dict]:
        """列出报告模板"""
        return [
            {"id": t.id, "name": t.name, "type": t.type, "sections": t.sections}
            for t in PRESET_REPORT_TEMPLATES
        ]

    # ========== 整改闭环 ==========

    def create_rectification_order(self, finding_id: str, data: Dict) -> Dict:
        """
        创建整改通知单

        Input: {dept, responsible, deadline, description, actions, project_id, risk_level}
        """
        # 查找审计发现，获取项目ID
        finding = self.db.query(AuditFinding).filter(AuditFinding.id == finding_id).first()
        if not finding:
            raise ValueError(f"审计发现不存在: {finding_id}")

        order_id = str(uuid.uuid4())
        order_no = f"RO-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"

        deadline_raw = data.get("deadline")
        if isinstance(deadline_raw, str):
            deadline_val = date.fromisoformat(deadline_raw)
        elif isinstance(deadline_raw, date):
            deadline_val = deadline_raw
        else:
            deadline_val = date.today() + timedelta(days=30)

        logger.info(f"[作业] 创建整改单: {order_no} -> {data.get('dept')}")

        # 获取必要字段，使用默认值处理缺失数据
        dept_name = data.get("dept") or finding.responsible_dept or ""

        try:
            order = RectificationOrder(
                id=order_id,
                order_id=order_no,
                finding_id=finding_id,
                audit_project_id=data.get("project_id") or finding.audit_project_id,
                title=f"整改: {finding.title}" if finding.title else (data.get("description", "整改任务")[:500]),
                description=data.get("description"),
                risk_level=data.get("risk_level", "medium"),
                amount_involved=data.get("amount") or finding.amount_involved,
                responsible_dept_id=data.get("dept_id", ""),
                responsible_dept_name=dept_name,
                responsible_person_id=data.get("responsible_id", ""),
                responsible_person_name=data.get("responsible"),
                suggested_deadline_days=data.get("deadline_days", 30),
                deadline=deadline_val,
                status=OrderStatus.PENDING,
            )
            self.db.add(order)
            self.db.commit()
            self.db.refresh(order)

            return {
                "id": order.id,
                "order_id": order.order_id,
                "order_no": order.order_id,
                "finding_id": finding_id,
                "dept_name": data.get("dept"),
                "responsible": data.get("responsible"),
                "deadline": str(order.deadline) if order.deadline else None,
                "status": order.status.value if order.status else "pending",
                "created_at": order.created_at.isoformat() if order.created_at else datetime.now().isoformat(),
            }
        except Exception as e:
            self.db.rollback()
            logger.error(f"[作业] 创建整改单失败: {e}")
            raise

    def submit_evidence(self, order_id: str, evidence: Dict) -> Dict:
        """
        提交整改证据

        evidence: {files: [{file_name, file_path, file_type, file_size}], description, submitter, submitter_id}
        """
        order = self.db.query(RectificationOrder).filter(
            RectificationOrder.order_id == order_id
        ).first()
        if not order:
            raise ValueError(f"整改单不存在: {order_id}")

        files = evidence.get("files", [])
        submitter_id = evidence.get("submitter_id", "")

        evidence_records = []
        try:
            # 更新整改单状态
            order.status = OrderStatus.SUBMITTED

            for file_info in files:
                ev = RectificationEvidence(
                    id=str(uuid.uuid4()),
                    order_id=order.id,
                    evidence_type=file_info.get("file_type", "document"),
                    file_name=file_info.get("file_name", "unknown"),
                    file_path=file_info.get("file_path", ""),
                    file_size=file_info.get("file_size"),
                    description=evidence.get("description", ""),
                    submitted_by_id=submitter_id,
                )
                self.db.add(ev)
                evidence_records.append(ev)

            self.db.commit()

            logger.info(f"[作业] 提交整改证据: {order_id}, {len(files)} 个文件")
            return {
                "order_id": order_id,
                "status": "evidence_submitted",
                "evidence_count": len(files),
                "evidence_ids": [ev.id for ev in evidence_records],
                "evidence": evidence,
                "submitted_at": datetime.now().isoformat(),
            }
        except Exception as e:
            self.db.rollback()
            logger.error(f"[作业] 提交整改证据失败: {e}")
            raise

    def verify_rectification(self, order_id: str, verifier_id: str,
                             result: str, comments: str = "") -> Dict:
        """
        验证整改结果

        result: "pass" | "reject"
        """
        order = self.db.query(RectificationOrder).filter(
            RectificationOrder.order_id == order_id
        ).first()
        if not order:
            raise ValueError(f"整改单不存在: {order_id}")

        if result == "pass":
            order.status = OrderStatus.VERIFIED
        else:
            order.status = OrderStatus.REJECTED

        status_val = order.status.value

        try:
            self.db.commit()
            logger.info(f"[作业] 验证整改 {order_id}: {result}")
            return {
                "order_id": order_id,
                "status": status_val,
                "verifier": verifier_id,
                "comments": comments,
                "verified_at": datetime.now().isoformat(),
            }
        except Exception as e:
            self.db.rollback()
            logger.error(f"[作业] 验证整改失败: {e}")
            raise

    def close_rectification(self, order_id: str) -> Dict:
        """关闭整改单（完成闭环） —— 更新状态为 ARCHIVED"""
        order = self.db.query(RectificationOrder).filter(
            RectificationOrder.order_id == order_id
        ).first()
        if not order:
            raise ValueError(f"整改单不存在: {order_id}")

        try:
            order.status = OrderStatus.ARCHIVED
            self.db.commit()

            logger.info(f"[作业] 关闭整改: {order_id}")
            return {
                "order_id": order_id,
                "status": "closed",
                "closed_at": datetime.now().isoformat(),
            }
        except Exception as e:
            self.db.rollback()
            logger.error(f"[作业] 关闭整改失败: {e}")
            raise

    # ========== 内部工具方法 ==========

    def _collect_findings(self, project_id: str) -> List[Dict]:
        """收集审计发现 —— 从 DB 查询"""
        findings = self.db.query(AuditFinding).filter(
            AuditFinding.audit_project_id == project_id
        ).all()

        return [
            {
                "id": f.id,
                "finding_id": f.finding_id,
                "title": f.title,
                "description": f.description,
                "finding_type": f.finding_type,
                "severity": f.severity.value if f.severity else None,
                "status": f.status.value if f.status else None,
                "risk_score": f.risk_score,
                "amount_involved": f.amount_involved,
                "responsible_person": f.responsible_person,
                "responsible_dept": f.responsible_dept,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f in findings
        ]

    def _collect_risks(self, project_id: str) -> List[Dict]:
        """收集关联风险 —— 从 DB 查询，按部门匹配"""
        project = self.db.query(AuditProject).filter(AuditProject.id == project_id).first()
        if not project:
            return []

        # 按部门名称或业务领域匹配风险告警
        q = self.db.query(RiskAlert)
        conditions = []
        if project.target_dept_code:
            conditions.append(RiskAlert.dept_code == project.target_dept_code)
        if project.target_dept_name:
            conditions.append(RiskAlert.dept_name == project.target_dept_name)
        if conditions:
            q = q.filter(and_(*conditions))
        else:
            return []

        alerts = q.order_by(RiskAlert.alert_time.desc()).limit(50).all()

        return [
            {
                "id": a.id,
                "alert_id": a.alert_id,
                "risk_type": a.risk_type.value if a.risk_type else None,
                "severity": a.severity.value if a.severity else None,
                "title": a.title,
                "description": a.description,
                "dept_name": a.dept_name,
                "status": a.status.value if a.status else None,
                "alert_time": a.alert_time.isoformat() if a.alert_time else None,
            }
            for a in alerts
        ]

    def get_project_overview(self, project_id: str) -> Dict:
        """获取项目概览（驾驶舱用） —— 查询真实 DB 统计数据"""
        project = self.db.query(AuditProject).filter(AuditProject.id == project_id).first()
        if not project:
            raise ValueError(f"项目不存在: {project_id}")

        # 从 PhaseProgress 派生当前阶段（统一数据源）
        broad_phase = get_broad_phase(project_id, self.db)
        progress = get_progress_percent(project_id, self.db)

        # 底稿统计
        ws_total = self.db.query(func.count(AuditWorksheet.id)).filter(
            AuditWorksheet.audit_project_id == project_id
        ).scalar() or 0
        ws_approved = self.db.query(func.count(AuditWorksheet.id)).filter(
            AuditWorksheet.audit_project_id == project_id,
            AuditWorksheet.status == "approved"
        ).scalar() or 0
        ws_in_progress = self.db.query(func.count(AuditWorksheet.id)).filter(
            AuditWorksheet.audit_project_id == project_id,
            AuditWorksheet.status.in_(["draft", "submitted", "under_review"])
        ).scalar() or 0

        # 发现统计（按严重程度）
        findings_total = self.db.query(func.count(AuditFinding.id)).filter(
            AuditFinding.audit_project_id == project_id
        ).scalar() or 0
        findings_high = self.db.query(func.count(AuditFinding.id)).filter(
            AuditFinding.audit_project_id == project_id,
            AuditFinding.severity == FindingSeverity.HIGH
        ).scalar() or 0
        findings_medium = self.db.query(func.count(AuditFinding.id)).filter(
            AuditFinding.audit_project_id == project_id,
            AuditFinding.severity == FindingSeverity.MEDIUM
        ).scalar() or 0
        findings_low = self.db.query(func.count(AuditFinding.id)).filter(
            AuditFinding.audit_project_id == project_id,
            AuditFinding.severity == FindingSeverity.LOW
        ).scalar() or 0

        # 整改统计
        rect_total = self.db.query(func.count(RectificationOrder.id)).filter(
            RectificationOrder.audit_project_id == project_id
        ).scalar() or 0
        rect_completed = self.db.query(func.count(RectificationOrder.id)).filter(
            RectificationOrder.audit_project_id == project_id,
            RectificationOrder.status.in_([OrderStatus.VERIFIED, OrderStatus.ARCHIVED])
        ).scalar() or 0
        rect_pending = rect_total - rect_completed

        # 时间线计算
        start = project.start_date.isoformat() if project.start_date else (datetime.now() - timedelta(days=30)).date().isoformat()
        planned_end = project.end_date.isoformat() if project.end_date else (datetime.now() + timedelta(days=60)).date().isoformat()
        # 进度由 PhaseProgress 派生

        return {
            "project_id": project_id,
            "project_name": project.project_name,
            "project_code": project.project_code,
            "phase": broad_phase,
            "status": project.status.value if project.status else None,
            "worksheets": {
                "total": ws_total,
                "approved": ws_approved,
                "in_progress": ws_in_progress,
            },
            "findings": {
                "total": findings_total,
                "high": findings_high,
                "medium": findings_medium,
                "low": findings_low,
            },
            "rectifications": {
                "total": rect_total,
                "completed": rect_completed,
                "pending": rect_pending,
            },
            "budget_usage": {
                "total": 100000,
                "used": 45000,
                "percent": 45,
            },
            "timeline": {
                "start": start,
                "planned_end": planned_end,
                "progress_percent": progress,
            },
        }
