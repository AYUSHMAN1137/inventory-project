@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Deep-Tech Lab Inventory

set "DATABASE_URL=file:./dev.db"

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
if not exist "node_modules\.prisma\client\query_engine-windows.dll.node" (
  call npx prisma generate --schema apps/api/prisma/schema.prisma
  if errorlevel 1 goto :fail
)
call npx prisma db push --schema apps/api/prisma/schema.prisma --skip-generate
if errorlevel 1 goto :fail

if not exist "apps\api\prisma\dev.db" (
  echo [SETUP] Adding initial lab data...
  call npm run prisma:seed --workspace=apps/api
  if errorlevel 1 goto :fail
)

echo.
echo ===============================================================
echo  Deep-Tech Lab Inventory System is starting...
echo  Local Web URL:  http://localhost:5173
echo  API URL:        http://localhost:4000
echo.
echo  Default Login Credentials:
echo   - Admin:   ADMIN001    ^| Password: Password@123
echo   - Student: 2024BCSE042 ^| Password: Password@123
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
