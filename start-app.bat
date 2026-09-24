@echo off
title IMRAN ARAIN KARYANA
cd /d "%~dp0"
echo Starting IMRAN ARAIN KARYANA...
echo.
if exist ".next\BUILD_ID" (
  echo Opening browser, please wait a few seconds...
  start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"
  npm run start
) else (
  echo Production build not found - starting development server...
  start "" cmd /c "timeout /t 10 /nobreak >nul && start http://localhost:3000"
  npm run dev
)
pause