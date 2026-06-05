"""
风险规则引擎服务
Risk Engine Service

规则评估 → 风险扫描 → 预警生成
"""
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from decimal import Decimal
from loguru import logger

from app.core.database import SessionLocal
from app.models.risk import RiskRule, RiskAlert, RiskType, SeverityLevel, AlertStatus, RuleType


class RiskEngineService:
    """
    风险规则引擎

    工作流:
    1. 加载活跃规则
    2. 按规则类型分发到对应评估器
    3. 结果超过阈值 → 生成RiskAlert
    """

    # 规则类型 → 评估器映射
    EVALUATORS = {}

    def __init__(self):
        self.db = SessionLocal()

    def run_all_rules(self) -> List[Dict]:
        """执行所有活跃规则的扫描"""
        rules = self.db.query(RiskRule).filter(RiskRule.is_active == "1").all()
        logger.info(f"[风险引擎] 加载 {len(rules)} 条活跃规则")

        all_alerts = []
        for rule in rules:
            try:
                alerts = self._evaluate_rule(rule)
                for detail in alerts:
                    alert = self._create_alert(rule, detail)
                    all_alerts.append(alert)
            except Exception as e:
                logger.error(f"[风险引擎] 规则 {rule.rule_id} 执行失败: {e}")

        self.db.commit()
        logger.info(f"[风险引擎] 扫描完成: 生成 {len(all_alerts)} 条预警")
        return all_alerts

    def run_rule(self, rule_id: str) -> List[Dict]:
        """执行单条规则"""
        rule = self.db.query(RiskRule).filter(RiskRule.id == rule_id).first()
        if not rule:
            raise ValueError(f"规则不存在: {rule_id}")

        alerts_details = self._evaluate_rule(rule)
        alerts = []
        for detail in alerts_details:
            alert = self._create_alert(rule, detail)
            alerts.append(alert)
        
        self.db.commit()
        return alerts

    # -- 规则评估 --

    def _evaluate_rule(self, rule: RiskRule) -> List[Dict]:
        """评估单条规则，返回符合预警条件的记录"""
        evaluator = self.EVALUATORS.get(rule.rule_type.value, self._evaluate_generic)
        conditions = rule.conditions or {}
        threshold = rule.threshold or 0

        results = evaluator(conditions, threshold)
        
        # 过滤：只保留达到阈值的结果
        alerts = []
        for result in results:
            score = result.get("score", 0)
            if score >= threshold:
                alerts.append({
                    "title": f"[{rule.risk_type.value}] {rule.name}",
                    "description": result.get("description", ""),
                    "severity": self._calc_severity(score, threshold),
                    "detail_data": result,
                    "dept_code": result.get("dept_code"),
                    "dept_name": result.get("dept_name"),
                    "score": score,
                })
        
        return alerts

    def _evaluate_generic(self, conditions: Dict, threshold: float) -> List[Dict]:
        """通用规则评估器（基于SQL条件）"""
        # 实际环境：根据conditions构建SQL查询
        # conditions格式: {"table": "t_voucher", "where": "amount > 100000", "group": "dept_code"}
        logger.debug(f"[风险引擎] 通用评估: {conditions}")
        return []

    # -- 专项评估器 --

    @staticmethod
    def evaluate_threshold(conditions: Dict, threshold: float) -> List[Dict]:
        """
        阈值检测:
        单字段值超过预设阈值 → 预警
        
        Example: 单笔报销金额 > 5000
        """
        field = conditions.get("field", "amount")
        operator = conditions.get("operator", "gt")
        value = float(conditions.get("value", 0))
        table = conditions.get("table", "")

        # 实际环境：SELECT * FROM table WHERE {field} {operator} {value}
        logger.info(f"[风险引擎] 阈值检测: {table}.{field} {operator} {value}")
        return []

    @staticmethod
    def evaluate_volatility(conditions: Dict, threshold: float) -> List[Dict]:
        """
        波动检测:
        本期数据 vs 历史均值 波动超过阈值
        
        公式: |本期 - 均值| / 均值 > threshold
        """
        field = conditions.get("field", "amount")
        period_field = conditions.get("period", "month")
        lookback = conditions.get("lookback", 6)  # 回溯期数
        
        logger.info(f"[风险引擎] 波动检测: {field} 回溯{lookback}期")
        return []

    @staticmethod
    def evaluate_null_rate(conditions: Dict, threshold: float) -> List[Dict]:
        """
        空值率检测:
        NULL值占比超过阈值
        
        Example: 凭证必填字段空值率 > 5%
        """
        fields = conditions.get("fields", [])
        max_null_rate = float(conditions.get("max_null_rate", 0.05))
        table = conditions.get("table", "")

        logger.info(f"[风险引擎] 空值率检测: {table}.{fields} > {max_null_rate}")
        return []

    @staticmethod
    def evaluate_consistency(conditions: Dict, threshold: float) -> List[Dict]:
        """
        一致性校验:
        关联表之间存在数据不一致
        
        Example: 凭证合计金额 ≠ 分录金额之和
        """
        source_table = conditions.get("source_table", "")
        target_table = conditions.get("target_table", "")
        join_condition = conditions.get("join", "")

        logger.info(f"[风险引擎] 一致性校验: {source_table} ↔ {target_table}")
        return []

    @staticmethod
    def evaluate_frequency(conditions: Dict, threshold: float) -> List[Dict]:
        """
        频率异常检测:
        特定模式出现频率异常
        
        Example: 同一供应商单月付款次数 > 10
        """
        entity = conditions.get("entity", "supplier")
        max_count = int(conditions.get("max_count", 10))
        window_days = int(conditions.get("window_days", 30))

        logger.info(f"[风险引擎] 频率检测: {entity} > {max_count}次/{window_days}天")
        return []

    # -- 费用审计专有规则 --

    @staticmethod
    def evaluate_expense_audit(conditions: Dict, threshold: float) -> List[Dict]:
        """
        MECE费用审计规则（V3升级版）:
        
        分类规则:
        - 资金类科目 (1001-1012): 正常
        - 往来类科目 (1122-1221): 关注
        - 资产类科目 (1601-1801): 异常
        - 费用类科目 (6601-6603): 异常
        
        交叉验证:
        - 费用科目计入往来 → 高风险
        - 同一凭证多次修改 → 中风险
        - 大额整数金额 → 关注
        """
        # 科目分类
        FUND_ACCOUNTS = range(1001, 1013)      # 资金类
        ARAP_ACCOUNTS = range(1122, 1222)       # 往来类
        ASSET_ACCOUNTS = range(1601, 1802)      # 资产类
        EXPENSE_ACCOUNTS = range(6601, 6604)    # 费用类
        
        rules_config = conditions.get("rules", {})
        results = []
        
        # 规则1: 费用科目金额异常
        min_amount = rules_config.get("min_expense_amount", 10000)
        # 实际环境: SELECT * FROM t_voucher_entry WHERE acct_code LIKE '660%' AND amount > min_amount
        
        # 规则2: 整数金额异常
        round_threshold = rules_config.get("round_threshold", 5000)
        # 实际环境: SELECT * FROM t_voucher_entry WHERE amount > round_threshold AND amount % 1000 = 0
        
        # 规则3: 凭证修改次数异常
        max_modify = rules_config.get("max_modify_count", 3)
        # 实际环境: SELECT * FROM t_voucher WHERE modify_count > max_modify
        
        logger.info(f"[风险引擎] 费用审计MECE规则: {len(results)}条异常")
        return results

    # -- 注册评估器 --
    EVALUATORS = {
        RuleType.NULL_RATE.value: evaluate_null_rate.__func__,
        RuleType.OUTLIER.value: evaluate_threshold.__func__,
        RuleType.CONSISTENCY.value: evaluate_consistency.__func__,
        RuleType.VOLATILITY.value: evaluate_volatility.__func__,
        "frequency": evaluate_frequency.__func__,
        "expense_audit": evaluate_expense_audit.__func__,
    }

    # -- 预警生成 --

    def _create_alert(self, rule: RiskRule, detail: Dict) -> Dict:
        """基于规则和检测结果创建RiskAlert记录"""
        alert_id = f"RA-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        
        alert = RiskAlert(
            alert_id=alert_id,
            rule_id=rule.id,
            risk_type=rule.risk_type,
            severity=detail.get("severity", rule.severity.value),
            title=detail.get("title", rule.name),
            description=detail.get("description", ""),
            dept_code=detail.get("dept_code"),
            dept_name=detail.get("dept_name"),
            detail_data=detail.get("detail_data"),
            status=AlertStatus.OPEN,
            alert_time=datetime.now(),
        )
        
        self.db.add(alert)
        
        return {
            "alert_id": alert_id,
            "title": alert.title,
            "severity": alert.severity.value,
            "dept_name": alert.dept_name,
        }

    @staticmethod
    def _calc_severity(score: float, threshold: float) -> str:
        """根据分数计算严重程度"""
        if threshold <= 0:
            return SeverityLevel.LOW.value
        ratio = score / threshold
        if ratio >= 5:
            return SeverityLevel.HIGH.value
        elif ratio >= 2:
            return SeverityLevel.MEDIUM.value
        else:
            return SeverityLevel.LOW.value


# -- 预设风险规则模板 --

PRESET_RISK_RULES = [
    {
        "rule_id": "RISK-001",
        "name": "大额费用异常检测",
        "description": "单笔费用报销金额超过阈值（默认10000元）",
        "risk_type": RiskType.FINANCIAL,
        "severity": SeverityLevel.HIGH,
        "rule_type": RuleType.OUTLIER,
        "conditions": {
            "table": "t_expense",
            "field": "amount",
            "operator": "gt",
            "value": 10000,
        },
        "threshold": 1,
    },
    {
        "rule_id": "RISK-002",
        "name": "凭证必填字段空值检查",
        "description": "凭证关键字段（摘要、金额、科目）空值率超过5%",
        "risk_type": RiskType.COMPLIANCE,
        "severity": SeverityLevel.MEDIUM,
        "rule_type": RuleType.NULL_RATE,
        "conditions": {
            "table": "t_voucher",
            "fields": ["summary", "amount", "acct_code"],
            "max_null_rate": 0.05,
        },
        "threshold": 0.05,
    },
    {
        "rule_id": "RISK-003",
        "name": "凭证金额一致性校验",
        "description": "凭证合计金额与分录明细金额之和不一致",
        "risk_type": RiskType.FINANCIAL,
        "severity": SeverityLevel.HIGH,
        "rule_type": RuleType.CONSISTENCY,
        "conditions": {
            "source_table": "t_voucher",
            "target_table": "t_voucher_entry",
            "join": "voucher_id",
        },
        "threshold": 0,
    },
    {
        "rule_id": "RISK-004",
        "name": "月度费用波动异常",
        "description": "当月费用支出与近6个月均值偏差超过30%",
        "risk_type": RiskType.FINANCIAL,
        "severity": SeverityLevel.MEDIUM,
        "rule_type": RuleType.VOLATILITY,
        "conditions": {
            "field": "amount",
            "period": "month",
            "lookback": 6,
            "max_deviation": 0.30,
        },
        "threshold": 0.30,
    },
    {
        "rule_id": "RISK-005",
        "name": "同供应商高频付款",
        "description": "30天内同一供应商付款次数超过10次",
        "risk_type": RiskType.PROCUREMENT,
        "severity": SeverityLevel.MEDIUM,
        "rule_type": "frequency",
        "conditions": {
            "entity": "supplier",
            "max_count": 10,
            "window_days": 30,
        },
        "threshold": 10,
    },
    {
        "rule_id": "RISK-006",
        "name": "凭证反复修改异常",
        "description": "同一凭证被修改超过3次",
        "risk_type": RiskType.COMPLIANCE,
        "severity": SeverityLevel.LOW,
        "rule_type": "frequency",
        "conditions": {
            "entity": "voucher",
            "max_count": 3,
            "field": "modify_count",
        },
        "threshold": 3,
    },
    {
        "rule_id": "RISK-007",
        "name": "整数金额费用检测",
        "description": "报销金额为整数且超过5000元",
        "risk_type": RiskType.FINANCIAL,
        "severity": SeverityLevel.LOW,
        "rule_type": "expense_audit",
        "conditions": {
            "rules": {
                "round_threshold": 5000,
                "max_modify_count": 3,
                "min_expense_amount": 10000,
            }
        },
        "threshold": 1,
    },
]
