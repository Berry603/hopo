@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ===== 配置 =====
set "APP_DIR=F:\AuditSystem\intelligent-audit-system\backend"
set "PYTHON=C:\Users\ADMIN\.workbuddy\binaries\python\versions\3.13.12\python.exe"
set "LOG_DIR=F:\AuditSystem\intelligent-audit-system\logs"
set "LOG_FILE=%LOG_DIR%\backend_%date:~0,4%%date:~5,2%%date:~8,2%.log"

:: 确保日志目录存在
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

cd /d "%APP_DIR%"

echo ======================================== >> "%LOG_FILE%"
echo [%date% %time%] 后端服务启动中... >> "%LOG_FILE%"
echo ======================================== >> "%LOG_FILE%"

:: 启动后端，输出到日志文件
"%PYTHON%" -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --log-level warning >> "%LOG_FILE%" 2>&1

:: 如果异常退出，记录日志
echo [%date% %time%] 后端服务异常退出，错误码: %errorlevel% >> "%LOG_FILE%"
