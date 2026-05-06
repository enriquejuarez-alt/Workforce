@echo off
echo ============================================
echo  Iniciando Nomina Konecta + Planificacion
echo ============================================
echo.

echo [0/4] Cerrando instancias anteriores...
taskkill /FI "WINDOWTITLE eq Backend - Nomina*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Frontend - Nomina*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Planificacion - Walt*" /F >nul 2>&1

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

timeout /t 2 /nobreak >nul
echo  Limpieza lista.
echo.

echo [1/4] Verificando base de datos Docker...
docker start nomina-db >nul 2>&1
if %errorlevel% neq 0 (
    echo  Contenedor no encontrado, creando...
    docker run -d --name nomina-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=nomina_konecta -p 5433:5432 postgres:15 >nul 2>&1
)
echo  Base de datos lista.
echo.

timeout /t 2 /nobreak >nul

echo [2/4] Iniciando backend en puerto 3001...
start "Backend - Nomina" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 4 /nobreak >nul

echo [3/4] Iniciando frontend en puerto 5173...
start "Frontend - Nomina" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 2 /nobreak >nul

echo [4/4] Iniciando Planificacion en puerto 3000...
start "Planificacion - Walt" cmd /k "cd /d C:\Users\joako\Desktop\Plani\konecta-hc && pnpm dev"
echo.

echo ============================================
echo  Todo listo!
echo  Nomina:         http://localhost:5173
echo  Planificacion:  http://localhost:3000
echo ============================================
echo.

timeout /t 6 /nobreak >nul
start http://localhost:5173
