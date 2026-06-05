@echo off
chcp 65001 >nul
cd /d "C:\Users\ADMIN\WorkBuddy\2026-06-05-13-54-42\intelligent-audit-system\frontend"
set "PATH=C:\Users\ADMIN\.workbuddy\binaries\node\versions\22.22.2;%PATH%"
echo 🚀 启动 HOPO ICMS 前端...
npx vite --host 0.0.0.0 --port 3000
pause
