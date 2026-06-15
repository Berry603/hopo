"""
风险规则引擎服务
Risk Engine Service

规则评估 → 风险扫描 → 预警生成
"""
import uuid
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from decimal import Decimal
from loguru import logger

from sqlalchemy import text
from app.core.database import SessionLocal
from app.models.risk import RiskRule, RiskAlert, RiskType, SeverityLevel, AlertStatus, RuleType


# 允许查询的表名白名单（防SQL注入）
_ALLOWED_TABLES = {
    "risk_rules", "risk_alerts",
    "audit_projects", "audit_findings", "audit_tasks", "audit_worksheets",
    "rectification_orders", "rectification_evidences",
    "users",
}

# 合法标识符正则（仅允许字母、数字、下划线，不能以数字开头）
_IDENTIFIER_RE = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')


def _safe_table(table_name: str, default: str = "risk_alerts") -> str:
    """校验表名，不在白名单则返回默认值"""
    if table_name in _ALLOWED_TABLES:
        return table_name
    logger.warning(f"[风险引擎] 表名不在白名单: {table_name}, 回退到 {default}")
    return default


def _safe_field(field_name: str, default: str = "id") -> str:
    """校验字段名，格式不合法则返回默认值"""
    if _IDENTIFIER_RE.match(str(field_name)):
        return field_name
    logger.warning(f"[风险引擎] 字段名无效: {field_name}, 回退到 {default}")
    return default


def _row_to_dict(row, columns) -> Dict:
    """将数据库行转为字典"""
    return dict(zip(columns, row))


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
        """
        通用规则评估器（基于SQL条件动态查询）

        conditions支持两种格式:
        1. 直接SQL: {"table": "risk_alerts", "where": "severity = 'high'", "group": "dept_code"}
        2. 字段条件: {"table": "audit_findings", "field": "risk_score", "operator": "gt", "value": 5}
        """
        db = SessionLocal()
        try:
            table = _safe_table(conditions.get("table", "risk_alerts"))

            # 构建WHERE子句
            where_clause = conditions.get("where")
            if not where_clause:
                # 从 field/operator/value 格式构建
                field = _safe_field(conditions.get("field", "id"), "id")
                operator = conditions.get("operator", "gt")
                value = conditions.get("value", 0)
                op_map = {"gt": ">", "gte": ">=", "lt": "<", "lte": "<=", "eq": "=", "ne": "!="}
                sql_op = op_map.get(operator, ">")
                where_clause = f"{field} {sql_op} :where_val"

            group_by = conditions.get("group")
            order_by = conditions.get("order")
            limit = int(conditions.get("limit", 100))

            sql_parts = [f"SELECT * FROM {table} WHERE {where_clause}"]
            params = {}
            if "where_val" in where_clause:
                params["where_val"] = conditions.get("value", 0)
            if group_by:
                gp = _safe_field(str(group_by), "dept_code")
                sql_parts.append(f"GROUP BY {gp}")
            if order_by:
                ob = _safe_field(str(order_by), "id")
                sql_parts.append(f"ORDER BY {ob} DESC")
            sql_parts.append(f"LIMIT :limit")
            params["limit"] = limit

            sql = text(" ".join(sql_parts))
            result = db.execute(sql, params)
            rows = result.fetchall()
            columns = list(result.keys())

            results = []
            for row in rows:
                row_dict = _row_to_dict(row, columns)
                results.append({
                    "score": float(threshold) if threshold > 0 else 50.0,
                    "description": f"通用规则命中: {table}",
                    "dept_code": row_dict.get("dept_code", row_dict.get("target_dept_code", "N/A")),
                    "dept_name": row_dict.get("dept_name", row_dict.get("target_dept_name", "N/A")),
                    "raw_data": {str(k): str(v) for k, v in row_dict.items() if k in columns[:10]},
                })

            logger.info(f"[风险引擎] 通用评估: {table} 返回 {len(results)} 条")
            return results
        except Exception as e:
            logger.warning(f"[风险引擎] 通用评估失败: {e}")
            return []
        finally:
            db.close()

    # -- 专项评估器 --

    @staticmethod
    def evaluate_threshold(conditions: Dict, threshold: float) -> List[Dict]:
        """
        阈值检测:
        查询指定表的字段值超过预设阈值，返回超标记录

        conditions:
          table  - 表名 (默认 audit_findings)
          field  - 字段名 (默认 risk_score)
          operator - 比较运算符 (默认 gt, 支持 gt/gte/lt/lte/eq)
          value  - 阈值
        """
        db = SessionLocal()
        try:
            field = _safe_field(conditions.get("field", "risk_score"), "risk_score")
            operator = conditions.get("operator", "gt")
            value = float(conditions.get("value", 0))
            table = _safe_table(conditions.get("table", ""), "audit_findings")

            op_map = {"gt": ">", "gte": ">=", "lt": "<", "lte": "<=", "eq": "=", "ne": "!="}
            sql_op = op_map.get(operator, ">")

            sql = text(f"SELECT * FROM {table} WHERE {field} {sql_op} :val LIMIT 100")
            result = db.execute(sql, {"val": value})
            rows = result.fetchall()
            columns = list(result.keys())

            results = []
            for row in rows:
                row_dict = _row_to_dict(row, columns)
                actual_val = float(row_dict.get(field, 0) or 0)
                score = min(100.0, (actual_val / value) * 100.0) if value > 0 else 0.0
                results.append({
                    "score": score,
                    "description": f"{table}.{field}={actual_val} {sql_op} {value}",
                    "dept_code": row_dict.get("dept_code",
                                              row_dict.get("target_dept_code",
                                              row_dict.get("responsible_dept", "N/A"))),
                    "dept_name": row_dict.get("dept_name",
                                              row_dict.get("target_dept_name",
                                              row_dict.get("responsible_dept", "N/A"))),
                })

            logger.info(f"[风险引擎] 阈值检测: {table}.{field} {sql_op} {value} -> {len(results)} 条")
            return results
        except Exception as e:
            logger.warning(f"[风险引擎] 阈值检测失败: {e}")
            return []
        finally:
            db.close()

    @staticmethod
    def evaluate_volatility(conditions: Dict, threshold: float) -> List[Dict]:
        """
        波动检测:
        比较当前周期的记录数/均值与历史周期的偏差

        conditions:
          table     - 表名 (默认 risk_alerts)
          field     - 用于计算均值的数值字段 (默认 risk_score)
          lookback  - 回溯期数（月）(默认 6)
          max_deviation - 允许的最大偏差比例 (默认取 threshold)
        """
        db = SessionLocal()
        try:
            field = _safe_field(conditions.get("field", "risk_score"), "risk_score")
            table = _safe_table(conditions.get("table", ""), "risk_alerts")
            lookback = max(1, int(conditions.get("lookback", 6)))
            max_deviation = float(conditions.get("max_deviation", threshold if threshold > 0 else 0.30))

            now = datetime.now()
            current_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            history_start = (current_start - timedelta(days=lookback * 31)).replace(day=1)

            # 本周期统计
            cur_sql = text(
                f"SELECT COUNT(*) as cnt FROM {table} WHERE created_at >= :cs"
            )
            cur_row = db.execute(cur_sql, {"cs": current_start}).fetchone()
            current_count = cur_row[0] if cur_row else 0

            # 历史周期统计
            hist_sql = text(
                f"SELECT COUNT(*) as cnt FROM {table} "
                f"WHERE created_at >= :hs AND created_at < :cs"
            )
            hist_row = db.execute(hist_sql, {"hs": history_start, "cs": current_start}).fetchone()
            history_count = hist_row[0] if hist_row else 0

            history_avg_per_period = history_count / lookback if history_count > 0 else 1.0

            results = []
            if history_avg_per_period > 0:
                deviation = abs(current_count - history_avg_per_period) / history_avg_per_period
                if deviation > max_deviation:
                    score = min(100.0, (deviation / max(max_deviation, 0.01)) * 100.0)
                    results.append({
                        "score": score,
                        "description": (
                            f"{table} 本期记录={current_count}, "
                            f"历史均值={history_avg_per_period:.1f}/期(回溯{lookback}月), "
                            f"偏差={deviation:.1%}, 阈值={max_deviation:.1%}"
                        ),
                        "dept_code": "N/A",
                        "dept_name": "N/A",
                    })

            logger.info(
                f"[风险引擎] 波动检测: {table} 本期{current_count} vs "
                f"历史均值{history_avg_per_period:.1f} -> {len(results)} 条异常"
            )
            return results
        except Exception as e:
            logger.warning(f"[风险引擎] 波动检测失败: {e}")
            return []
        finally:
            db.close()

    @staticmethod
    def evaluate_null_rate(conditions: Dict, threshold: float) -> List[Dict]:
        """
        空值率检测:
        统计指定字段的NULL/空字符串占比，超过阈值则预警

        conditions:
          table  - 表名 (默认 risk_alerts)
          fields - 要检查的字段列表 (默认 ["dept_code"])
          max_null_rate - 允许的最大空值率 (默认取 threshold)
        """
        db = SessionLocal()
        try:
            fields = conditions.get("fields", ["dept_code"])
            if isinstance(fields, str):
                fields = [fields]
            max_null_rate = float(conditions.get("max_null_rate", threshold if threshold > 0 else 0.05))
            table = _safe_table(conditions.get("table", ""), "risk_alerts")

            results = []
            for field in fields:
                fname = _safe_field(str(field), "dept_code")

                sql = text(
                    f"SELECT COUNT(*) as total, "
                    f"SUM(CASE WHEN {fname} IS NULL OR {fname} = '' THEN 1 ELSE 0 END) as nulls "
                    f"FROM {table}"
                )
                row = db.execute(sql).fetchone()
                if not row:
                    continue

                total = row[0] if row[0] is not None else 0
                nulls = row[1] if row[1] is not None else 0

                if total > 0:
                    null_rate = nulls / total
                    if null_rate > max_null_rate:
                        score = min(100.0, (null_rate / max(max_null_rate, 0.001)) * 100.0)
                        results.append({
                            "score": score,
                            "description": (
                                f"{table}.{fname} 空值率={null_rate:.2%} "
                                f"(null={nulls}, total={total}), 阈值={max_null_rate:.2%}"
                            ),
                            "dept_code": "N/A",
                            "dept_name": "N/A",
                        })

            logger.info(
                f"[风险引擎] 空值率检测: {table}.{fields} 阈值>{max_null_rate:.2%} "
                f"-> {len(results)} 条异常"
            )
            return results
        except Exception as e:
            logger.warning(f"[风险引擎] 空值率检测失败: {e}")
            return []
        finally:
            db.close()

    @staticmethod
    def evaluate_consistency(conditions: Dict, threshold: float) -> List[Dict]:
        """
        一致性校验:
        检查两张关联表之间是否存在孤儿记录（源表外键在目标表中无匹配）

        conditions:
          source_table - 源表 (默认 audit_worksheets)
          target_table - 目标表 (默认 audit_findings)
          join         - 关联字段 (默认 finding_id)
        """
        db = SessionLocal()
        try:
            source_table = _safe_table(conditions.get("source_table", ""), "audit_worksheets")
            target_table = _safe_table(conditions.get("target_table", ""), "audit_findings")
            join_field = _safe_field(conditions.get("join", "finding_id"), "finding_id")

            # 统计孤儿记录: 源表有外键值但目标表无对应主键
            mismatch_sql = text(
                f"SELECT COUNT(*) as cnt FROM {source_table} s "
                f"LEFT JOIN {target_table} t ON s.{join_field} = t.{join_field} "
                f"WHERE s.{join_field} IS NOT NULL AND s.{join_field} != '' AND t.{join_field} IS NULL"
            )
            mismatch_row = db.execute(mismatch_sql).fetchone()
            mismatch_count = mismatch_row[0] if mismatch_row else 0

            # 源表有效外键总数
            total_sql = text(
                f"SELECT COUNT(*) as cnt FROM {source_table} "
                f"WHERE {join_field} IS NOT NULL AND {join_field} != ''"
            )
            total_row = db.execute(total_sql).fetchone()
            total_count = total_row[0] if total_row else 0

            results = []
            if total_count > 0 and mismatch_count > 0:
                mismatch_rate = mismatch_count / total_count
                # 50%不一致 = 100分
                score = min(100.0, mismatch_rate * 200.0)
                results.append({
                    "score": score,
                    "description": (
                        f"一致性异常: {source_table}.{join_field} -> {target_table}.{join_field}, "
                        f"不匹配={mismatch_count}/{total_count} ({mismatch_rate:.2%})"
                    ),
                    "dept_code": "N/A",
                    "dept_name": "N/A",
                })

            logger.info(
                f"[风险引擎] 一致性校验: {source_table}<-{join_field}->{target_table} "
                f"不匹配{mismatch_count}/{total_count}"
            )
            return results
        except Exception as e:
            logger.warning(f"[风险引擎] 一致性校验失败: {e}")
            return []
        finally:
            db.close()

    @staticmethod
    def evaluate_frequency(conditions: Dict, threshold: float) -> List[Dict]:
        """
        频率异常检测:
        在指定时间窗口内，按实体分组统计出现次数，超过上限则预警

        conditions:
          entity      - 分组字段/实体标识 (默认 dept_code)
          max_count   - 允许的最大出现次数 (默认取 threshold)
          window_days - 时间窗口天数 (默认 30)
          table       - 查询表名 (默认 risk_alerts)
        """
        db = SessionLocal()
        try:
            entity = _safe_field(conditions.get("entity", "dept_code"), "dept_code")
            max_count = int(conditions.get("max_count", threshold if threshold > 0 else 10))
            window_days = int(conditions.get("window_days", 30))
            table = _safe_table(conditions.get("table", ""), "risk_alerts")

            cutoff_date = datetime.now() - timedelta(days=window_days)

            sql = text(
                f"SELECT {entity}, COUNT(*) as cnt "
                f"FROM {table} "
                f"WHERE created_at >= :cutoff "
                f"GROUP BY {entity} "
                f"HAVING COUNT(*) > :max_count "
                f"ORDER BY cnt DESC "
                f"LIMIT 50"
            )
            result = db.execute(sql, {"cutoff": cutoff_date, "max_count": max_count})
            rows = result.fetchall()
            columns = list(result.keys())

            results = []
            for row in rows:
                row_dict = _row_to_dict(row, columns)
                entity_val = row_dict.get(entity, "N/A")
                cnt = int(row_dict.get("cnt", 0))
                score = min(100.0, (cnt / max_count) * 100.0) if max_count > 0 else 0.0
                results.append({
                    "score": score,
                    "description": (
                        f"{table}中{entity}='{entity_val}' "
                        f"在{window_days}天内出现{cnt}次 (上限{max_count})"
                    ),
                    "dept_code": str(entity_val),
                    "dept_name": str(entity_val),
                })

            logger.info(
                f"[风险引擎] 频率检测: {table} GROUP BY {entity} HAVING>{max_count} "
                f"/{window_days}天 -> {len(results)} 条异常"
            )
            return results
        except Exception as e:
            logger.warning(f"[风险引擎] 频率检测失败: {e}")
            return []
        finally:
            db.close()

    # -- 费用审计专有规则 --

    @staticmethod
    def evaluate_expense_audit(conditions: Dict, threshold: float) -> List[Dict]:
        """
        费用审计规则（V3升级版）:

        规则1: 查询 risk_alerts 中高危(financial+high)且状态为open的预警
        规则2: 统计近30天中高危预警频发的部门
        规则3: 查询 audit_findings 中风险评分较高的发现

        conditions.rules:
          min_expense_amount - 最低金额阈值 (默认 10000)
          round_threshold    - 整数金额阈值 (默认 5000)
          max_modify_count   - 最大预警次数/修改次数 (默认 3)
        """
        db = SessionLocal()
        try:
            rules_config = conditions.get("rules", {})
            if not isinstance(rules_config, dict):
                rules_config = {}
            max_modify_count = int(rules_config.get("max_modify_count", 3))
            round_threshold = float(rules_config.get("round_threshold", 5000))

            results = []

            # 规则1: 高危财务预警 (financial + high + open)
            sql1 = text(
                "SELECT * FROM risk_alerts "
                "WHERE risk_type = 'financial' AND severity = 'high' AND status = 'open' "
                "ORDER BY alert_time DESC LIMIT 100"
            )
            result1 = db.execute(sql1)
            rows1 = result1.fetchall()
            columns1 = list(result1.keys())

            for row in rows1:
                row_dict = _row_to_dict(row, columns1)
                alert_time = row_dict.get("alert_time")
                if alert_time and isinstance(alert_time, datetime):
                    days_ago = max(0, (datetime.now() - alert_time).days)
                else:
                    days_ago = 30
                # 越新的预警分数越高
                score = min(100.0, max(30.0, 100.0 - days_ago * 2))
                results.append({
                    "score": score,
                    "description": (
                        f"高危财务预警: {row_dict.get('title', 'N/A')} - "
                        f"{str(row_dict.get('description', ''))[:80]}"
                    ),
                    "dept_code": row_dict.get("dept_code", "N/A"),
                    "dept_name": row_dict.get("dept_name", "N/A"),
                    "alert_id": row_dict.get("alert_id", ""),
                })

            # 规则2: 近30天中高危预警频率
            cutoff = datetime.now() - timedelta(days=30)
            sql2 = text(
                "SELECT dept_code, dept_name, COUNT(*) as cnt "
                "FROM risk_alerts "
                "WHERE alert_time >= :cutoff AND severity IN ('high', 'medium') "
                "GROUP BY dept_code, dept_name "
                "HAVING COUNT(*) >= :mc "
                "ORDER BY cnt DESC LIMIT 50"
            )
            result2 = db.execute(sql2, {"cutoff": cutoff, "mc": max_modify_count})
            rows2 = result2.fetchall()
            columns2 = list(result2.keys())

            for row in rows2:
                row_dict = _row_to_dict(row, columns2)
                cnt = int(row_dict.get("cnt", 0))
                score = min(100.0, (cnt / max(1, max_modify_count)) * 100.0)
                dept_nm = row_dict.get("dept_name") or row_dict.get("dept_code") or "N/A"
                results.append({
                    "score": score,
                    "description": (
                        f"部门'{dept_nm}' 近30天产生{cnt}条中高危预警 (阈值{max_modify_count})"
                    ),
                    "dept_code": row_dict.get("dept_code", "N/A"),
                    "dept_name": row_dict.get("dept_name", "N/A"),
                })

            # 规则3: 审计发现高风险评分
            min_risk = max(round_threshold / 1000.0, 3.0)
            sql3 = text(
                "SELECT * FROM audit_findings "
                "WHERE risk_score >= :ms "
                "ORDER BY risk_score DESC LIMIT 50"
            )
            result3 = db.execute(sql3, {"ms": min_risk})
            rows3 = result3.fetchall()
            columns3 = list(result3.keys())

            for row in rows3:
                row_dict = _row_to_dict(row, columns3)
                risk_score = float(row_dict.get("risk_score", 0) or 0)
                score = min(100.0, (risk_score / max(min_risk, 0.1)) * 50.0)
                results.append({
                    "score": score,
                    "description": (
                        f"审计发现高风险: {row_dict.get('title', 'N/A')} "
                        f"(risk_score={risk_score}), 涉及金额={row_dict.get('amount_involved', 'N/A')}"
                    ),
                    "dept_code": row_dict.get("responsible_dept", "N/A"),
                    "dept_name": row_dict.get("responsible_dept", "N/A"),
                })

            logger.info(f"[风险引擎] 费用审计MECE规则: {len(results)}条异常")
            return results
        except Exception as e:
            logger.warning(f"[风险引擎] 费用审计规则失败: {e}")
            return []
        finally:
            db.close()

    # -- 注册评估器 --
    EVALUATORS = {
        RuleType.NULL_RATE.value: evaluate_null_rate.__func__,
        RuleType.OUTLIER.value: evaluate_threshold.__func__,
        RuleType.CONSISTENCY.value: evaluate_consistency.__func__,
        RuleType.VOLATILITY.value: evaluate_volatility.__func__,
        RuleType.THRESHOLD.value: evaluate_threshold.__func__,
        RuleType.FREQUENCY.value: evaluate_frequency.__func__,
        RuleType.EXPENSE_AUDIT.value: evaluate_expense_audit.__func__,
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
            "table": "audit_findings",
            "field": "risk_score",
            "operator": "gt",
            "value": 7,
        },
        "threshold": 1,
    },
    {
        "rule_id": "RISK-002",
        "name": "凭证必填字段空值检查",
        "description": "风险预警关键字段（dept_code, dept_name, business_area）空值率超过5%",
        "risk_type": RiskType.COMPLIANCE,
        "severity": SeverityLevel.MEDIUM,
        "rule_type": RuleType.NULL_RATE,
        "conditions": {
            "table": "risk_alerts",
            "fields": ["dept_code", "dept_name", "business_area"],
            "max_null_rate": 0.05,
        },
        "threshold": 0.05,
    },
    {
        "rule_id": "RISK-003",
        "name": "凭证金额一致性校验",
        "description": "底稿关联的审计发现在findings表中不存在（孤儿记录）",
        "risk_type": RiskType.FINANCIAL,
        "severity": SeverityLevel.HIGH,
        "rule_type": RuleType.CONSISTENCY,
        "conditions": {
            "source_table": "audit_worksheets",
            "target_table": "audit_findings",
            "join": "finding_id",
        },
        "threshold": 0,
    },
    {
        "rule_id": "RISK-004",
        "name": "月度费用波动异常",
        "description": "当月预警产生量与近6个月均值偏差超过30%",
        "risk_type": RiskType.FINANCIAL,
        "severity": SeverityLevel.MEDIUM,
        "rule_type": RuleType.VOLATILITY,
        "conditions": {
            "table": "risk_alerts",
            "field": "risk_score",
            "lookback": 6,
            "max_deviation": 0.30,
        },
        "threshold": 0.30,
    },
    {
        "rule_id": "RISK-005",
        "name": "同供应商高频付款",
        "description": "30天内同一部门预警次数超过10次",
        "risk_type": RiskType.PROCUREMENT,
        "severity": SeverityLevel.MEDIUM,
        "rule_type": RuleType.FREQUENCY,
        "conditions": {
            "table": "risk_alerts",
            "entity": "dept_code",
            "max_count": 10,
            "window_days": 30,
        },
        "threshold": 10,
    },
    {
        "rule_id": "RISK-006",
        "name": "凭证反复修改异常",
        "description": "同一部门短期内产生大量高风险预警（超过3条）",
        "risk_type": RiskType.COMPLIANCE,
        "severity": SeverityLevel.LOW,
        "rule_type": RuleType.FREQUENCY,
        "conditions": {
            "table": "risk_alerts",
            "entity": "dept_code",
            "max_count": 3,
            "window_days": 7,
        },
        "threshold": 3,
    },
    {
        "rule_id": "RISK-007",
        "name": "整数金额费用检测",
        "description": "高危财务预警扫描 + 审计发现高风险评分 + 部门预警频率",
        "risk_type": RiskType.FINANCIAL,
        "severity": SeverityLevel.LOW,
        "rule_type": RuleType.EXPENSE_AUDIT,
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
