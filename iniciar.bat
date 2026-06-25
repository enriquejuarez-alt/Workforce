@echo off
echo ============================================
echo  Iniciando Nomina Konecta
echo ============================================
echo.

echo [0/3] Cerrando instancias anteriores...
taskkill /FI "WINDOWTITLE eq Backend - Nomina*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq App - Nomina*" /F >nul 2>&1

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

timeout /t 2 /nobreak >nul
echo  Limpieza lista.
echo.

echo [1/3] Verificando base de datos Docker...
docker start nomina-db >nul 2>&1
if %errorlevel% neq 0 (
    echo  Contenedor no encontrado, creando...
    docker run -d --name nomina-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=nomina_konecta -p 5433:5432 postgres:15 >nul 2>&1
)
echo  Base de datos lista.
echo.

timeout /t 2 /nobreak >nul

echo [2/3] Iniciando backend en puerto 3001...
start "Backend - Nomina" cmd /k "cd /d %~dp0backend && npm run dev"
timeout /t 4 /nobreak >nul

echo [3/3] Iniciando aplicacion en puerto 3000...
start "App - Nomina" cmd /k "cd /d %~dp0 && npm run dev"
echo.

echo ============================================
echo  Todo listo!
echo  App:  http://localhost:3000
echo ============================================
echo.

timeout /t 6 /nobreak >nul
start http://localhost:3000
