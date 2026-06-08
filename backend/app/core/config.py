"""
配置管理模块
Configuration Management Module
"""

from pydantic_settings import BaseSettings
from typing import List, Optional
import os
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """应用配置类"""
    
    # 项目配置
    PROJECT_NAME: str = "智能审计系统"
    PROJECT_NAME_EN: str = "Intelligent Audit System"
    VERSION: str = "1.0.0"
    
    # API配置
    API_V1_STR: str = "/api/v1"
    
    # 环境配置
    ENVIRONMENT: str = "development"  # development, staging, production
    DEBUG: bool = True
    
    # 跨域配置
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
    ]
    
    # 数据库配置 - PostgreSQL (生产)
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "audit_db"
    POSTGRES_PORT: str = "5432"
    SQLALCHEMY_DATABASE_URI: Optional[str] = None
    
    # 数据库配置 - SQLite (开发)
    USE_SQLITE: bool = True
    SQLITE_DB_PATH: str = str(BASE_DIR / "audit.db")
    
    # Redis配置
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: Optional[str] = None
    REDIS_DB: int = 0
    
    # JWT配置
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24小时
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Celery配置
    CELERY_BROKER_URL: Optional[str] = None
    CELERY_RESULT_BACKEND: Optional[str] = None
    
    # 文件上传配置
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB
    UPLOAD_DIR: str = str(BASE_DIR / "uploads")
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".png", ".jpg", ".jpeg"]
    
    # AI配置
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_API_BASE: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-3.5-turbo"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    
    # 日志配置
    LOG_LEVEL: str = "INFO"
    LOG_DIR: str = str(BASE_DIR / "logs")
    
    class Config:
        """Pydantic配置"""
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"
    
    @property
    def SQLALCHEMY_DATABASE_URI_BUILD(self) -> str:
        """构建数据库连接URI"""
        if self.SQLALCHEMY_DATABASE_URI:
            return self.SQLALCHEMY_DATABASE_URI
        
        if self.USE_SQLITE:
            return f"sqlite:///{self.SQLITE_DB_PATH}"
        else:
            return (
                f"postgresql+psycopg2://"
                f"{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
                f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
    
    @property
    def CELERY_BROKER_URL_BUILD(self) -> str:
        """构建Celery Broker URL"""
        if self.CELERY_BROKER_URL:
            return self.CELERY_BROKER_URL
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
    
    @property
    def CELERY_RESULT_BACKEND_BUILD(self) -> str:
        """构建Celery Result Backend URL"""
        if self.CELERY_RESULT_BACKEND:
            return self.CELERY_RESULT_BACKEND
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"


# 创建全局配置实例
settings = Settings()

# 确保必要的目录存在
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.LOG_DIR, exist_ok=True)
