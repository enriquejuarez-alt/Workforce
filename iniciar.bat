@echo off
echo Iniciando Nomina Konecta...
echo.
echo Iniciando backend en puerto 3001...
start "Backend - Nomina Konecta" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 3 /nobreak >nul
echo Iniciando frontend en puerto 5173...
start "Frontend - Nomina Konecta" cmd /k "cd /d %~dp0frontend && npm run dev"
echo.
echo El sistema estara disponible en: http://localhost:5173
echo.
timeout /t 5 /nobreak >nul
start http://localhost:5173
