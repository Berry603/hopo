# HOPO 智能审计系统 (ICMS)

## 📋 项目概述

企业智能审计系统 - 以“数据驱动、智能作业”为核心，覆盖“数据采集→质量校验→风险预警→智能查询→审计作业→整改跟踪→知识沉淀”全链路。

## 🏗️ 技术架构

### 技术栈
- **前端**: React 18 + TypeScript 5 + Ant Design 5 + ECharts 5 + Vite
- **后端**: Python FastAPI + SQLAlchemy 2.0 + Celery + Redis
- **数据库**: SQLite (开发) / PostgreSQL 15+ (生产)
- **认证**: OAuth2.0 + JWT + SSO对接

### 品牌规范
- **主色**: HOPO红 #E34D59
- **背景**: #F5F6F7
- **侧边栏**: #1F1F1F

## 📦 项目结构

```
intelligent-audit-system/
├── backend/                    # 后端FastAPI应用
│   ├── app/
│   │   ├── api/v1/            # API路由
│   │   │   └── endpoints/     # API端点
│   │   ├── models/            # 数据模型
│   │   ├── schemas/           # Pydantic Schema
│   │   ├── services/          # 业务逻辑
│   │   ├── core/              # 核心配置
│   │   ├── middleware/        # 中间件
│   │   └── tasks/             # Celery任务
│   ├── migrations/            # 数据库迁移
│   ├── tests/                 # 测试文件
│   └── requirements.txt
├── frontend/                  # 前端React应用
│   ├── src/
│   │   ├── components/        # 通用组件
│   │   ├── pages/             # 页面组件
│   │   ├── services/          # API服务
│   │   ├── store/             # 状态管理
│   │   ├── hooks/             # 自定义Hooks
│   │   ├── styles/            # 样式文件
│   │   └── layouts/           # 布局组件
│   ├── public/                # 静态资源
│   └── package.json
├── scripts/                   # 脚本工具
└── docs/                      # 文档
```

## 🚀 快速开始

### 安装依赖
```bash
# 后端
cd backend
pip install -r requirements.txt

# 前端
cd frontend
npm install
```

### 初始化数据库
```bash
cd backend
python -c "from app.core.database import init_db; init_db()"
```

### 启动服务
```bash
# 后端 (http://localhost:8000)
cd backend
uvicorn app.main:app --reload

# 前端 (http://localhost:3000)
cd frontend
npm run dev
```

### API文档
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 🎯 P0级功能模块

| 模块 | 功能 | 状态 |
|------|------|------|
| M1 数据治理与质量中心 | 质量规则、同步监控、数据血缘 | ✅ |
| M2 风险预警中心 | 规则引擎、风险扫描、预警清单 | ✅ |
| M3 智能查询中心 | NL2SQL、审计Agent | ✅ |
| M4 审计作业中心 | 项目管理、底稿、报告 | ✅ |
| M7 整改跟踪中心 | 工单管理、验证、统计 | ✅ |
| M9 知识管理中心 | 法规库、案例库、RAG | ✅ |

## 📊 数据模型

已实现的P0级数据模型：
- `users` - 用户表
- `audit_projects` - 审计项目表
- `risk_rules` - 风险规则表
- `risk_alerts` - 风险预警事件表
- `rectification_orders` - 整改工单表
- `rectification_evidences` - 整改证据表
- `audit_findings` - 审计发现表
- `audit_tasks` - 审计任务表
- `audit_worksheets` - 审计底稿表
- `knowledge_items` - 知识库表
- `regulations` - 法规表
- `case_studies` - 案例库表
- `data_quality_rules` - 质量规则表
- `data_quality_reports` - 质量报告表
- `sync_status` - 同步状态表
- `data_lineage` - 数据血缘表

## 🔧 API接口

已实现的P0级API端点：
- `/api/v1/auth` - 认证管理 (登录/注册/刷新Token)
- `/api/v1/users` - 用户管理 (CRUD)
- `/api/v1/audit/projects` - 审计项目管理 (CRUD)
- `/api/v1/risk` - 风险预警中心 (规则/预警事件)
- `/api/v1/rectification` - 整改跟踪中心 (工单/证据)
- `/api/v1/knowledge` - 知识管理中心 (检索/案例)
- `/api/v1/data-quality` - 数据治理中心 (规则/报告/同步)
- `/api/v1/query` - 智能查询中心 (NL2SQL/Agent)

## 📝 开发规范

1. **模块独立开发**: 每个模块作为独立功能包，通过API接口通信
2. **先建数据模型**: 每开发一个模块前，先建好对应表
3. **API First**: 前后端分离，先定义API契约再开发
4. **组件原子化**: 前端组件按Atom→Molecule→Organism层级组织
5. **适配器模式**: 数据源接入严格遵循BaseDataSourceAdapter接口

## 📄 许可证

内部使用 - HOPO 好博窗控技术股份有限公司