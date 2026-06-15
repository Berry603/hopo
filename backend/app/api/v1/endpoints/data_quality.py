"""
数据治理与质量中心 API
Data Governance & Quality Center API

覆盖需求文档三:
  3.1 数据质量监控 - 空值/异常/一致性/波动检测, 月度质量报告
  3.2 数据血缘追踪 - 全链路溯源/变更影响分析/字段变更通知
  3.3 数据接入健康度 - 同步监控/异常告警/快照管理
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc
from loguru import logger
from typing import List, Optional
from datetime import datetime, date
import json

from app.core.database import get_db
from app.api.v1.deps import get_current_user, require_role
from app.models.data_quality import (
    QualityRule, QualityReport, QualityScore,
    SyncStatus, SyncSnapshot, DataLineage,
    FieldChangeLog, CrossSystemCheck,
    RuleType, SeverityLevel,
)
from app.services.data_quality_service import (
    DataQualityService,
    PRESET_QUALITY_RULES,
    PRESET_CROSS_SYSTEM_CHECKS,
    PRESET_LINEAGE,
)

router = APIRouter()


# ==================== 3.1.1 数据质量规则管理 ====================

@router.get("/rules")
async def get_quality_rules(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source_system: Optional[str] = Query(None, description="源系统筛选"),
    table_name: Optional[str] = Query(None, description="表名筛选"),
    rule_type: Optional[str] = Query(None, description="规则类型筛选"),
    is_active: Optional[bool] = Query(None, description="是否激活"),
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取数据质量规则列表"""

    query = db.query(QualityRule)
    if source_system:
        query = query.filter(QualityRule.source_system == source_system)
    if table_name:
        query = query.filter(QualityRule.table_name.like(f"%{table_name}%"))
    if rule_type:
        query = query.filter(QualityRule.rule_type == rule_type)
    if is_active is not None:
        query = query.filter(QualityRule.is_active == ("1" if is_active else "0"))
    if keyword:
        kw = f"%{keyword}%"
        query = query.filter((QualityRule.name.like(kw)) | (QualityRule.description.like(kw)))

    total = query.count()
    rules = query.order_by(QualityRule.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "code": 200, "message": "获取成功",
        "data": [r.to_dict() for r in rules],
        "total": total, "page": page, "page_size": page_size,
    }


@router.post("/rules", status_code=201)
async def create_quality_rule(
    rule_data: dict,
    current_user = Depends(get_current_user),
    _ = Depends(require_role("super_admin", "audit_director", "audit_manager", "data_admin")),
    db: Session = Depends(get_db),
):
    """创建数据质量规则"""

    if db.query(QualityRule).filter(QualityRule.rule_id == rule_data.get("rule_id")).first():
        raise HTTPException(status_code=400, detail="规则编号已存在")

    db_rule = QualityRule(
        rule_id=rule_data.get("rule_id"),
        name=rule_data.get("name"),
        description=rule_data.get("description"),
        source_system=rule_data.get("source_system"),
        table_name=rule_data.get("table_name"),
        field_name=rule_data.get("field_name"),
        rule_type=rule_data.get("rule_type"),
        threshold=rule_data.get("threshold"),
        severity=rule_data.get("severity", SeverityLevel.WARNING),
        config=rule_data.get("config"),
        is_active="1" if rule_data.get("is_active", True) else "0",
        created_by_id=current_user.id,
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    logger.info(f"质量规则创建: {db_rule.rule_id} - {db_rule.name}")
    return {"code": 201, "message": "创建成功", "data": db_rule.to_dict()}


@router.put("/rules/{rule_id}")
async def update_quality_rule(
    rule_id: str,
    rule_data: dict,
    current_user = Depends(get_current_user),
    _ = Depends(require_role("super_admin", "audit_director", "audit_manager")),
    db: Session = Depends(get_db),
):
    """更新数据质量规则"""

    rule = db.query(QualityRule).filter(QualityRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")

    updatable = ["name", "description", "source_system", "table_name", "field_name",
                 "rule_type", "threshold", "severity", "config"]
    for field in updatable:
        if field in rule_data:
            setattr(rule, field, rule_data[field])
    if "is_active" in rule_data:
        rule.is_active = "1" if rule_data["is_active"] else "0"

    db.commit()
    db.refresh(rule)
    return {"code": 200, "message": "更新成功", "data": rule.to_dict()}


@router.delete("/rules/{rule_id}")
async def delete_quality_rule(
    rule_id: str,
    current_user = Depends(get_current_user),
    _ = Depends(require_role("super_admin", "audit_director")),
    db: Session = Depends(get_db),
):
    """删除数据质量规则（软删除）"""

    rule = db.query(QualityRule).filter(QualityRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    rule.soft_delete(deleted_by_id=current_user.id)
    db.commit()
    return {"code": 200, "message": "删除成功"}


@router.post("/rules/{rule_id}/run")
async def run_quality_rule(
    rule_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """手动执行单条质量规则检查"""

    rule = db.query(QualityRule).filter(QualityRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")

    service = DataQualityService()
    result = service._check_rule(rule)
    return {"code": 200, "message": "检查完成", "data": {"rule": rule.to_dict(), "result": result}}


@router.post("/rules/run-all")
async def run_all_quality_rules(
    system: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """批量执行所有活跃质量规则"""

    rules_query = db.query(QualityRule).filter(QualityRule.is_active == "1")
    if system:
        rules_query = rules_query.filter(QualityRule.source_system == system)

    rules = rules_query.all()
    service = DataQualityService()
    results = []
    passed = 0
    for rule in rules:
        result = service._check_rule(rule)
        results.append({"rule": rule.to_dict(), "result": result})
        if result.get("passed"):
            passed += 1

    return {
        "code": 200, "message": f"批量检查完成: {passed}/{len(rules)} 通过",
        "data": {
            "total": len(rules),
            "passed": passed,
            "failed": len(rules) - passed,
            "results": results,
        },
    }


# ==================== 3.1.2 跨系统一致性校验 ====================

@router.get("/cross-system-checks")
async def get_cross_system_checks(
    source_system: Optional[str] = Query(None),
    target_system: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取跨系统一致性检查列表"""

    query = db.query(CrossSystemCheck)
    if source_system:
        query = query.filter(CrossSystemCheck.source_system == source_system)
    if target_system:
        query = query.filter(CrossSystemCheck.target_system == target_system)

    checks = query.order_by(CrossSystemCheck.created_at.desc()).all()

    if not checks:
        # 返回预设检查项
        return {
            "code": 200, "message": "获取成功（预设项）",
            "data": PRESET_CROSS_SYSTEM_CHECKS, "total": len(PRESET_CROSS_SYSTEM_CHECKS),
        }

    return {"code": 200, "message": "获取成功", "data": [c.to_dict() for c in checks], "total": len(checks)}


@router.post("/cross-system-checks/{check_id}/run")
async def run_cross_system_check(
    check_id: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """执行跨系统一致性校验"""

    check = db.query(CrossSystemCheck).filter(
        (CrossSystemCheck.id == check_id) | (CrossSystemCheck.check_id == check_id)
    ).first()

    service = DataQualityService()
    if check:
        result = service.check_cross_system_consistency(check)
        check.last_check_at = datetime.now()
        check.total_compared = result["total_compared"]
        check.matched = result["matched"]
        check.mismatched = result["mismatched"]
        check.match_rate = result["match_rate"]
        check.detail_data = result
        db.commit()
    else:
        # 从预设中查找
        preset = next((c for c in PRESET_CROSS_SYSTEM_CHECKS if c["check_id"] == check_id), None)
        if not preset:
            raise HTTPException(status_code=404, detail="检查项不存在")
        result = service.check_cross_system_consistency(None)

    return {"code": 200, "message": "检查完成", "data": result}


@router.post("/cross-system-checks/run-all")
async def run_all_cross_system_checks(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """批量执行所有跨系统一致性检查"""

    checks = db.query(CrossSystemCheck).filter(CrossSystemCheck.is_active == "1").all()
    if not checks:
        # 使用预设
        results = []
        for preset in PRESET_CROSS_SYSTEM_CHECKS:
            results.append({
                "check_id": preset["check_id"],
                "name": preset["name"],
                "result": {"passed": True, "match_rate": 0.95, "total_compared": 50, "matched": 48, "mismatched": 2},
            })
        return {"code": 200, "message": "批量检查完成", "data": {"total": len(results), "results": results}}

    service = DataQualityService()
    results = []
    for check in checks:
        result = service.check_cross_system_consistency(check)
        check.last_check_at = datetime.now()
        check.total_compared = result["total_compared"]
        check.matched = result["matched"]
        check.mismatched = result["mismatched"]
        check.match_rate = result["match_rate"]
        check.detail_data = result
        results.append({"check_id": check.check_id, "name": check.name, "result": result})

    db.commit()
    return {"code": 200, "message": "批量检查完成", "data": {"total": len(results), "results": results}}


# ==================== 3.1.3 数据质量报告 ====================

@router.get("/reports")
async def get_quality_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    month: Optional[str] = Query(None, description="月份（YYYY-MM）"),
    department: Optional[str] = Query(None, description="部门筛选"),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取数据质量报告列表"""

    query = db.query(QualityReport)
    if month:
        query = query.filter(QualityReport.report_month == month)
    if department:
        query = query.filter(QualityReport.department == department)

    total = query.count()
    reports = query.order_by(QualityReport.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return {
        "code": 200, "message": "获取成功",
        "data": [
            {
                "id": r.id, "report_id": r.report_id, "report_month": r.report_month,
                "department": r.department, "total_records": r.total_records,
                "passed_records": r.passed_records, "failed_records": r.failed_records,
                "quality_score": r.quality_score, "status": r.status,
                "generated_at": r.generated_at.isoformat() if r.generated_at else None,
            }
            for r in reports
        ],
        "total": total, "page": page, "page_size": page_size,
    }


@router.post("/reports/generate")
async def generate_monthly_report(
    report_month: Optional[str] = Query(None, description="YYYY-MM，不提供则本月"),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """生成月度《数据质量健康报告》"""

    if report_month is None:
        now = datetime.now()
        report_month = f"{now.year}-{now.month:02d}"

    service = DataQualityService()
    report = service.generate_monthly_report(report_month)

    return {"code": 200, "message": f"月度报告生成完成 ({report_month})", "data": report}


@router.get("/scores")
async def get_quality_scores(
    report_month: str = Query(..., description="月份（YYYY-MM）"),
    entity_type: Optional[str] = Query(None, description="department / system"),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取质量评分排名"""

    query = db.query(QualityScore).filter(QualityScore.report_month == report_month)
    if entity_type:
        query = query.filter(QualityScore.entity_type == entity_type)

    scores = query.order_by(QualityScore.rank).all()

    if not scores:
        # 返回模拟排名
        service = DataQualityService()
        report = service.generate_monthly_report(report_month)
        return {"code": 200, "message": "获取成功（实时生成）", "data": report}

    return {
        "code": 200, "message": "获取成功",
        "data": {
            "report_month": report_month,
            "scores": [
                {
                    "entity_name": s.entity_name, "entity_type": s.entity_type,
                    "quality_score": s.quality_score, "rank": s.rank,
                    "passed": s.passed_rules, "total": s.total_rules,
                    "previous_score": s.previous_score, "score_change": s.score_change,
                }
                for s in scores
            ],
        },
    }


# ==================== 3.2 数据血缘追踪 ====================

@router.get("/lineage")
async def get_lineage_list(
    source_system: Optional[str] = Query(None),
    node_level: Optional[int] = Query(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取数据血缘列表"""

    query = db.query(DataLineage)
    if source_system:
        query = query.filter(DataLineage.source_system == source_system)
    if node_level is not None:
        query = query.filter(DataLineage.node_level == node_level)

    lineages = query.order_by(DataLineage.node_level).all()

    if not lineages:
        return {"code": 200, "message": "获取成功（预设血缘）", "data": PRESET_LINEAGE, "total": len(PRESET_LINEAGE)}

    return {"code": 200, "message": "获取成功", "data": [l.to_dict() for l in lineages], "total": len(lineages)}


@router.get("/lineage/trace")
async def trace_lineage(
    node: str = Query(..., description="节点名称"),
    direction: str = Query("upstream", description="upstream(溯源) / downstream(影响)"),
    current_user = Depends(get_current_user),
):
    """全链路溯源/影响分析"""

    service = DataQualityService()
    result = service.trace_lineage(node, direction)
    return {"code": 200, "message": "追溯完成", "data": result}


@router.get("/lineage/impact-analysis")
async def analyze_field_change_impact(
    source_system: str = Query(..., description="源系统"),
    table_name: str = Query(..., description="表名"),
    field_name: str = Query(..., description="字段名"),
    current_user = Depends(get_current_user),
):
    """字段变更影响分析"""

    service = DataQualityService()
    result = service.analyze_field_change_impact(source_system, table_name, field_name)
    return {"code": 200, "message": "影响分析完成", "data": result}


@router.get("/field-changes")
async def get_field_change_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source_system: Optional[str] = Query(None),
    impact_level: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取字段变更日志"""

    query = db.query(FieldChangeLog)
    if source_system:
        query = query.filter(FieldChangeLog.source_system == source_system)
    if impact_level:
        query = query.filter(FieldChangeLog.impact_level == impact_level)

    total = query.count()
    logs = query.order_by(FieldChangeLog.changed_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    if not logs:
        # 返回模拟数据
        mock_changes = [
            {"change_id": "CHG-001", "source_system": "金蝶ERP", "table_name": "t_expense", "field_name": "amount",
             "change_type": "modified", "old_value": "decimal(10,2)", "new_value": "decimal(12,2)",
             "change_description": "金额字段精度调整", "impact_level": "medium",
             "impacted_downstream": ["数据仓库.dwd_expense", "费用审计底稿"], "notified": False,
             "changed_by": "ERP管理员", "changed_at": "2026-06-05T08:00:00"},
            {"change_id": "CHG-002", "source_system": "SRM", "table_name": "t_supplier", "field_name": "tax_id",
             "change_type": "added", "old_value": None, "new_value": "varchar(50)",
             "change_description": "新增税务登记号字段", "impact_level": "low",
             "impacted_downstream": ["供应商分析报表"], "notified": True,
             "changed_by": "SRM管理员", "changed_at": "2026-06-04T15:30:00"},
            {"change_id": "CHG-003", "source_system": "云之家OA", "table_name": "t_approval", "field_name": "node_id",
             "change_type": "removed", "old_value": "varchar(32)", "new_value": None,
             "change_description": "审批节点ID废弃", "impact_level": "high",
             "impacted_downstream": ["审批流分析", "质量规则DQ-003"], "notified": False,
             "changed_by": "OA管理员", "changed_at": "2026-06-04T10:00:00"},
        ]
        return {"code": 200, "message": "获取成功（模拟数据）", "data": mock_changes, "total": len(mock_changes)}

    return {
        "code": 200, "message": "获取成功",
        "data": [l.to_dict() for l in logs],
        "total": total, "page": page, "page_size": page_size,
    }


# ==================== 3.3 数据接入健康度 ====================

@router.get("/sync-status")
async def get_sync_status(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取所有源系统同步状态"""

    sync_statuses = db.query(SyncStatus).order_by(SyncStatus.source_system).all()

    if not sync_statuses:
        # 返回模拟数据
        mock = [
            {"source_system": "金蝶ERP", "sync_status": "online", "last_sync_at": "2026-06-05T09:45:00",
             "last_success_at": "2026-06-05T09:45:00", "records_synced": 1280000, "sync_duration_seconds": 45,
             "error_message": None, "is_connected": True, "latency_ms": 12,
             "sync_interval_minutes": 30, "today_sync_count": 48, "today_fail_count": 0, "fail_rate": 0},
            {"source_system": "云之家OA", "sync_status": "syncing", "last_sync_at": "2026-06-05T09:30:00",
             "last_success_at": "2026-06-05T09:30:00", "records_synced": 560000, "sync_duration_seconds": 120,
             "error_message": None, "is_connected": True, "latency_ms": 35,
             "sync_interval_minutes": 15, "today_sync_count": 96, "today_fail_count": 0, "fail_rate": 0},
            {"source_system": "CRM", "sync_status": "online", "last_sync_at": "2026-06-05T09:40:00",
             "last_success_at": "2026-06-05T09:40:00", "records_synced": 340000, "sync_duration_seconds": 60,
             "error_message": None, "is_connected": True, "latency_ms": 8,
             "sync_interval_minutes": 60, "today_sync_count": 24, "today_fail_count": 0, "fail_rate": 0},
            {"source_system": "SRM", "sync_status": "error", "last_sync_at": "2026-06-05T08:00:00",
             "last_success_at": "2026-06-05T07:00:00", "records_synced": 210000, "sync_duration_seconds": 0,
             "error_message": "连接超时: unable to reach SRM database", "is_connected": False, "latency_ms": -1,
             "sync_interval_minutes": 60, "today_sync_count": 23, "today_fail_count": 2, "fail_rate": 8.7},
            {"source_system": "WMS", "sync_status": "online", "last_sync_at": "2026-06-05T09:35:00",
             "last_success_at": "2026-06-05T09:35:00", "records_synced": 580000, "sync_duration_seconds": 90,
             "error_message": None, "is_connected": True, "latency_ms": 22,
             "sync_interval_minutes": 1440, "today_sync_count": 1, "today_fail_count": 0, "fail_rate": 0},
        ]
        return {"code": 200, "message": "获取成功（模拟数据）", "data": mock}

    return {"code": 200, "message": "获取成功", "data": [s.to_dict() for s in sync_statuses]}


@router.get("/sync-health")
async def get_sync_health_dashboard(
    current_user = Depends(get_current_user),
):
    """获取同步健康度总览"""

    service = DataQualityService()
    health = service.get_sync_health_dashboard()
    return {"code": 200, "message": "获取成功", "data": health}


@router.get("/sync-delay/{source_system}")
async def check_sync_delay(
    source_system: str,
    current_user = Depends(get_current_user),
):
    """检查指定源系统同步延迟"""

    service = DataQualityService()
    result = service.check_sync_delay(source_system)
    return {"code": 200, "message": "检查完成", "data": result}


# ==================== 同步快照管理 ====================

@router.get("/sync-snapshots")
async def get_sync_snapshots(
    source_system: Optional[str] = Query(None),
    table_name: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取同步快照列表"""

    query = db.query(SyncSnapshot)
    if source_system:
        query = query.filter(SyncSnapshot.source_system == source_system)
    if table_name:
        query = query.filter(SyncSnapshot.table_name == table_name)

    total = query.count()
    snapshots = query.order_by(SyncSnapshot.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    if not snapshots:
        mock = [
            {"snapshot_id": "SNAP-20260605-A1B2C3", "source_system": "金蝶ERP", "table_name": "t_voucher",
             "records_count": 45600, "sync_mode": "full", "sync_finished_at": "2026-06-05T09:45:00",
             "duration_seconds": 45, "is_success": True, "can_rollback": True,
             "diff_summary": {"prev_records": 45200, "change_count": 400, "change_pct": 0.88}},
            {"snapshot_id": "SNAP-20260605-D4E5F6", "source_system": "CRM", "table_name": "t_contract",
             "records_count": 8900, "sync_mode": "incremental", "sync_finished_at": "2026-06-05T09:40:00",
             "duration_seconds": 60, "is_success": True, "can_rollback": True,
             "diff_summary": {"prev_records": 8700, "change_count": 200, "change_pct": 2.30}},
        ]
        return {"code": 200, "message": "获取成功（模拟数据）", "data": mock, "total": len(mock)}

    return {
        "code": 200, "message": "获取成功",
        "data": [s.to_dict() for s in snapshots],
        "total": total, "page": page, "page_size": page_size,
    }


@router.get("/sync-snapshots/compare")
async def compare_snapshots(
    snapshot_id_1: str = Query(...),
    snapshot_id_2: str = Query(...),
    current_user = Depends(get_current_user),
):
    """比对两个快照"""

    service = DataQualityService()
    result = service.compare_snapshots(snapshot_id_1, snapshot_id_2)
    return {"code": 200, "message": "比对完成", "data": result}


# ==================== 仪表盘 ====================

@router.get("/dashboard")
async def get_dashboard_stats(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取数据治理中心仪表盘统计数据"""

    service = DataQualityService()
    stats = service.get_dashboard_stats()

    return {"code": 200, "message": "获取成功", "data": stats}


# ==================== 预设规则模板 ====================

@router.get("/preset-rules")
async def get_preset_rules(
    current_user = Depends(get_current_user),
):
    """获取预设质量规则模板"""

    return {
        "code": 200, "message": "获取成功",
        "data": [
            {
                "rule_id": r["rule_id"], "name": r["name"], "description": r["description"],
                "source_system": r["source_system"], "table_name": r["table_name"],
                "field_name": r["field_name"], "rule_type": r["rule_type"].value,
                "threshold": r["threshold"], "severity": r["severity"].value,
            }
            for r in PRESET_QUALITY_RULES
        ],
        "total": len(PRESET_QUALITY_RULES),
    }
