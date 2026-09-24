@echo off
title IMRAN ARAIN KARYANA - First time setup
cd /d "%~dp0"
echo.
echo ============================================
echo   IMRAN ARAIN KARYANA - Setup
echo ============================================
echo.
echo Step 1: Installing dependencies...
call npm install --no-audit --no-fund
if errorlevel 1 goto :error
echo.
echo Step 2: Building the production app...
call npm run build
if errorlevel 1 goto :error
echo.
echo Setup complete! Now double-click START-APP.BAT to run the app.
pause
goto :eof
:error
echo.
echo Something went wrong. Close this window and run SETUP.BAT again.
pause