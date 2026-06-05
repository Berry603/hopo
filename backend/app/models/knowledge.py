"""
知识管理中心模型
Knowledge Management Center Models
"""

from sqlalchemy import Column, String, DateTime, Enum as SQLEnum, Text, ForeignKey, Integer, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum as PyEnum
import uuid

from app.core.database import Base


class KnowledgeType(str, PyEnum):
    """知识类型枚举"""
    REGULATION = "regulation"       # 法规
    CASE = "case"                   # 案例
    POLICY = "policy"               # 制度
    TEMPLATE = "template"           # 模板
    BEST_PRACTICE = "best_practice"  # 最佳实践


class KnowledgeItem(Base):
    """
    知识库表（统一知识库）
    """
    __tablename__ = "knowledge_items"
    
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    item_id = Column(String(50), unique=True, nullable=False, comment="知识编号")
    
    # 基本信息
    title = Column(String(500), nullable=False, comment="标题")
    description = Column(Text, nullable=True, comment="描述")
    knowledge_type = Column(SQLEnum(KnowledgeType), nullable=False, comment="知识类型")
    
    # 内容
    content = Column(Text, nullable=True, comment="内容")
    content_format = Column(String(20), default="markdown", comment="内容格式")
    
    # 分类和标签
    category = Column(String(100), nullable=True, comment="分类")
    subcategory = Column(String(100), nullable=True, comment="子分类")
    tags = Column(JSON, nullable=True, comment="标签列表")
    
    # 来源
    source = Column(String(200), nullable=True, comment="来源")
    source_url = Column(String(1000), nullable=True, comment="来源URL")
    source_id = Column(String(100), nullable=True, comment="来源ID")
    
    # 适用领域
    applicable_domains = Column(JSON, nullable=True, comment="适用领域列表")
    applicable_departments = Column(JSON, nullable=True, comment="适用部门列表")
    
    # 状态
    is_active = Column(String(1), default="1", comment="是否激活")
    is_exemplary = Column(String(1), default="0", comment="是否优秀案例")
    view_count = Column(Integer, default=0, comment="浏览次数")
    
    # 关联
    related_findings = Column(JSON, nullable=True, comment="相关发现ID列表")
    related_regulations = Column(JSON, nullable=True, comment="相关法规ID列表")
    
    # 向量化（用于RAG）
    embedding_vector = Column(JSON, nullable=True, comment="嵌入向量")
    vector_updated_at = Column(DateTime(timezone=True), nullable=True, comment="向量更新时间")
    
    # 元数据
    created_by_id = Column(String(36), ForeignKey("users.id"), nullable=False, comment="创建人ID")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), comment="创建时间")
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), comment="更新时间")
    
    # 关系
    created_by = relationship("User", backref="created_knowledge_items")
    
    def __repr__(self):
        return f"<KnowledgeItem {self.item_id} - {self.title}>"


class Regulation(KnowledgeItem):
    """
    法规表（继承知识库）
    """
    __tablename__ = "regulations"
    
    id = Column(String(36), ForeignKey("knowledge_items.id"), primary_key=True)
    
    # 法规特有字段
    issuing_authority = Column(String(200), nullable=True, comment="发布机构")
    document_number = Column(String(100), nullable=True, comment="文号")
    publish_date = Column(DateTime(timezone=True), nullable=True, comment="发布日期")
    effective_date = Column(DateTime(timezone=True), nullable=True, comment="生效日期")
    expiry_date = Column(DateTime(timezone=True), nullable=True, comment="失效日期")
    
    # 法规状态
    regulation_status = Column(String(20), default="effective", comment="法规状态")
    change_type = Column(String(50), nullable=True, comment="变化类型")
    
    # 影响评估
    impact_assessment = Column(Text, nullable=True, comment="影响评估")
    affected_departments = Column(JSON, nullable=True, comment="影响部门列表")
    
    # 采集信息
    crawled_from = Column(String(100), nullable=True, comment="采集来源")
    crawled_at = Column(DateTime(timezone=True), nullable=True, comment="采集时间")
    
    def __repr__(self):
        return f"<Regulation {self.document_number} - {self.title}>"


class CaseStudy(KnowledgeItem):
    """
    审计案例表（继承知识库）
    """
    __tablename__ = "case_studies"
    
    id = Column(String(36), ForeignKey("knowledge_items.id"), primary_key=True)
    
    # 案例特有字段
    audit_type = Column(String(100), nullable=True, comment="审计类型")
    risk_type = Column(String(100), nullable=True, comment="风险类型")
    severity = Column(String(20), nullable=True, comment="严重程度")
    
    # 案例详情
    background = Column(Text, nullable=True, comment="案例背景")
    audit_procedure = Column(Text, nullable=True, comment="审计程序")
    audit_finding = Column(Text, nullable=True, comment="审计发现")
    root_cause = Column(Text, nullable=True, comment="根本原因")
    recommendation = Column(Text, nullable=True, comment="审计建议")
    outcome = Column(Text, nullable=True, comment="整改结果")
    
    # 参考价值
    relevance_score = Column(Integer, default=0, comment="参考价值评分")
    
    def __repr__(self):
        return f"<CaseStudy {self.item_id} - {self.title}>"
