@echo off
chcp 65001 >nul
echo ========================================
echo  智能审计系统 - 后端服务启动脚本
echo ========================================
echo.

set "APP_DIR=F:\AuditSystem\intelligent-audit-system\backend"
set "PYTHON=C:\Users\ADMIN\.workbuddy\binaries\python\versions\3.13.12\python.exe"

cd /d "%APP_DIR%"

echo [%date% %time%] 正在启动后端服务...
echo 目录: %APP_DIR%
echo.

"%PYTHON%" -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --log-level warning

if errorlevel 1 (
    echo [%date% %time%] 启动失败，错误码: %errorlevel%
    pause
    exit /b %errorlevel%
)
