@echo off
echo ======================================================
echo HOPO 智能审计系统 - 项目安装脚本
echo Intelligent Audit System - Setup Script
echo ======================================================

echo [1/3] 安装后端依赖...
cd backend
python -m pip install -r requirements.txt --upgrade
echo.

echo [2/3] 安装前端依赖...
cd ..\frontend
call npm install
echo.

echo [3/3] 初始化数据库...
cd ..\backend
python -c "from app.core.database import init_db; init_db()"
echo.

echo ======================================================
echo 安装完成！
echo 启动后端: cd backend && uvicorn app.main:app --reload
echo 启动前端: cd frontend && npm run dev
echo API文档: http://localhost:8000/docs
echo 前端: http://localhost:3000
echo ======================================================
pause