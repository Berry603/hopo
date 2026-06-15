"""
审计发现服务
Audit Finding Service — 风险预警转换、证据链管理
"""
import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from loguru import logger

from app.core.database import SessionLocal
from app.models.risk import RiskAlert, AlertStatus
from app.models.audit import AuditFinding, FindingSeverity, FindingStatus
from app.models.audit_project import AuditProject
from app.models.evidence_chain import EvidenceLink


class AuditFindingService:
    """审计发现服务"""

    @staticmethod
    def generate_finding_id(db: Session) -> str:
        last = db.query(AuditFinding).order_by(AuditFinding.finding_id.desc()).first()
        if not last or not last.finding_id:
            return "FND-001"
        try:
            num = int(last.finding_id.split("-")[1]) + 1
            return f"FND-{num:03d}"
        except (IndexError, ValueError):
            return f"FND-{uuid.uuid4().hex[:6].upper()}"

    @classmethod
    def convert_alert_to_finding(
        cls,
        alert_id: str,
        project_id: str,
        user_id: str,
        db: Session,
    ) -> AuditFinding:
        """将风险预警转换为审计发现"""
        alert = db.query(RiskAlert).filter(RiskAlert.id == alert_id).first()
        if not alert:
            raise ValueError(f"风险预警 {alert_id} 不存在")

        project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
        if not project:
            raise ValueError(f"审计项目 {project_id} 不存在")

        # 检查是否已转换
        existing = db.query(AuditFinding).filter(
            AuditFinding.source_alert_id == alert_id
        ).first()
        if existing:
            raise ValueError(f"预警 {alert.alert_id} 已转换为审计发现 {existing.finding_id}")

        # 映射严重程度
        severity_map = {
            "high": FindingSeverity.HIGH,
            "medium": FindingSeverity.MEDIUM,
            "low": FindingSeverity.LOW,
        }
        severity = severity_map.get(alert.severity.value if hasattr(alert.severity, 'value') else alert.severity, FindingSeverity.MEDIUM)

        finding = AuditFinding(
            id=str(uuid.uuid4()),
            finding_id=cls.generate_finding_id(db),
            audit_project_id=project_id,
            title=alert.title,
            description=alert.description or alert.title,
            finding_type=alert.risk_type.value if hasattr(alert.risk_type, 'value') else str(alert.risk_type),
            severity=severity,
            status=FindingStatus.CONFIRMED,
            risk_score=80.0 if severity == FindingSeverity.HIGH else 55.0 if severity == FindingSeverity.MEDIUM else 30.0,
            amount_involved=str(alert.detail_data.get("amount", "")) if alert.detail_data else None,
            responsible_dept=alert.dept_name or "待指定",
            source_alert_id=alert_id,
            discovered_by_id=user_id,
            recommendation=f"【系统自动生成】风险预警 {alert.alert_id} 经风险引擎扫描发现，建议纳入审计项目「{project.project_name}」进行核查。",
            created_at=datetime.utcnow(),
        )
        db.add(finding)

        # 更新预警状态为已确认
        alert.status = AlertStatus.CONFIRMED
        alert.confirmed_at = datetime.utcnow()

        # 创建证据链：关联预警
        evidence = EvidenceLink(
            id=str(uuid.uuid4()),
            finding_id=finding.id,
            source_type="risk_alert",
            source_id=alert_id,
            evidence_description=f"风险预警 {alert.alert_id}: {alert.title}",
            evidence_data={
                "alert_id": alert.alert_id,
                "rule_name": alert.rule.name if alert.rule else None,
                "risk_type": str(alert.risk_type.value) if hasattr(alert.risk_type, 'value') else str(alert.risk_type),
                "severity": str(alert.severity.value) if hasattr(alert.severity, 'value') else str(alert.severity),
                "detail_data": alert.detail_data,
                "alert_time": alert.alert_time.isoformat() if alert.alert_time else None,
            },
            created_by_id=user_id,
            created_at=datetime.utcnow(),
        )
        db.add(evidence)

        db.commit()
        db.refresh(finding)

        logger.info(f"风险预警 {alert.alert_id} → 审计发现 {finding.finding_id}，已关联项目 {project.project_code}")
        return finding

    @classmethod
    def link_procedure_row(
        cls,
        finding_id: str,
        execution_id: str,
        row_index: int,
        description: str,
        user_id: str,
        db: Session,
    ) -> EvidenceLink:
        """关联穿行测试行到审计发现"""
        finding = db.query(AuditFinding).filter(AuditFinding.id == finding_id).first()
        if not finding:
            raise ValueError(f"审计发现 {finding_id} 不存在")

        from app.models.audit_procedure import ProcedureRow
        row = db.query(ProcedureRow).filter(
            ProcedureRow.execution_id == execution_id,
            ProcedureRow.row_index == row_index,
        ).first()

        evidence = EvidenceLink(
            id=str(uuid.uuid4()),
            finding_id=finding_id,
            source_type="procedure_row",
            source_id=f"{execution_id}:{row_index}",
            procedure_execution_id=execution_id,
            procedure_row_index=row_index,
            evidence_description=description,
            evidence_data=row.data if row else None,
            created_by_id=user_id,
            created_at=datetime.utcnow(),
        )
        db.add(evidence)
        db.commit()
        db.refresh(evidence)
        return evidence

    @classmethod
    def add_manual_evidence(
        cls,
        finding_id: str,
        source_type: str,
        source_id: str,
        description: str,
        evidence_data: Optional[dict],
        user_id: str,
        db: Session,
    ) -> EvidenceLink:
        """手动添加证据"""
        evidence = EvidenceLink(
            id=str(uuid.uuid4()),
            finding_id=finding_id,
            source_type=source_type,
            source_id=source_id,
            evidence_description=description,
            evidence_data=evidence_data,
            created_by_id=user_id,
            created_at=datetime.utcnow(),
        )
        db.add(evidence)
        db.commit()
        db.refresh(evidence)
        return evidence

    @classmethod
    def get_evidence_chain(cls, finding_id: str, db: Session) -> List[EvidenceLink]:
        """获取审计发现的完整证据链"""
        return db.query(EvidenceLink).filter(
            EvidenceLink.finding_id == finding_id
        ).order_by(EvidenceLink.created_at.desc()).all()

    @classmethod
    def auto_generate_findings_for_project(
        cls,
        project_id: str,
        user_id: str,
        db: Session,
    ) -> List[AuditFinding]:
        """批量将项目的相关预警转换为审计发现"""
        project = db.query(AuditProject).filter(AuditProject.id == project_id).first()
        if not project:
            raise ValueError(f"项目 {project_id} 不存在")

        # 查找该部门/领域相关的已确认或打开预警
        query = db.query(RiskAlert).filter(
            RiskAlert.status.in_([AlertStatus.OPEN, AlertStatus.CONFIRMED])
        )
        if project.target_dept_name:
            query = query.filter(RiskAlert.dept_name == project.target_dept_name)

        alerts = query.order_by(RiskAlert.severity.desc()).limit(20).all()

        findings = []
        for alert in alerts:
            try:
                finding = cls.convert_alert_to_finding(alert.id, project_id, user_id, db)
                findings.append(finding)
            except ValueError as e:
                logger.warning(f"跳过预警 {alert.alert_id}: {e}")
                continue

        logger.info(f"项目 {project.project_code} 自动生成 {len(findings)} 条审计发现")
        return findings
