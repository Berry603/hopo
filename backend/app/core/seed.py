"""
数据库种子数据
Database Seeding — RBAC 权限/角色、默认用户、ERP 示例数据
"""
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext
from loguru import logger

from app.core.database import SessionLocal
from app.models.user import User, UserRole
from app.models.rbac import Permission, Role, PRESET_PERMISSIONS, PRESET_ROLES, role_permission, user_role as user_role_table

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _now() -> datetime:
    return datetime.now()


def seed_rbac(db):
    """插入 26 个权限 + 4 个角色 + 关联"""
    # -- 权限 --
    existing = db.query(Permission).count()
    if existing > 0:
        logger.info(f"RBAC 权限已存在 ({existing} 条)，跳过种子数据")
        return

    perm_map: dict[str, Permission] = {}
    for code, info in PRESET_PERMISSIONS.items():
        perm = Permission(
            id=str(uuid.uuid4()),
            code=code,
            name=info["name"],
            category=info["category"],
            resource=info["resource"],
            action=info["action"],
            is_active=True,
        )
        db.add(perm)
        perm_map[code] = perm
    db.flush()
    logger.info(f"已插入 {len(perm_map)} 条权限")

    # -- 角色 --
    for r_data in PRESET_ROLES:
        role = Role(
            id=str(uuid.uuid4()),
            code=r_data["code"],
            name=r_data["name"],
            level=r_data["level"],
            data_scope=r_data["data_scope"],
            is_system=r_data["is_system"],
            is_active=True,
        )
        db.add(role)
        db.flush()

        for perm_code in r_data["permissions"]:
            p = perm_map.get(perm_code)
            if p:
                db.execute(
                    role_permission.insert().values(role_id=role.id, permission_id=p.id)
                )
    logger.info(f"已插入 {len(PRESET_ROLES)} 个角色及关联")


def seed_users(db):
    """插入默认管理员 + 示例用户"""
    existing = db.query(User).count()
    if existing > 0:
        logger.info(f"用户已存在 ({existing} 条)，跳过种子数据")
        return

    users = [
        {
            "username": "admin",
            "email": "admin@audit.com",
            "full_name": "系统管理员",
            "password": "admin123",
            "role": UserRole.SUPER_ADMIN,
            "is_superuser": True,
            "department": "审计部",
            "employee_id": "EMP-001",
        },
        {
            "username": "manager",
            "email": "manager@audit.com",
            "full_name": "张经理",
            "password": "manager123",
            "role": UserRole.AUDIT_MANAGER,
            "department": "审计部",
            "employee_id": "EMP-002",
        },
        {
            "username": "auditor",
            "email": "auditor@audit.com",
            "full_name": "李审计员",
            "password": "auditor123",
            "role": UserRole.AUDITOR,
            "department": "审计部",
            "employee_id": "EMP-003",
        },
        {
            "username": "viewer",
            "email": "viewer@audit.com",
            "full_name": "王观察员",
            "password": "viewer123",
            "role": UserRole.VIEWER,
            "department": "财务部",
            "employee_id": "EMP-004",
        },
    ]

    role_map = {r.code: r for r in db.query(Role).all()}

    for u_data in users:
        user = User(
            id=str(uuid.uuid4()),
            username=u_data["username"],
            email=u_data["email"],
            full_name=u_data["full_name"],
            hashed_password=pwd_context.hash(u_data["password"]),
            role=u_data["role"],
            is_superuser=u_data.get("is_superuser", False),
            is_active=True,
            department=u_data["department"],
            employee_id=u_data["employee_id"],
        )
        db.add(user)
        db.flush()

        # 绑定 RBAC 角色
        rbac_role_code = {
            "super_admin": "super_admin",
            "audit_manager": "audit_manager",
            "auditor": "auditor",
            "viewer": "viewer",
        }.get(u_data["role"].value, "viewer")

        rbac_role = role_map.get(rbac_role_code)
        if rbac_role:
            db.execute(
                user_role_table.insert().values(user_id=user.id, role_id=rbac_role.id)
            )

    logger.info(f"已插入 {len(users)} 个用户")


def seed_erp_sample_data(db):
    """插入 ERP 示例数据：凭证表 + 分录表 + 部门 + 供应商"""
    from app.models.risk import RiskAlert, RiskRule

    # 只在风险规则为空时插入示例数据（避免重复）
    rule_count = db.query(RiskRule).count()
    if rule_count > 0:
        logger.info(f"风险规则已存在 ({rule_count} 条)，跳过 ERP 种子数据")
        return

    # -- 预置 7 条风险规则 --
    preset_rules = [
        {"rule_id": "RISK-001", "name": "大额费用检测", "risk_type": "financial", "rule_type": "threshold",
         "conditions": {"table": "vouchers", "field": "amount", "operator": "gt", "value": 10000},
         "threshold": 70, "severity": "high", "description": "单笔费用超过10000元触发预警"},
        {"rule_id": "RISK-002", "name": "费用波动检测", "risk_type": "financial", "rule_type": "volatility",
         "conditions": {"field": "amount", "period": "month", "lookback": 6},
         "threshold": 50, "severity": "medium", "description": "当月费用偏离历史均值超过阈值"},
        {"rule_id": "RISK-003", "name": "空值率检测", "risk_type": "data_quality", "rule_type": "null_rate",
         "conditions": {"fields": ["voucher_no", "amount", "dept_code"], "max_null_rate": 0.05, "table": "vouchers"},
         "threshold": 60, "severity": "medium", "description": "必填字段空值率超过5%"},
        {"rule_id": "RISK-004", "name": "凭证分录一致性", "risk_type": "consistency", "rule_type": "consistency",
         "conditions": {"source_table": "vouchers", "target_table": "voucher_entries", "join": "voucher_id"},
         "threshold": 60, "severity": "high", "description": "凭证主表金额与分录合计不符"},
        {"rule_id": "RISK-005", "name": "供应商付款频率", "risk_type": "compliance", "rule_type": "frequency",
         "conditions": {"entity": "supplier", "max_count": 10, "window_days": 30},
         "threshold": 50, "severity": "medium", "description": "同供应商月付款超10次"},
        {"rule_id": "RISK-006", "name": "费用审计MECE规则", "risk_type": "financial", "rule_type": "expense_audit",
         "conditions": {"rules": {"min_expense_amount": 10000, "round_threshold": 5000, "max_modify_count": 3}},
         "threshold": 50, "severity": "high", "description": "费用科目分类+交叉验证"},
        {"rule_id": "RISK-007", "name": "通用SQL条件检测", "risk_type": "custom", "rule_type": "generic",
         "conditions": {"table": "vouchers", "where": "amount > 50000", "group": "dept_code"},
         "threshold": 40, "severity": "low", "description": "用户自定义SQL条件"},
    ]
    for r_data in preset_rules:
        rule = RiskRule(
            id=str(uuid.uuid4()),
            rule_id=r_data["rule_id"],
            name=r_data["name"],
            risk_type=r_data["risk_type"],
            rule_type=r_data["rule_type"],
            conditions=r_data["conditions"],
            threshold=r_data["threshold"],
            severity=r_data["severity"],
            description=r_data["description"],
            is_active="1",
            created_at=_now(),
        )
        db.add(rule)
    db.flush()
    logger.info(f"已插入 {len(preset_rules)} 条预设风险规则")


def seed_risk_alerts(db):
    """插入 15 条示例风险预警（幂等）"""
    from app.models.risk import RiskAlert as RiskAlertModel, RiskType, SeverityLevel, AlertStatus
    from app.models.risk import RiskRule as RiskRuleModel

    existing = db.query(RiskAlertModel).count()
    if existing > 0:
        logger.info(f"风险预警已存在 ({existing} 条)，跳过种子数据")
        return

    rules = db.query(RiskRuleModel).all()
    if not rules:
        logger.warning("无风险规则，跳过预警种子数据")
        return

    sample_alerts = [
        {"alert_id": "ALT-20260611-001", "title": "采购单PO-202606-0034单价偏离市场价超30%", "risk_type": "procurement", "severity": "high", "dept": "采购部", "amount": 128000},
        {"alert_id": "ALT-20260611-002", "title": "行政部差旅费单笔超5000元未附审批单", "risk_type": "financial", "severity": "medium", "dept": "行政部", "amount": 6800},
        {"alert_id": "ALT-20260611-003", "title": "应收款超期90天未收回——客户A", "risk_type": "financial", "severity": "high", "dept": "财务部", "amount": 256000},
        {"alert_id": "ALT-20260611-004", "title": "固定资产折旧异常：使用年限变更未审批", "risk_type": "operational", "severity": "low", "dept": "生产部", "amount": 0},
        {"alert_id": "ALT-20260611-005", "title": "付款审批缺少二级审核（金额>5万）", "risk_type": "compliance", "severity": "high", "dept": "财务部", "amount": 78000},
        {"alert_id": "ALT-20260611-006", "title": "发票与入库单金额差异率8.5%——供应商B", "risk_type": "procurement", "severity": "medium", "dept": "仓储部", "amount": 3200},
        {"alert_id": "ALT-20260611-007", "title": "员工报销发票连续编号异常（疑似拆分报销）", "risk_type": "compliance", "severity": "medium", "dept": "销售部", "amount": 12000},
        {"alert_id": "ALT-20260611-008", "title": "供应商C付款频率异常：30天内付款15次", "risk_type": "procurement", "severity": "high", "dept": "采购部", "amount": 450000},
        {"alert_id": "ALT-20260611-009", "title": "年末大额资产转让未评估——设备D", "risk_type": "operational", "severity": "high", "dept": "生产部", "amount": 3200000},
        {"alert_id": "ALT-20260611-010", "title": "费用报销跨期入账：Q4费用计入Q1", "risk_type": "financial", "severity": "medium", "dept": "财务部", "amount": 86000},
        {"alert_id": "ALT-20260611-011", "title": "销售返利核算方式变更未披露", "risk_type": "financial", "severity": "high", "dept": "销售部", "amount": 2300000},
        {"alert_id": "ALT-20260611-012", "title": "仓库盘点差异率超3%未查明原因", "risk_type": "operational", "severity": "medium", "dept": "仓储部", "amount": 780000},
        {"alert_id": "ALT-20260611-013", "title": "工程项目预算追加未经董事会批准", "risk_type": "compliance", "severity": "high", "dept": "生产部", "amount": 5000000},
        {"alert_id": "ALT-20260611-014", "title": "关联方采购未进行公允价值评估", "risk_type": "procurement", "severity": "high", "dept": "采购部", "amount": 1350000},
        {"alert_id": "ALT-20260611-015", "title": "薪资发放与个税申报金额不一致", "risk_type": "compliance", "severity": "medium", "dept": "财务部", "amount": 45000},
    ]

    for i, a_data in enumerate(sample_alerts):
        rule = rules[i % len(rules)]
        risk_type_enum = next((rt for rt in RiskType if rt.value == a_data["risk_type"]), RiskType.FINANCIAL)
        sev_enum = next((s for s in SeverityLevel if s.value == a_data["severity"]), SeverityLevel.MEDIUM)

        alert = RiskAlertModel(
            id=str(uuid.uuid4()),
            alert_id=a_data["alert_id"],
            rule_id=rule.id,
            risk_type=risk_type_enum,
            severity=sev_enum,
            title=a_data["title"],
            description=a_data["title"],
            dept_name=a_data["dept"],
            status=AlertStatus.OPEN,
            detail_data={"amount": a_data["amount"], "dept": a_data["dept"]},
            alert_time=_now() - timedelta(hours=i * 2),
            created_at=_now(),
        )
        db.add(alert)

    db.flush()
    logger.info(f"已插入 {len(sample_alerts)} 条示例风险预警")


def seed_audit_projects(db):
    """插入示例审计项目（供审计发现关联使用）"""
    from app.models.audit_project import AuditProject, AuditType, AuditPhase, ProjectStatus

    existing = db.query(AuditProject).count()
    if existing > 0:
        logger.info(f"审计项目已存在 ({existing} 个)，跳过种子")
        return

    # 找到管理员用户作为项目经理
    admin = db.query(User).filter(User.username == "admin").first()
    admin_id = admin.id if admin else None

    projects = [
        AuditProject(
            id=str(uuid.uuid4()),
            project_code="AP-2026-001",
            project_name="2026年Q2采购专项审计",
            audit_type=AuditType.COMPLIANCE,
            current_phase=AuditPhase.FIELD_WORK,
            status=ProjectStatus.IN_PROGRESS,
            target_dept_code="PUR",
            target_dept_name="采购部",
            start_date=datetime.now().date(),
            end_date=(datetime.now() + timedelta(days=60)).date(),
            project_manager_id=admin_id,
            created_by_id=admin_id,
            audit_objective="审查采购流程合规性，评估供应商管理有效性",
            audit_scope="2026年Q2全部采购订单及合同",
            audit_criteria="《企业内部控制基本规范》《采购管理办法》",
            created_at=datetime.now(),
        ),
        AuditProject(
            id=str(uuid.uuid4()),
            project_code="AP-2026-002",
            project_name="2026年H1财务收支审计",
            audit_type=AuditType.FINANCIAL,
            current_phase=AuditPhase.DATA_COLLECTION,
            status=ProjectStatus.IN_PROGRESS,
            target_dept_code="FIN",
            target_dept_name="财务部",
            start_date=(datetime.now() - timedelta(days=30)).date(),
            end_date=(datetime.now() + timedelta(days=90)).date(),
            project_manager_id=admin_id,
            created_by_id=admin_id,
            audit_objective="审查财务收支的真实性、完整性和合规性",
            audit_scope="2026年1月-6月全部财务凭证及报表",
            audit_criteria="《企业会计准则》《财务管理制度》",
            created_at=datetime.now() - timedelta(days=30),
        ),
        AuditProject(
            id=str(uuid.uuid4()),
            project_code="AP-2026-003",
            project_name="2026年销售费用专项审计",
            audit_type=AuditType.SPECIAL,
            current_phase=AuditPhase.PLANNING,
            status=ProjectStatus.IN_PROGRESS,
            target_dept_code="SAL",
            target_dept_name="销售部",
            start_date=(datetime.now() + timedelta(days=7)).date(),
            end_date=(datetime.now() + timedelta(days=67)).date(),
            project_manager_id=admin_id,
            created_by_id=admin_id,
            audit_objective="审查销售费用报销的真实性及预算执行情况",
            audit_scope="2026年Q1-Q2销售费用凭证",
            audit_criteria="《销售费用管理办法》《八项规定》",
            created_at=datetime.now(),
        ),
    ]
    for p in projects:
        db.add(p)
    db.commit()
    logger.info(f"已插入 {len(projects)} 个示例审计项目")


def seed_all():
    """执行全部种子数据填充（幂等）"""
    db = SessionLocal()
    try:
        seed_rbac(db)
        seed_users(db)
        seed_erp_sample_data(db)
        seed_risk_alerts(db)
        seed_audit_projects(db)
        db.commit()
        logger.info("种子数据填充完成")
    except Exception as e:
        db.rollback()
        logger.warning(f"种子数据填充失败（可能已存在或数据库未就绪）: {e}")
    finally:
        db.close()
