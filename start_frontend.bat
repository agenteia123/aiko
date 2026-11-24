@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules" (
  echo Faltan dependencias. Ejecuta npm install en esta carpeta primero.
  pause
  exit /b 1
)
npm run dev -- --host 127.0.0.1
pause
