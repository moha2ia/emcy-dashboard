@echo off
title EMCY Dashboard Launcher
echo Starting EMCY Dashboard (API + Web)...

REM Start the API server first (port 5000)
start "EMCY API" cmd /k "cd /d %~dp0server && npm run dev"

REM Give the API a moment, then start the web client (port 5173)
timeout /t 2 /nobreak >nul
start "EMCY Web" cmd /k "cd /d %~dp0client && npm run dev"

echo.
echo Both servers are starting in separate windows:
echo   Web app : http://localhost:5173
echo   API     : http://localhost:5000/api/health
echo   Login   : admin@emcy.com / admin123
echo.
echo Close the two windows to stop the dashboard.
