@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Deep-Tech Lab Inventory

where node >nul 2>nul || (
  echo [ERROR] Node.js is not installed or not available in PATH.
  pause
  exit /b 1
)

where npm >nul 2>nul || (
  echo [ERROR] npm is not installed or not available in PATH.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [SETUP] Installing project dependencies...
  call npm install
  if errorlevel 1 goto :fail
)

echo [SETUP] Preparing the local SQLite database...

rem Prisma finds DATABASE_URL in the nearest .env and resolves a relative
rem sqlite path from the current directory. So every Prisma command must run
rem from apps\api — running it from the repo root fails with error P1012.
pushd apps\api

if not exist "..\..\node_modules\.prisma\client\query_engine-windows.dll.node" (
  echo [SETUP] Generating Prisma client...
  call npx prisma generate --schema prisma/schema.prisma
  if errorlevel 1 (
    popd
    goto :fail
  )
)

call npx prisma db push --schema prisma/schema.prisma --skip-generate
if errorlevel 1 (
  popd
  goto :fail
)

if not exist "prisma\dev.db" (
  echo [SETUP] Adding initial lab data...
  call npx tsx prisma/seed.ts
  if errorlevel 1 (
    popd
    goto :fail
  )
)

popd

echo.
echo ===============================================================
echo  Deep-Tech Lab Inventory System is starting...
echo  Local Web URL:  http://localhost:5173
echo  API URL:        http://localhost:4000
echo.
echo  Default Login Credentials (password: Password@123):
echo   - Admin:   ADMIN001        Faculty In-Charge
echo   - Student: 2024BCSE042     Ayush Sharma
echo              2024BCSE017     Sara Khan
echo              2024BEEE088     Rohan Mehta
echo.
echo  Closing this window will STOP all servers immediately.
echo ===============================================================
echo.

start "" "http://localhost:5173"

call npm run dev

goto :eof

:fail
echo.
echo [ERROR] Startup preparation failed. Review the output above.
pause
exit /b 1
