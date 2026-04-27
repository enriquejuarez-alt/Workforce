@echo off
echo ============================================
echo  Instalacion - Nomina Konecta
echo ============================================

echo.
echo [1/4] Instalando dependencias del backend...
cd backend
call npm install
echo.

echo [2/4] Generando cliente Prisma...
call npx prisma generate
echo.

echo [3/4] Instalando dependencias del frontend...
cd ..\frontend
call npm install
echo.

echo [4/4] Listo!
echo.
echo ============================================
echo  SIGUIENTE PASO: Configurar base de datos
echo ============================================
echo.
echo 1. Asegurate de tener PostgreSQL corriendo
echo 2. Edita backend\.env con tu DATABASE_URL
echo 3. Ejecuta: cd backend ^& npx prisma db push
echo 4. Ejecuta: cd backend ^& npx ts-node prisma/seed.ts
echo.
echo Para iniciar el sistema:
echo   Backend:  cd backend ^& npm run dev
echo   Frontend: cd frontend ^& npm run dev
echo.
pause
