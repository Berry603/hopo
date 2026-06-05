"""
审计作业服务
Audit Workflow Service

管理审计项目全生命周期:
  项目立项 → 底稿编制 → 报告生成 → 整改跟踪 → 项目关闭
"""
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from loguru import logger

from app.core.database import SessionLocal


# ==================== 审计流程状态机 ====================

class ProjectPhase(str, Enum):
    """项目阶段"""
    INIT = "init"                 # 初始
    PLANNING = "planning"         # 计划
    FIELDWORK = "fieldwork"       # 现场作业
    REPORTING = "reporting"       # 报告
    REVIEW = "review"             # 复核
    CLOSED = "closed"             # 关闭


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


# 阶段流转规则
PHASE_TRANSITIONS = {
    ProjectPhase.INIT: [ProjectPhase.PLANNING],
    ProjectPhase.PLANNING: [ProjectPhase.FIELDWORK, ProjectPhase.INIT],
    ProjectPhase.FIELDWORK: [ProjectPhase.REPORTING, ProjectPhase.PLANNING],
    ProjectPhase.REPORTING: [ProjectPhase.REVIEW, ProjectPhase.FIELDWORK],
    ProjectPhase.REVIEW: [ProjectPhase.CLOSED, ProjectPhase.REPORTING],
    ProjectPhase.CLOSED: [],  # 终态
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
        
        Input: {name, type, dept, start_date, end_date, manager_id, budget}
        """
        project_id = str(uuid.uuid4())
        project_no = f"AP-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        
        logger.info(f"[作业] 创建项目: {project_no} - {data.get('name')}")
        
        return {
            "id": project_id,
            "project_no": project_no,
            "name": data.get("name"),
            "phase": ProjectPhase.INIT.value,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
        }

    def assign_team(self, project_id: str, member_ids: List[str]) -> Dict:
        """分配审计团队成员"""
        logger.info(f"[作业] 项目 {project_id} 分配成员: {member_ids}")
        return {"project_id": project_id, "members": member_ids}

    def update_phase(self, project_id: str, new_phase: ProjectPhase) -> Dict:
        """推进项目阶段"""
        # 获取当前阶段
        current_phase = ProjectPhase.INIT  # 实际从DB读取
        
        if new_phase not in PHASE_TRANSITIONS.get(current_phase, []):
            raise ValueError(f"不允许从 {current_phase} 转到 {new_phase}")
        
        logger.info(f"[作业] 项目 {project_id}: {current_phase} → {new_phase}")
        return {"project_id": project_id, "phase": new_phase.value}

    # ========== 底稿管理 ==========

    def create_worksheet(self, project_id: str, template_id: str, auditor_id: str) -> Dict:
        """基于模板创建底稿"""
        template = next((t for t in PRESET_WORKSHEET_TEMPLATES if t.id == template_id), None)
        if not template:
            raise ValueError(f"模板不存在: {template_id}")
        
        ws_id = str(uuid.uuid4())
        
        logger.info(f"[作业] 创建底稿: {template.name} (项目{project_id})")
        
        return {
            "id": ws_id,
            "project_id": project_id,
            "template_id": template_id,
            "name": template.name,
            "sections": template.sections,
            "status": WorksheetStatus.DRAFT.value,
            "auditor_id": auditor_id,
            "created_at": datetime.now().isoformat(),
        }

    def submit_worksheet(self, worksheet_id: str) -> Dict:
        """提交底稿复核"""
        logger.info(f"[作业] 提交底稿: {worksheet_id}")
        return {"worksheet_id": worksheet_id, "status": WorksheetStatus.SUBMITTED.value}

    def review_worksheet(self, worksheet_id: str, reviewer_id: str, 
                         decision: str, comments: str = "") -> Dict:
        """
        复核底稿
        
        decision: "approve" | "reject"
        """
        new_status = WorksheetStatus.REVIEWED if decision == "approve" else WorksheetStatus.REJECTED
        logger.info(f"[作业] 复核底稿 {worksheet_id}: {decision} by {reviewer_id}")
        return {
            "worksheet_id": worksheet_id,
            "status": new_status.value,
            "reviewer": reviewer_id,
            "comments": comments,
        }

    def approve_worksheet(self, worksheet_id: str, approver_id: str) -> Dict:
        """批准底稿"""
        logger.info(f"[作业] 批准底稿: {worksheet_id}")
        return {"worksheet_id": worksheet_id, "status": WorksheetStatus.APPROVED.value}

    def list_worksheets(self, project_id: str, status: str = None) -> List[Dict]:
        """列出项目的所有底稿"""
        return [t.__dict__ for t in PRESET_WORKSHEET_TEMPLATES]

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
        
        Input: {dept, responsible, deadline, description, actions}
        """
        order_id = str(uuid.uuid4())
        order_no = f"RO-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
        
        logger.info(f"[作业] 创建整改单: {order_no} → {data.get('dept')}")
        
        return {
            "id": order_id,
            "order_no": order_no,
            "finding_id": finding_id,
            "dept_name": data.get("dept"),
            "responsible": data.get("responsible"),
            "deadline": data.get("deadline"),
            "status": "pending",
            "created_at": datetime.now().isoformat(),
        }

    def submit_evidence(self, order_id: str, evidence: Dict) -> Dict:
        """
        提交整改证据
        
        evidence: {files: [], description, submitter}
        """
        logger.info(f"[作业] 提交整改证据: {order_id}")
        return {
            "order_id": order_id,
            "status": "evidence_submitted",
            "evidence": evidence,
            "submitted_at": datetime.now().isoformat(),
        }

    def verify_rectification(self, order_id: str, verifier_id: str, 
                             result: str, comments: str = "") -> Dict:
        """
        验证整改结果
        
        result: "pass" | "reject"
        """
        status = "completed" if result == "pass" else "rejected"
        logger.info(f"[作业] 验证整改 {order_id}: {result}")
        return {
            "order_id": order_id,
            "status": status,
            "verifier": verifier_id,
            "comments": comments,
            "verified_at": datetime.now().isoformat(),
        }

    def close_rectification(self, order_id: str) -> Dict:
        """关闭整改单（完成闭环）"""
        logger.info(f"[作业] 关闭整改: {order_id}")
        return {
            "order_id": order_id,
            "status": "closed",
            "closed_at": datetime.now().isoformat(),
        }

    # ========== 内部工具方法 ==========

    def _collect_findings(self, project_id: str) -> List[Dict]:
        """收集审计发现"""
        return []

    def _collect_risks(self, project_id: str) -> List[Dict]:
        """收集关联风险"""
        return []

    def get_project_overview(self, project_id: str) -> Dict:
        """获取项目概览（驾驶舱用）"""
        return {
            "project_id": project_id,
            "phase": ProjectPhase.FIELDWORK.value,
            "worksheets": {"total": 5, "approved": 3, "in_progress": 2},
            "findings": {"total": 8, "high": 2, "medium": 4, "low": 2},
            "rectifications": {"total": 5, "completed": 2, "pending": 3},
            "budget_usage": {"total": 100000, "used": 45000, "percent": 45},
            "timeline": {
                "start": (datetime.now() - timedelta(days=30)).isoformat(),
                "planned_end": (datetime.now() + timedelta(days=60)).isoformat(),
                "progress_percent": 45,
            },
        }
