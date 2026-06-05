@echo off
echo 启动 HOPO 智能审计系统...

start "后端服务" cmd /c "cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 5 /nobreak >nul

start "前端服务" cmd /c "cd frontend && npm run dev"

echo 后端服务: http://localhost:8000
echo 前端服务: http://localhost:3000
echo API文档: http://localhost:8000/docs

timeout /t 3 /nobreak >nul

start http://localhost:3000
pause