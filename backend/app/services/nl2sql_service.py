"""
智能查询服务 - NL2SQL + Agent
Intelligent Query Service

自然语言 → SQL → 结果 → 可视化
"""
import re
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from loguru import logger

from app.core.config import settings
from app.services.llm_client import LLMClient
from app.services.prompts.nl2sql_prompt import NL2SQL_SYSTEM_PROMPT


# ==================== 查询模板库 ====================

@dataclass
class QueryTemplate:
    """预置查询模板"""
    id: str
    name: str
    description: str
    category: str  # 财务/采购/销售/库存/人事
    sql_template: str
    parameters: List[Dict] = field(default_factory=list)
    default_chart: str = "table"  # table|bar|line|pie
    tags: List[str] = field(default_factory=list)


PRESET_TEMPLATES: List[QueryTemplate] = [
    QueryTemplate(
        id="T001",
        name="各部门费用支出排名",
        description="查询指定期间各部门费用支出总额及排名",
        category="财务",
        sql_template="""
SELECT dept_name, SUM(amount) as total_amount, COUNT(*) as count
FROM t_expense
WHERE expense_date BETWEEN :start_date AND :end_date
  AND status = 'approved'
GROUP BY dept_name
ORDER BY total_amount DESC
LIMIT :limit
        """,
        parameters=[
            {"name": "start_date", "type": "date", "label": "开始日期", "required": True},
            {"name": "end_date", "type": "date", "label": "结束日期", "required": True},
            {"name": "limit", "type": "int", "label": "显示条数", "default": 10},
        ],
        default_chart="bar",
        tags=["费用", "部门", "排名"],
    ),
    QueryTemplate(
        id="T002",
        name="凭证异常查询",
        description="查询金额异常的凭证（大额/负数/整数金额）",
        category="财务",
        sql_template="""
SELECT v.voucher_no, v.voucher_date, v.total_amount, v.maker, v.status
FROM t_voucher v
WHERE v.total_amount > :min_amount
  AND v.status = 'posted'
ORDER BY v.total_amount DESC
LIMIT :limit
        """,
        parameters=[
            {"name": "min_amount", "type": "number", "label": "最小金额", "default": 50000},
            {"name": "limit", "type": "int", "label": "显示条数", "default": 20},
        ],
        default_chart="table",
        tags=["凭证", "异常", "金额"],
    ),
    QueryTemplate(
        id="T003",
        name="供应商付款排名",
        description="查询指定期间供应商付款金额排名",
        category="采购",
        sql_template="""
SELECT supplier_name, SUM(amount) as total_paid, COUNT(*) as payment_count
FROM t_payment
WHERE payment_date BETWEEN :start_date AND :end_date
GROUP BY supplier_name
ORDER BY total_paid DESC
LIMIT :limit
        """,
        parameters=[
            {"name": "start_date", "type": "date", "label": "开始日期"},
            {"name": "end_date", "type": "date", "label": "结束日期"},
            {"name": "limit", "type": "int", "label": "显示条数", "default": 10},
        ],
        default_chart="bar",
        tags=["供应商", "付款", "排名"],
    ),
    QueryTemplate(
        id="T004",
        name="审计发现问题统计",
        description="按严重程度和类型统计审计发现",
        category="审计",
        sql_template="""
SELECT severity, finding_type, COUNT(*) as count, dept_name
FROM audit_findings af
JOIN audit_projects ap ON af.project_id = ap.id
WHERE ap.status = 'completed'
GROUP BY severity, finding_type, dept_name
ORDER BY count DESC
        """,
        parameters=[],
        default_chart="pie",
        tags=["审计", "发现", "统计"],
    ),
    QueryTemplate(
        id="T005",
        name="整改完成率",
        description="按部门统计整改任务完成情况",
        category="审计",
        sql_template="""
SELECT 
    ro.dept_name,
    COUNT(*) as total_orders,
    SUM(CASE WHEN ro.status = 'completed' THEN 1 ELSE 0 END) as completed,
    ROUND(SUM(CASE WHEN ro.status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as completion_rate
FROM rectification_orders ro
WHERE ro.created_at BETWEEN :start_date AND :end_date
GROUP BY ro.dept_name
ORDER BY completion_rate ASC
        """,
        parameters=[
            {"name": "start_date", "type": "date", "label": "开始日期"},
            {"name": "end_date", "type": "date", "label": "结束日期"},
        ],
        default_chart="bar",
        tags=["整改", "完成率", "部门"],
    ),
]


# ==================== 数据库Schema注入 ====================

DB_SCHEMA = """
-- 核心审计表结构 --

-- 凭证表 (金蝶ERP)
t_voucher(voucher_id, voucher_no, voucher_date, period, maker, auditor, total_amount, status)
-- 凭证分录
t_voucher_entry(entry_id, voucher_id, acct_code, acct_name, debit_amount, credit_amount, summary)
-- 科目余额表
t_balance(account_id, account_code, account_name, period, begin_balance, debit, credit, end_balance)
-- 费用报销
t_expense(expense_id, expense_no, applicant, dept_name, expense_date, amount, category, description, status)
-- 付款申请
t_payment(payment_id, supplier_name, amount, payment_date, dept_name, status)
-- 组织架构
t_department(dept_id, dept_name, parent_id, manager, level)

-- 审计系统表 --
users(id, username, full_name, department, role)
audit_projects(id, project_no, name, audit_type, status, start_date, end_date, dept_name, budget)
audit_findings(id, project_id, finding_type, severity, description, amount, status, dept_name)
audit_worksheets(id, project_id, name, type, status, created_by, created_at)
risk_alerts(id, alert_id, rule_id, risk_type, severity, title, description, dept_name, status, alert_time)
rectification_orders(id, order_no, alert_id, dept_name, responsible, deadline, status, created_at)
"""


# ==================== NL2SQL 核心服务 ====================

class NL2SQLService:
    """
    自然语言转SQL服务
    
    流程:
    1. 理解意图 → 匹配模板 / 构建SQL
    2. 参数提取 → 日期/金额/部门/人员
    3. SQL生成 → Schema注入 + Prompt
    4. 安全校验 → 只读检查
    5. 执行查询 → 返回结果
    6. 结果渲染 → 表格/图表
    """

    def __init__(self, llm_client: Optional[LLMClient] = None):
        """
        初始化 NL2SQL 服务
        
        Args:
            llm_client: 可选的 LLMClient 实例，不传则自动创建
        """
        self._llm_client = llm_client or LLMClient()
        logger.info(f"[NL2SQLService] 初始化完成, LLM回退模式: {self._llm_client.is_fallback_mode}")

    # 意图关键词映射
    INTENT_KEYWORDS = {
        "费用查询": ["费用", "报销", "支出", "花费"],
        "凭证查询": ["凭证", "分录", "记账", "摘要"],
        "供应商查询": ["供应商", "采购", "付款", "应付款"],
        "部门查询": ["部门", "组织", "架构"],
        "审计查询": ["审计", "发现", "问题", "整改"],
        "风险查询": ["风险", "预警", "告警"],
        "排名查询": ["排名", "排行", "前", "top", "最多", "最少"],
        "统计查询": ["统计", "汇总", "合计", "总计", "平均"],
        "趋势查询": ["趋势", "变化", "对比", "同比", "环比"],
    }

    def process(self, query: str, user_id: str = None) -> Dict:
        """
        处理自然语言查询请求
        
        Args:
            query: 自然语言查询
            user_id: 用户ID（用于数据权限过滤）
            
        Returns:
            {sql, results, chart_type, template_id, tokens_used}
        """
        logger.info(f"[NL2SQL] 查询: {query}")

        # Step 1: 意图识别
        intent = self._detect_intent(query)
        
        # Step 2: 模板匹配
        template = self._match_template(query)
        
        if template:
            # 使用预置模板（快速路径）
            result = self._execute_template(template, query)
            result["method"] = "template"
            result["template_id"] = template.id
            return result

        # Step 3: NL2SQL生成（LLM路径）
        sql = self._generate_sql(query, intent)
        
        # Step 4: 安全检查
        if not self._validate_sql(sql):
            return {"error": "生成的SQL不安全", "sql": sql}

        # Step 5: 执行查询
        results, columns = self._execute(sql)
        
        # Step 6: 确定图表类型
        chart_type = self._suggest_chart(query, results)
        
        return {
            "query": query,
            "intent": intent,
            "sql": sql,
            "columns": columns,
            "results": results,
            "row_count": len(results),
            "chart_type": chart_type,
            "method": "nl2sql",
        }

    def _detect_intent(self, query: str) -> str:
        """通过关键词识别用户意图"""
        for intent, keywords in self.INTENT_KEYWORDS.items():
            for kw in keywords:
                if kw in query:
                    return intent
        return "通用查询"

    def _match_template(self, query: str) -> Optional[QueryTemplate]:
        """匹配预置查询模板"""
        query_lower = query.lower()
        best_match = None
        best_score = 0

        for tmpl in PRESET_TEMPLATES:
            score = sum(1 for tag in tmpl.tags if tag in query)
            # 名称关键词匹配加分
            name_words = tmpl.name[:4]
            if name_words in query:
                score += 3
            if score > best_score:
                best_score = score
                best_match = tmpl

        return best_match if best_score >= 1 else None

    def _execute_template(self, template: QueryTemplate, query: str) -> Dict:
        """
        执行查询模板
        
        从自然语言中提取参数，填充 SQL 模板，并尝试执行。
        参数提取使用 LLM 辅助，失败时使用默认值。
        
        Args:
            template: 匹配到的查询模板
            query: 用户自然语言查询
            
        Returns:
            包含 sql、参数、结果的字典
        """
        # 从自然语言中提取参数
        params = self._extract_params(query, template.parameters)
        
        # 填充 SQL 模板中的参数占位符
        filled_sql = template.sql_template.strip()
        for key, value in params.items():
            if isinstance(value, str):
                # 字符串类型参数需要加引号
                placeholder = f":{key}"
                filled_sql = filled_sql.replace(placeholder, f"'{value}'")
            elif isinstance(value, (int, float)):
                placeholder = f":{key}"
                filled_sql = filled_sql.replace(placeholder, str(value))
        
        logger.info(f"[NL2SQL] 模板查询: {template.id} params={params}")

        # 安全检查（防卫式编程，防止参数注入改写SQL）
        if not self._validate_sql(filled_sql):
            logger.warning(f"[NL2SQL] 填充后SQL未通过安全校验: {filled_sql[:200]}")
            return {"error": "填充后的SQL不安全", "sql": filled_sql, "template_id": template.id}

        # 尝试执行 SQL
        results, columns = self._execute(filled_sql)
        
        chart_type = template.default_chart
        if chart_type == "table" and results:
            # 根据结果自动推荐图表
            chart_type = self._suggest_chart(query, results)
        
        return {
            "query": query,
            "sql": filled_sql,
            "chart_type": chart_type,
            "parameters": params,
            "columns": columns,
            "results": results,
            "row_count": len(results),
        }

    def _generate_sql(self, query: str, intent: str) -> str:
        """
        LLM驱动的SQL生成
        
        构建包含 DB_SCHEMA 的 Prompt，调用 LLMClient 生成 SQL，
        解析 LLM 回复中的 SQL，做安全检查，失败时降级到回退 SQL。
        
        Args:
            query: 用户自然语言查询
            intent: 识别的意图
            
        Returns:
            生成的 SQL 语句
        """
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 构建系统提示词
        system_prompt = NL2SQL_SYSTEM_PROMPT.format(
            db_schema=DB_SCHEMA,
            current_time=current_time,
            intent=intent,
        )
        
        user_prompt = f"用户问题: {query}\n\n请根据以上信息生成 SQL 查询语句。"
        
        logger.info(f"[NL2SQL] LLM生成SQL: query={query}, intent={intent}")
        
        try:
            # 调用 LLM
            response = self._llm_client.chat(
                messages=user_prompt,
                system_prompt=system_prompt,
                temperature=0.3,  # SQL 生成使用低温度提高准确性
                max_tokens=1000,
            )
            
            # 从 LLM 回复中提取 SQL
            sql = self._extract_sql_from_response(response.content)
            
            if sql:
                logger.info(
                    f"[NL2SQL] LLM生成SQL成功: tokens={response.token_usage}, "
                    f"elapsed={response.elapsed_seconds:.2f}s"
                )
                return sql
            
            logger.warning("[NL2SQL] 未能从LLM回复中提取SQL，使用回退SQL")
            
        except Exception as e:
            logger.error(f"[NL2SQL] LLM生成SQL异常: {e}")
        
        # LLM 调用失败时使用回退 SQL
        logger.info(f"[NL2SQL] 使用回退SQL: intent={intent}")
        return self._fallback_sql(query, intent)

    @staticmethod
    def _extract_sql_from_response(response: str) -> Optional[str]:
        """
        从 LLM 回复中提取 SQL 语句
        
        处理可能存在的 markdown 代码块包裹（```sql ... ``` 或 ``` ... ```），
        以及纯文本回复中包含的 SQL。
        
        Args:
            response: LLM 的完整回复文本
            
        Returns:
            提取的 SQL 语句，未找到时返回 None
        """
        if not response:
            return None
        
        # 尝试匹配 ```sql ... ``` 代码块
        sql_block_pattern = r'```(?:sql)?\s*\n?(.*?)```'
        matches = re.findall(sql_block_pattern, response, re.DOTALL | re.IGNORECASE)
        if matches:
            sql = matches[-1].strip()  # 取最后一个代码块
            if sql:
                return sql
        
        # 尝试匹配 ``` ... ``` 通用代码块
        matches = re.findall(r'```\s*\n?(.*?)```', response, re.DOTALL)
        if matches:
            sql = matches[-1].strip()
            if sql.upper().startswith("SELECT") or sql.upper().startswith("WITH"):
                return sql
        
        # 逐行扫描寻找 SELECT/WITH 开头的行
        lines = response.strip().split("\n")
        sql_lines = []
        in_sql = False
        for line in lines:
            stripped = line.strip()
            if stripped.upper().startswith("SELECT") or stripped.upper().startswith("WITH"):
                in_sql = True
            if in_sql:
                sql_lines.append(stripped)
                if stripped.upper().startswith("LIMIT") or stripped.rstrip().endswith(";"):
                    break
        
        if sql_lines:
            return "\n".join(sql_lines)
        
        return None

    def _fallback_sql(self, query: str, intent: str) -> str:
        """无LLM时的回退SQL生成"""
        if "费用" in intent:
            return """
SELECT dept_name, category, SUM(amount) as total
FROM t_expense
WHERE status = 'approved'
GROUP BY dept_name, category
ORDER BY total DESC LIMIT 20
"""
        elif "凭证" in intent:
            return """
SELECT voucher_no, voucher_date, total_amount, maker
FROM t_voucher
WHERE status = 'posted'
ORDER BY voucher_date DESC LIMIT 20
"""
        elif "整改" in intent:
            return """
SELECT dept_name, status, COUNT(*) as count
FROM rectification_orders
GROUP BY dept_name, status
ORDER BY count DESC
"""
        else:
            return "SELECT '请在系统配置LLM后使用自然语言查询' AS message"

    def _validate_sql(self, sql: str) -> bool:
        """SQL安全校验"""
        sql_upper = sql.upper().strip()
        # 禁止写操作
        forbidden = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE"]
        for word in forbidden:
            if re.search(rf'\b{word}\b', sql_upper):
                logger.warning(f"[NL2SQL] 检测到危险操作: {word}")
                return False
        return True

    # 允许的安全SQL操作
    _ALLOWED_SQL_PREFIXES = ("SELECT", "SHOW", "DESCRIBE", "EXPLAIN", "DESC", "PRAGMA")
    # 禁止的SQL关键字（防止数据修改）
    _FORBIDDEN_KEYWORDS = (
        "DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "CREATE",
        "TRUNCATE", "GRANT", "REVOKE", "REPLACE",
    )

    def _execute(self, sql: str) -> Tuple[List[Dict], List[str]]:
        """Execute SQL and return (rows_as_dicts, column_names)

        Safety: only allows read-only SQL (SELECT/SHOW/DESCRIBE/EXPLAIN/PRAGMA).
        Blocks DDL/DML statements to prevent data modification.
        """
        from sqlalchemy import text
        from app.core.database import SessionLocal

        stripped = sql.strip()
        if not stripped:
            return [], []

        # 安全检查: 必须以只读关键字开头
        upper_sql = stripped.upper()
        if not any(upper_sql.startswith(p) for p in self._ALLOWED_SQL_PREFIXES):
            raise ValueError(f"仅允许只读查询 (SELECT/SHOW/DESCRIBE/EXPLAIN)，收到: {stripped[:50]}")

        # 安全检查: 不能包含写入关键字
        for kw in self._FORBIDDEN_KEYWORDS:
            if re.search(rf'\b{kw}\b', upper_sql):
                raise ValueError(f"禁止的SQL操作: {kw}，仅允许只读查询")

        logger.info(f"[NL2SQL] 执行: {sql[:200]}")
        db = SessionLocal()
        try:
            result = db.execute(text(sql))
            if result.returns_rows:
                rows = result.fetchall()
                columns = list(result.keys())
                data = [dict(zip(columns, row)) for row in rows]
                logger.info(f"[NL2SQL] 查询返回 {len(data)} 行, {len(columns)} 列")
                return data, columns
            return [], []
        except Exception as e:
            logger.error(f"[NL2SQL] SQL执行失败: {e}")
            raise
        finally:
            db.close()

    def _suggest_chart(self, query: str, results: List[Dict]) -> str:
        """根据查询内容和结果推荐图表类型"""
        if len(results) == 0:
            return "table"
        if "排名" in query or "排行" in query or "top" in query.lower():
            return "bar"
        if "趋势" in query or "变化" in query:
            return "line"
        if "比例" in query or "占比" in query or "分布" in query:
            return "pie"
        return "table"

    def _extract_params(self, query: str, param_defs: List[Dict]) -> Dict:
        """
        从自然语言中提取参数值
        
        优先使用 LLM 从自然语言中提取参数值，提取失败时使用默认值。
        
        Args:
            query: 用户自然语言查询
            param_defs: 参数定义列表
            
        Returns:
            参数名到参数值的映射字典
        """
        params = {}
        
        # 先填默认值
        for p in param_defs:
            if p.get("default") is not None:
                params[p["name"]] = p["default"]
        
        # 如果没有需要提取的参数，直接返回
        if not param_defs:
            return params
        
        # 尝试用 LLM 提取参数
        try:
            param_descriptions = "\n".join(
                f"- {p['name']} ({p.get('type', 'str')}): {p.get('label', p['name'])}"
                for p in param_defs
            )
            
            extract_prompt = (
                f"从以下自然语言查询中提取参数值：\n"
                f"查询: {query}\n\n"
                f"需要提取的参数：\n{param_descriptions}\n\n"
                f"以 JSON 格式返回，例如 {{\"start_date\": \"2024-01-01\", \"limit\": 10}}。\n"
                f"如果某个参数在查询中未提及，使用默认值 {{params}}。\n"
                f"只返回 JSON，不要加任何解释。"
            ).replace("{params}", str(params))
            
            if not self._llm_client.is_fallback_mode:
                response = self._llm_client.chat(
                    messages=extract_prompt,
                    temperature=0.1,
                    max_tokens=500,
                )
                
                # 尝试解析 JSON 响应
                import json
                content = response.content.strip()
                # 处理可能的 markdown 代码块
                if "```" in content:
                    json_match = re.search(r'```(?:json)?\s*\n?(.*?)```', content, re.DOTALL)
                    if json_match:
                        content = json_match.group(1).strip()
                
                extracted = json.loads(content)
                if isinstance(extracted, dict):
                    # 类型转换
                    for p in param_defs:
                        name = p["name"]
                        if name in extracted:
                            ptype = p.get("type", "str")
                            try:
                                if ptype == "int":
                                    params[name] = int(extracted[name])
                                elif ptype == "float" or ptype == "number":
                                    params[name] = float(extracted[name])
                                elif ptype == "date":
                                    # 保持字符串格式
                                    params[name] = str(extracted[name])
                                else:
                                    params[name] = str(extracted[name])
                            except (ValueError, TypeError):
                                # 类型转换失败，保留默认值
                                pass
        except Exception as e:
            logger.warning(f"[NL2SQL] LLM参数提取失败，使用默认值: {e}")
        
        return params

    # -- 查询模板管理 --

    def list_templates(self, category: str = None) -> List[Dict]:
        """列出查询模板"""
        templates = PRESET_TEMPLATES
        if category:
            templates = [t for t in templates if t.category == category]
        return [
            {
                "id": t.id, "name": t.name, "description": t.description,
                "category": t.category, "tags": t.tags,
                "parameters": t.parameters, "default_chart": t.default_chart,
            }
            for t in templates
        ]

    def get_template(self, template_id: str) -> Optional[Dict]:
        """获取单个模板"""
        for t in PRESET_TEMPLATES:
            if t.id == template_id:
                return {
                    "id": t.id, "name": t.name, "sql_template": t.sql_template,
                    "parameters": t.parameters, "default_chart": t.default_chart,
                }
        return None
