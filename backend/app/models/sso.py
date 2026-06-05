"""
SSO单点登录模型
Single Sign-On Configuration

支持: 云之家、企业微信、LDAP、OAuth2/SAML
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, JSON
from app.core.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class SSOProvider(Base):
    """SSO身份提供方配置"""
    __tablename__ = "sso_providers"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    
    # 提供方信息
    provider = Column(String(30), nullable=False, comment="yunzhijia|wecom|ldap|oauth2|saml")
    name = Column(String(100), nullable=False, comment="提供方名称")
    
    # 连接配置
    config = Column(JSON, nullable=False, comment="""
        {
            yunzhijia: {app_id, app_secret, corp_id, redirect_uri},
            wecom: {corp_id, agent_id, secret, redirect_uri},
            oauth2: {client_id, client_secret, authorize_url, token_url, userinfo_url},
            saml: {entity_id, sso_url, x509_cert},
            ldap: {server_url, base_dn, bind_dn, bind_password}
        }
    """)
    
    # 映射配置
    attribute_mapping = Column(JSON, comment="""
        {username: 'userid', email: 'email', full_name: 'name', dept: 'department'}
    """)
    
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False, comment="是否默认提供方")
    
    # 自动创建用户
    auto_create_user = Column(Boolean, default=True)
    default_role_code = Column(String(50), default="viewer")
    
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


class SSOLog(Base):
    """SSO登录日志"""
    __tablename__ = "sso_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    
    provider = Column(String(30), nullable=False)
    user_id = Column(String(36), comment="关联用户ID")
    sso_subject = Column(String(100), comment="SSO主体标识")
    
    action = Column(String(30), comment="login|logout|link|unlink")
    result = Column(String(20), comment="success|failed|error")
    error_message = Column(Text)
    
    ip_address = Column(String(50))
    user_agent = Column(Text)
    
    created_at = Column(DateTime, default=datetime.now)
