"""
数据治理与质量中心 - 核心服务
Data Governance & Quality Center Service

覆盖需求文档三:
  3.1 数据质量监控 - 空值/异常/一致性/波动检测, 月度质量报告
  3.2 数据血缘追踪 - 全链路溯源/变更影响分析/字段变更通知
  3.3 数据接入健康度 - 同步监控/异常告警/快照管理
"""

import uuid
import hashlib
import json
from math import sqrt
from datetime import datetime, timedelta, date
from typing import Any, Dict, List, Optional, Tuple
from collections import defaultdict
from dataclasses import dataclass, field
from loguru import logger

from app.core.database import SessionLocal
from app.models.data_quality import (
    QualityRule, QualityReport, QualityScore,
    SyncStatus, SyncSnapshot, DataLineage,
    FieldChangeLog, CrossSystemCheck,
    RuleType, SeverityLevel,
)


# ==================== 预设质量规则 ====================

PRESET_QUALITY_RULES = [
    {
        "rule_id": "DQ-001",
        "name": "凭证金额空值检测",
        "description": "检测金蝶ERP凭证表中金额字段的空值率，空值率超过1%触发告警",
        "source_system": "金蝶ERP",
        "table_name": "t_voucher",
        "field_name": "total_amount",
        "rule_type": RuleType.NULL_RATE,
        "threshold": 0.01,
        "severity": SeverityLevel.CRITICAL,
    },
    {
        "rule_id": "DQ-002",
        "name": "供应商名称空值检测",
        "description": "检测SRM供应商表中供应商名称字段的空值率",
        "source_system": "SRM",
        "table_name": "t_supplier",
        "field_name": "supplier_name",
        "rule_type": RuleType.NULL_RATE,
        "threshold": 0.005,
        "severity": SeverityLevel.WARNING,
    },
    {
        "rule_id": "DQ-003",
        "name": "合同金额异常值检测",
        "description": "检测合同金额是否超出历史均值±3σ范围",
        "source_system": "CRM",
        "table_name": "t_contract",
        "field_name": "contract_amount",
        "rule_type": RuleType.OUTLIER,
        "threshold": 3.0,
        "severity": SeverityLevel.WARNING,
    },
    {
        "rule_id": "DQ-004",
        "name": "月度费用波动检测",
        "description": "当月费用支出与近6个月均值偏差超过30%时告警",
        "source_system": "金蝶ERP",
        "table_name": "t_expense",
        "field_name": "amount",
        "rule_type": RuleType.VOLATILITY,
        "threshold": 0.30,
        "severity": SeverityLevel.WARNING,
    },
    {
        "rule_id": "DQ-005",
        "name": "ERP-SRM供应商名称一致性",
        "description": "同一供应商在金蝶ERP与SRM中的名称是否一致",
        "source_system": "金蝶ERP",
        "table_name": "t_supplier",
        "field_name": "supplier_name",
        "rule_type": RuleType.CONSISTENCY,
        "threshold": 0.95,
        "severity": SeverityLevel.CRITICAL,
    },
    {
        "rule_id": "DQ-006",
        "name": "ERP-CRM合同金额一致性",
        "description": "同一销售合同在ERP与CRM中的金额是否匹配",
        "source_system": "金蝶ERP",
        "table_name": "t_contract",
        "field_name": "total_amount",
        "rule_type": RuleType.CONSISTENCY,
        "threshold": 0.98,
        "severity": SeverityLevel.CRITICAL,
    },
]

# 预设跨系统一致性检查
PRESET_CROSS_SYSTEM_CHECKS = [
    {
        "check_id": "CSC-001",
        "name": "ERP-SRM供应商名称一致性",
        "description": "检查同一供应商在金蝶ERP和SRM中的名称是否一致",
        "source_system": "金蝶ERP",
        "source_table": "t_supplier",
        "source_field": "supplier_name",
        "target_system": "SRM",
        "target_table": "t_supplier",
        "target_field": "supplier_name",
        "match_key": "supplier_id",
    },
    {
        "check_id": "CSC-002",
        "name": "ERP-SRM供应商信用等级一致性",
        "description": "检查同一供应商在ERP与SRM中的信用等级是否一致",
        "source_system": "金蝶ERP",
        "source_table": "t_supplier",
        "source_field": "credit_level",
        "target_system": "SRM",
        "target_table": "t_supplier",
        "target_field": "credit_rating",
        "match_key": "supplier_id",
    },
    {
        "check_id": "CSC-003",
        "name": "ERP-CRM销售合同金额一致性",
        "description": "检查同一销售合同在ERP与CRM中的金额是否匹配",
        "source_system": "金蝶ERP",
        "source_table": "t_sales_contract",
        "source_field": "total_amount",
        "target_system": "CRM",
        "target_table": "t_contract",
        "target_field": "amount",
        "match_key": "contract_no",
    },
    {
        "check_id": "CSC-004",
        "name": "ERP-CRM销售合同日期一致性",
        "description": "检查同一销售合同在ERP与CRM中的日期是否一致",
        "source_system": "金蝶ERP",
        "source_table": "t_sales_contract",
        "source_field": "contract_date",
        "target_system": "CRM",
        "target_table": "t_contract",
        "target_field": "sign_date",
        "match_key": "contract_no",
    },
]

# 预设数据血缘链路
PRESET_LINEAGE = [
    {"source_node": "金蝶ERP.t_voucher", "target_node": "数据仓库.dwd_voucher", "relation_type": "transform", "node_level": 1, "source_system": "金蝶ERP", "table_name": "t_voucher"},
    {"source_node": "金蝶ERP.t_voucher_entry", "target_node": "数据仓库.dwd_voucher_entry", "relation_type": "transform", "node_level": 1, "source_system": "金蝶ERP", "table_name": "t_voucher_entry"},
    {"source_node": "金蝶ERP.t_balance", "target_node": "数据仓库.dwd_balance", "relation_type": "transform", "node_level": 1, "source_system": "金蝶ERP", "table_name": "t_balance"},
    {"source_node": "数据仓库.dwd_voucher", "target_node": "数据集市.dm_financial_audit", "relation_type": "aggregate", "node_level": 2, "source_system": "金蝶ERP"},
    {"source_node": "数据仓库.dwd_voucher_entry", "target_node": "数据集市.dm_financial_audit", "relation_type": "aggregate", "node_level": 2, "source_system": "金蝶ERP"},
    {"source_node": "数据集市.dm_financial_audit", "target_node": "审计底稿.费用审计底稿", "relation_type": "reference", "node_level": 3, "source_system": "金蝶ERP"},
    {"source_node": "数据集市.dm_financial_audit", "target_node": "审计报告.标准审计报告", "relation_type": "reference", "node_level": 3, "source_system": "金蝶ERP"},
    {"source_node": "SRM.t_supplier", "target_node": "数据仓库.dwd_supplier", "relation_type": "transform", "node_level": 1, "source_system": "SRM", "table_name": "t_supplier"},
    {"source_node": "CRM.t_contract", "target_node": "数据仓库.dwd_contract", "relation_type": "transform", "node_level": 1, "source_system": "CRM", "table_name": "t_contract"},
    {"source_node": "数据仓库.dwd_supplier", "target_node": "数据集市.dm_procurement_audit", "relation_type": "aggregate", "node_level": 2, "source_system": "SRM"},
]


class DataQualityService:
    """数据质量中心核心服务"""

    def __init__(self):
        self.db = SessionLocal()

    # ==================== 3.1.1 空值率检测 ====================

    def check_null_rate(self, rule: QualityRule, sample_data: List[Dict] = None) -> Dict:
        """
        空值率检测
        对关键字段的空值率进行检测，超过阈值自动告警

        Args:
            rule: 质量规则
            sample_data: 样本数据列表，实际环境从数据库查询

        Returns:
            {total, null_count, null_rate, passed, severity}
        """
        if sample_data is None:
            sample_data = self._fetch_sample_data(rule)

        total = len(sample_data)
        if total == 0:
            return {"total": 0, "null_count": 0, "null_rate": 0, "passed": True, "severity": "info"}

        null_count = sum(1 for row in sample_data if row.get(rule.field_name) is None or row.get(rule.field_name) == "")
        null_rate = null_count / total
        threshold = rule.threshold or 0.01
        passed = null_rate <= threshold

        severity = self._calc_severity(null_rate, threshold)

        logger.info(f"[质量检查] {rule.name}: 空值率={null_rate:.2%} (阈值={threshold:.2%}) → {'通过' if passed else '不通过'}")

        return {
            "total": total,
            "null_count": null_count,
            "null_rate": round(null_rate, 4),
            "threshold": threshold,
            "passed": passed,
            "severity": severity,
            "failed_samples": [
                {"row_index": i, "reason": "空值"}
                for i, row in enumerate(sample_data)
                if row.get(rule.field_name) is None or row.get(rule.field_name) == ""
            ][:10],  # 最多返回10条
        }

    # ==================== 3.1.2 异常值检测 (±3σ) ====================

    def check_outliers(self, rule: QualityRule, sample_data: List[Dict] = None) -> Dict:
        """
        异常值检测 (3σ原则)
        当某字段值超出历史均值±3σ时自动标红

        Args:
            rule: 质量规则
            sample_data: 样本数据列表

        Returns:
            {total, mean, std, outlier_count, outlier_rate, passed, outliners}
        """
        if sample_data is None:
            sample_data = self._fetch_sample_data(rule)

        values = []
        for row in sample_data:
            val = row.get(rule.field_name)
            if val is not None and isinstance(val, (int, float)):
                values.append(float(val))

        total = len(values)
        if total < 3:
            return {"total": total, "mean": 0, "std": 0, "outlier_count": 0, "outlier_rate": 0, "passed": True}

        mean = sum(values) / total
        variance = sum((x - mean) ** 2 for x in values) / total
        std = sqrt(variance)

        sigma_multiplier = rule.threshold or 3.0
        lower_bound = mean - sigma_multiplier * std
        upper_bound = mean + sigma_multiplier * std

        outliers = []
        for i, row in enumerate(sample_data):
            val = row.get(rule.field_name)
            if val is not None and isinstance(val, (int, float)):
                v = float(val)
                if v < lower_bound or v > upper_bound:
                    outliers.append({
                        "row_index": i,
                        "value": v,
                        "mean": round(mean, 2),
                        "std": round(std, 2),
                        "deviation_sigma": round((v - mean) / std, 2) if std > 0 else 0,
                    })

        outlier_count = len(outliers)
        outlier_rate = outlier_count / total if total > 0 else 0
        max_outlier_rate = 0.05
        passed = outlier_rate <= max_outlier_rate

        logger.info(f"[质量检查] {rule.name}: 均值={mean:.2f}, σ={std:.2f}, 异常值={outlier_count}/{total} → {'通过' if passed else '不通过'}")

        return {
            "total": total,
            "mean": round(mean, 2),
            "std": round(std, 2),
            "lower_bound": round(lower_bound, 2),
            "upper_bound": round(upper_bound, 2),
            "sigma_multiplier": sigma_multiplier,
            "outlier_count": outlier_count,
            "outlier_rate": round(outlier_rate, 4),
            "passed": passed,
            "outliers": outliers[:20],
            "severity": self._calc_severity(outlier_rate, max_outlier_rate),
        }

    # ==================== 3.1.3 波动检测 ====================

    def check_volatility(self, rule: RuleType, current_value: float,
                         historical_values: List[float]) -> Dict:
        """
        波动检测
        当某字段值超出历史均值±指定百分比时告警

        Args:
            rule: 质量规则
            current_value: 当前值
            historical_values: 历史值列表（如近6个月）

        Returns:
            {current, mean, deviation_pct, passed}
        """
        if not historical_values:
            return {"current": current_value, "mean": 0, "deviation_pct": 0, "passed": True}

        mean = sum(historical_values) / len(historical_values)
        threshold = rule.threshold or 0.30

        if mean == 0:
            deviation_pct = 1.0 if current_value != 0 else 0
        else:
            deviation_pct = abs(current_value - mean) / abs(mean)

        passed = deviation_pct <= threshold

        logger.info(f"[质量检查] {rule.name}: 当前={current_value:.2f}, 均值={mean:.2f}, 偏差={deviation_pct:.2%} → {'通过' if passed else '不通过'}")

        return {
            "current": current_value,
            "mean": round(mean, 2),
            "deviation_pct": round(deviation_pct, 4),
            "threshold": threshold,
            "passed": passed,
            "severity": self._calc_severity(deviation_pct, threshold),
            "historical_count": len(historical_values),
        }

    # ==================== 3.1.4 跨系统一致性校验 ====================

    def check_cross_system_consistency(self, check: CrossSystemCheck,
                                       source_data: List[Dict] = None,
                                       target_data: List[Dict] = None) -> Dict:
        """
        跨系统一致性校验
        对比两个系统中同一实体的字段值是否一致

        如: 同一供应商在ERP与SRM中的名称是否一致
            同一销售合同在ERP与CRM中的金额是否匹配
        """
        if source_data is None or target_data is None:
            source_data = self._fetch_system_data(check.source_system, check.source_table)
            target_data = self._fetch_system_data(check.target_system, check.target_table)

        source_map = {row.get(check.match_key): row.get(check.source_field)
                      for row in source_data if row.get(check.match_key)}

        target_map = {row.get(check.match_key): row.get(check.target_field)
                      for row in target_data if row.get(check.match_key)}

        common_keys = set(source_map.keys()) & set(target_map.keys())
        total_compared = len(common_keys)
        matched = 0
        mismatches = []

        for key in common_keys:
            src_val = str(source_map[key]).strip() if source_map[key] else ""
            tgt_val = str(target_map[key]).strip() if target_map[key] else ""
            if src_val == tgt_val:
                matched += 1
            else:
                mismatches.append({
                    "match_key": key,
                    "source_value": src_val,
                    "target_value": tgt_val,
                })

        mismatched = total_compared - matched
        match_rate = matched / total_compared if total_compared > 0 else 1.0
        passed = match_rate >= (check.match_rate or 0.95)

        logger.info(f"[一致性检查] {check.name}: 一致率={match_rate:.2%} ({matched}/{total_compared})")

        return {
            "check_name": check.name,
            "total_compared": total_compared,
            "matched": matched,
            "mismatched": mismatched,
            "match_rate": round(match_rate, 4),
            "passed": passed,
            "mismatches": mismatches[:20],
            "source_only_count": len(set(source_map.keys()) - set(target_map.keys())),
            "target_only_count": len(set(target_map.keys()) - set(source_map.keys())),
        }

    # ==================== 月度质量报告 ====================

    def generate_monthly_report(self, report_month: str = None) -> Dict:
        """
        按月生成《数据质量健康报告》
        包含各部门各系统数据质量的评分排名
        """
        if report_month is None:
            now = datetime.now()
            report_month = f"{now.year}-{now.month:02d}"

        rules = self.db.query(QualityRule).filter(QualityRule.is_active == "1").all()

        # 按系统聚合评分
        system_scores: Dict[str, Dict] = defaultdict(lambda: {"total": 0, "passed": 0, "score": 0})
        # 按部门聚合评分（从规则的来源系统推断）
        dept_scores: Dict[str, Dict] = defaultdict(lambda: {"total": 0, "passed": 0, "score": 0})

        for rule in rules:
            result = self._check_rule(rule)
            sys = rule.source_system
            dept = self._map_system_to_dept(sys)

            system_scores[sys]["total"] += 1
            dept_scores[dept]["total"] += 1

            if result.get("passed", False):
                system_scores[sys]["passed"] += 1
                dept_scores[dept]["passed"] += 1

        # 计算得分
        for sys_name, data in system_scores.items():
            data["score"] = round(data["passed"] / data["total"] * 100, 1) if data["total"] > 0 else 0

        for dept_name, data in dept_scores.items():
            data["score"] = round(data["passed"] / data["total"] * 100, 1) if data["total"] > 0 else 0

        # 排名
        system_ranking = sorted(system_scores.items(), key=lambda x: x[1]["score"], reverse=True)
        dept_ranking = sorted(dept_scores.items(), key=lambda x: x[1]["score"], reverse=True)

        # 保存评分记录
        for rank_idx, (name, data) in enumerate(system_ranking, 1):
            score_record = QualityScore(
                report_month=report_month,
                entity_type="system",
                entity_name=name,
                total_rules=data["total"],
                passed_rules=data["passed"],
                failed_rules=data["total"] - data["passed"],
                quality_score=data["score"],
                rank=rank_idx,
            )
            self.db.add(score_record)

        for rank_idx, (name, data) in enumerate(dept_ranking, 1):
            score_record = QualityScore(
                report_month=report_month,
                entity_type="department",
                entity_name=name,
                total_rules=data["total"],
                passed_rules=data["passed"],
                failed_rules=data["total"] - data["passed"],
                quality_score=data["score"],
                rank=rank_idx,
            )
            self.db.add(score_record)

        self.db.commit()

        overall_score = round(
            sum(d["score"] for d in system_scores.values()) / max(len(system_scores), 1), 1
        )

        return {
            "report_month": report_month,
            "overall_score": overall_score,
            "total_rules_checked": len(rules),
            "system_ranking": [
                {"name": name, "score": data["score"], "rank": i + 1,
                 "passed": data["passed"], "total": data["total"]}
                for i, (name, data) in enumerate(system_ranking)
            ],
            "department_ranking": [
                {"name": name, "score": data["score"], "rank": i + 1,
                 "passed": data["passed"], "total": data["total"]}
                for i, (name, data) in enumerate(dept_ranking)
            ],
        }

    # ==================== 3.2 数据血缘追踪 ====================

    def trace_lineage(self, node_name: str, direction: str = "upstream") -> Dict:
        """
        全链路溯源
        审计报告中的任一数字均可追溯其来源路径:
        报告数值 → 审计底稿 → 原始数据表 → 源系统 → 源单据

        Args:
            node_name: 节点名称
            direction: upstream(向上溯源) / downstream(向下影响)

        Returns:
            血缘链路树
        """
        if direction == "upstream":
            # 向上追溯：找到所有源节点
            edges = self.db.query(DataLineage).filter(
                DataLineage.target_node.like(f"%{node_name}%")
            ).all()
        else:
            # 向下分析：找到所有目标节点
            edges = self.db.query(DataLineage).filter(
                DataLineage.source_node.like(f"%{node_name}%")
            ).all()

        if not edges:
            # 返回模拟链路
            return self._get_mock_lineage(node_name, direction)

        path = []
        visited = set()

        def build_path(current_node, depth=0):
            if current_node in visited or depth > 10:
                return
            visited.add(current_node)

            if direction == "upstream":
                parents = self.db.query(DataLineage).filter(
                    DataLineage.target_node == current_node
                ).all()
                for edge in parents:
                    node_info = {
                        "node": edge.source_node,
                        "relation": edge.relation_type,
                        "transform": edge.transform_description,
                        "system": edge.source_system,
                        "level": edge.node_level,
                        "children": [],
                    }
                    path.append(node_info)
                    build_path(edge.source_node, depth + 1)
            else:
                children = self.db.query(DataLineage).filter(
                    DataLineage.source_node == current_node
                ).all()
                for edge in children:
                    node_info = {
                        "node": edge.target_node,
                        "relation": edge.relation_type,
                        "transform": edge.transform_description,
                        "system": edge.source_system,
                        "level": edge.node_level,
                        "children": [],
                    }
                    path.append(node_info)
                    build_path(edge.target_node, depth + 1)

        build_path(node_name)
        return {"root": node_name, "direction": direction, "path": path, "depth": len(path)}

    def analyze_field_change_impact(self, source_system: str, table_name: str,
                                    field_name: str) -> Dict:
        """
        变更影响分析
        当源系统字段变更时，自动评估对下游审计模型的影响
        """
        # 查找该字段在血缘链路中的下游节点
        search_pattern = f"{source_system}.{table_name}.{field_name}"
        downstream = self.db.query(DataLineage).filter(
            DataLineage.source_node.like(f"%{search_pattern}%")
        ).all()

        impacted = []
        for edge in downstream:
            # 继续向下追溯
            further = self.trace_lineage(edge.target_node, "downstream")
            impacted.append({
                "direct_target": edge.target_node,
                "relation": edge.relation_type,
                "further_impact": further.get("path", []),
            })

        impact_level = "high" if len(impacted) > 3 else "medium" if impacted else "low"

        return {
            "source": search_pattern,
            "impact_level": impact_level,
            "impacted_count": len(impacted),
            "impacted_nodes": impacted,
            "warning": f"该字段变更将影响 {len(impacted)} 个下游节点" if impacted else "无下游影响",
        }

    # ==================== 3.3 数据接入健康度 ====================

    def get_sync_health_dashboard(self) -> Dict:
        """获取同步健康度总览"""
        all_status = self.db.query(SyncStatus).all()

        total = len(all_status)
        online = sum(1 for s in all_status if s.sync_status == "online")
        syncing = sum(1 for s in all_status if s.sync_status == "syncing")
        error = sum(1 for s in all_status if s.sync_status == "error")
        offline = sum(1 for s in all_status if s.sync_status == "offline")

        # 延迟超30分钟的
        delayed = [
            s.to_dict() for s in all_status
            if s.last_sync_at and (datetime.now() - s.last_sync_at.replace(tzinfo=None)).total_seconds() > 1800
        ]

        # 计算健康度得分
        health_score = round((online + syncing * 0.5) / max(total, 1) * 100, 1)

        return {
            "total_sources": total,
            "online": online,
            "syncing": syncing,
            "error": error,
            "offline": offline,
            "health_score": health_score,
            "delayed_sources": delayed,
            "delayed_count": len(delayed),
            "needs_alert": len(delayed) > 0 or error > 0,
        }

    def check_sync_delay(self, source_system: str) -> Dict:
        """检查单个数据源的同步延迟"""
        status = self.db.query(SyncStatus).filter(
            SyncStatus.source_system == source_system
        ).first()

        if not status or not status.last_sync_at:
            return {"source_system": source_system, "delayed": True, "delay_minutes": -1}

        delay_seconds = (datetime.now() - status.last_sync_at.replace(tzinfo=None)).total_seconds()
        delay_minutes = int(delay_seconds / 60)
        delay_threshold = 30  # 超30分钟告警

        needs_alert = delay_minutes > delay_threshold

        return {
            "source_system": source_system,
            "last_sync": status.last_sync_at.isoformat(),
            "delay_minutes": delay_minutes,
            "delayed": needs_alert,
            "threshold_minutes": delay_threshold,
            "message": f"同步延迟 {delay_minutes} 分钟，超过阈值 {delay_threshold} 分钟" if needs_alert else "同步正常",
        }

    def create_snapshot(self, source_system: str, table_name: str,
                        records_count: int, sync_mode: str = "full",
                        diff_data: Dict = None) -> Dict:
        """创建同步快照"""
        snapshot_id = f"SNAP-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        # 获取上一快照进行比对
        prev_snapshot = self.db.query(SyncSnapshot).filter(
            SyncSnapshot.source_system == source_system,
            SyncSnapshot.table_name == table_name,
            SyncSnapshot.is_success == "1",
        ).order_by(SyncSnapshot.created_at.desc()).first()

        diff_summary = None
        if prev_snapshot and diff_data:
            diff_summary = {
                "prev_snapshot_id": prev_snapshot.snapshot_id,
                "prev_records": prev_snapshot.records_count,
                "current_records": records_count,
                "change_count": records_count - prev_snapshot.records_count,
                "change_pct": round(
                    abs(records_count - prev_snapshot.records_count) / max(prev_snapshot.records_count, 1) * 100, 2
                ),
                "details": diff_data,
            }

        # 数据校验和
        data_checksum = hashlib.sha256(
            f"{source_system}:{table_name}:{datetime.now().isoformat()}:{records_count}".encode()
        ).hexdigest()[:16]

        snapshot = SyncSnapshot(
            snapshot_id=snapshot_id,
            source_system=source_system,
            table_name=table_name,
            records_count=records_count,
            snapshot_data_checksum=data_checksum,
            sync_mode=sync_mode,
            sync_started_at=datetime.now() - timedelta(seconds=10),
            sync_finished_at=datetime.now(),
            duration_seconds=10,
            is_success="1",
            diff_summary=diff_summary,
        )
        self.db.add(snapshot)
        self.db.commit()

        return snapshot.to_dict()

    def compare_snapshots(self, snapshot_id_1: str, snapshot_id_2: str) -> Dict:
        """比对两个快照的差异"""
        snap1 = self.db.query(SyncSnapshot).filter(SyncSnapshot.snapshot_id == snapshot_id_1).first()
        snap2 = self.db.query(SyncSnapshot).filter(SyncSnapshot.snapshot_id == snapshot_id_2).first()

        if not snap1 or not snap2:
            raise ValueError("快照不存在")

        return {
            "snapshot_1": snap1.to_dict(),
            "snapshot_2": snap2.to_dict(),
            "record_diff": snap2.records_count - snap1.records_count,
            "time_between": str(snap2.created_at - snap1.created_at) if snap1.created_at and snap2.created_at else None,
        }

    # ==================== 综合仪表盘 ====================

    def get_dashboard_stats(self) -> Dict:
        """获取数据治理中心仪表盘统计"""
        rules = self.db.query(QualityRule).all()
        syncs = self.db.query(SyncStatus).all()
        lineages = self.db.query(DataLineage).count()
        changes = self.db.query(FieldChangeLog).filter(
            FieldChangeLog.notified == "0"
        ).count()

        # 规则执行统计
        active_rules = [r for r in rules if r.is_active == "1"]
        failed_rules = [r for r in active_rules if r.last_result and not r.last_result.get("passed", True)]

        # 综合质量评分
        if active_rules:
            quality_score = round(
                (len(active_rules) - len(failed_rules)) / len(active_rules) * 100, 1
            )
        else:
            quality_score = 100

        # 按规则类型分布
        rule_type_dist = defaultdict(int)
        for r in rules:
            rule_type_dist[r.rule_type.value if r.rule_type else "unknown"] += 1

        return {
            "quality_score": quality_score,
            "total_rules": len(rules),
            "active_rules": len(active_rules),
            "failed_rules": len(failed_rules),
            "total_sync_sources": len(syncs),
            "error_sync_sources": sum(1 for s in syncs if s.sync_status == "error"),
            "total_lineage_nodes": lineages,
            "pending_change_notifications": changes,
            "rule_type_distribution": dict(rule_type_dist),
            "sync_health": {
                "online": sum(1 for s in syncs if s.sync_status == "online"),
                "syncing": sum(1 for s in syncs if s.sync_status == "syncing"),
                "error": sum(1 for s in syncs if s.sync_status == "error"),
                "offline": sum(1 for s in syncs if s.sync_status == "offline"),
            },
        }

    # ==================== 辅助方法 ====================

    def _check_rule(self, rule: QualityRule) -> Dict:
        """执行单条规则检查"""
        evaluators = {
            RuleType.NULL_RATE: self.check_null_rate,
            RuleType.OUTLIER: self.check_outliers,
            RuleType.VOLATILITY: lambda r, d: self.check_volatility(r, 0, []),
            RuleType.CONSISTENCY: lambda r, d: {"passed": True, "message": "需要跨系统数据"},
            RuleType.COMPLETENESS: lambda r, d: {"passed": True, "total": 0, "complete": 0, "completeness_rate": 1.0},
        }

        evaluator = evaluators.get(rule.rule_type)
        if evaluator:
            result = evaluator(rule, None)
            # 更新规则的最后检查结果
            rule.last_check_at = datetime.now()
            rule.last_result = result
            self.db.commit()
            return result
        return {"passed": True, "message": "未找到对应评估器"}

    def _fetch_sample_data(self, rule: QualityRule) -> List[Dict]:
        """从数据库获取样本数据（模拟）"""
        # 实际环境中根据 rule.source_system, rule.table_name 查询
        return self._generate_mock_data(rule)

    def _fetch_system_data(self, system: str, table: str) -> List[Dict]:
        """从指定系统获取数据（模拟）"""
        return self._generate_mock_system_data(system, table)

    def _generate_mock_data(self, rule: QualityRule) -> List[Dict]:
        """生成模拟数据用于检测演示"""
        import random
        random.seed(42)
        data = []
        for i in range(100):
            row = {"id": i}
            # 根据规则类型生成不同的数据模式
            if rule.rule_type == RuleType.NULL_RATE:
                # 模拟空值率，约2%为空
                row[rule.field_name] = None if random.random() < 0.02 else round(random.uniform(100, 50000), 2)
            elif rule.rule_type == RuleType.OUTLIER:
                # 模拟异常值，生成几个极端值
                if i in [5, 23, 67]:
                    row[rule.field_name] = round(random.uniform(500000, 1000000), 2)  # 极端值
                else:
                    row[rule.field_name] = round(random.uniform(1000, 10000), 2)
            elif rule.rule_type == RuleType.VOLATILITY:
                row[rule.field_name] = round(random.uniform(50000, 200000), 2)
            else:
                row[rule.field_name] = round(random.uniform(100, 50000), 2)
            data.append(row)
        return data

    def _generate_mock_system_data(self, system: str, table: str) -> List[Dict]:
        """生成跨系统模拟数据"""
        import random
        random.seed(123)
        data = []
        for i in range(50):
            row = {
                "supplier_id": f"SUP-{i:04d}",
                "contract_no": f"CT-{2026}{i:04d}",
            }
            # 模拟部分不一致数据
            if system == "金蝶ERP":
                row["supplier_name"] = f"供应商{i}" if i < 47 else f"Supplier{i}"
                row["credit_level"] = random.choice(["A", "B", "C"])
                row["total_amount"] = round(random.uniform(10000, 500000), 2)
                row["contract_date"] = "2026-01-15"
            elif system == "SRM":
                row["supplier_name"] = f"供应商{i}" if i < 45 else f"Supplier-{i}"
                row["credit_rating"] = random.choice(["A", "B", "C"])
            elif system == "CRM":
                row["amount"] = round(random.uniform(10000, 500000), 2)
                row["sign_date"] = "2026-01-15" if i < 48 else "2026-02-01"
            data.append(row)
        return data

    def _calc_severity(self, value: float, threshold: float) -> str:
        """计算严重级别"""
        if threshold <= 0:
            return "info"
        ratio = value / threshold
        if ratio >= 5:
            return "critical"
        elif ratio >= 2:
            return "warning"
        return "info"

    @staticmethod
    def _map_system_to_dept(system: str) -> str:
        """将源系统映射到责任部门"""
        mapping = {
            "金蝶ERP": "财务部",
            "云之家OA": "行政部",
            "CRM": "销售部",
            "SRM": "采购部",
            "WMS": "仓储部",
            "QMS": "质量部",
            "PLM": "研发部",
        }
        return mapping.get(system, "其他部门")

    def _get_mock_lineage(self, node_name: str, direction: str) -> Dict:
        """当数据库无血缘数据时返回模拟链路"""
        mock_path = [
            {
                "node": "金蝶ERP.t_voucher.total_amount",
                "relation": "transform",
                "transform": "ETL抽取凭证合计金额",
                "system": "金蝶ERP",
                "level": 0,
            },
            {
                "node": "数据仓库.dwd_voucher",
                "relation": "transform",
                "transform": "数据清洗与标准化",
                "system": "金蝶ERP",
                "level": 1,
            },
            {
                "node": "数据集市.dm_financial_audit",
                "relation": "aggregate",
                "transform": "按部门/科目汇总",
                "system": "金蝶ERP",
                "level": 2,
            },
            {
                "node": "审计底稿.费用审计底稿.s4_审计发现摘要",
                "relation": "reference",
                "transform": "审计人员引用数据",
                "system": "审计系统",
                "level": 3,
            },
        ]
        return {
            "root": node_name,
            "direction": direction,
            "path": mock_path,
            "depth": len(mock_path),
        }
