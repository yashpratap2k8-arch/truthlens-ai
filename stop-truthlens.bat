@echo off
setlocal enabledelayedexpansion
title TruthLens AI - Stop Services

echo ===================================================
echo       TruthLens AI - Stopping Local Services
echo ===================================================
echo.

set STOPPED_ANY=0

REM 1. Stop Backend on port 8000
echo Checking for Backend process on port 8000...
set FOUND_8000=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    set "PID_8000=%%a"
    if defined PID_8000 (
        if not "!PID_8000!"=="0" (
            echo [TruthLens] Stopping Backend process tree [PID: !PID_8000!] ...
            taskkill /F /T /PID !PID_8000! >nul 2>&1
            set FOUND_8000=1
            set STOPPED_ANY=1
        )
    )
)

if !FOUND_8000!==0 (
    echo [TruthLens] No running backend detected on port 8000.
) else (
    echo [TruthLens] Backend on port 8000 stopped successfully.
)

echo.

REM 2. Stop Frontend on port 5173
echo Checking for Frontend process on port 5173...
set FOUND_5173=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    set "PID_5173=%%a"
    if defined PID_5173 (
        if not "!PID_5173!"=="0" (
            echo [TruthLens] Stopping Frontend process tree [PID: !PID_5173!] ...
            taskkill /F /T /PID !PID_5173! >nul 2>&1
            set FOUND_5173=1
            set STOPPED_ANY=1
        )
    )
)

if !FOUND_5173!==0 (
    echo [TruthLens] No running frontend detected on port 5173.
) else (
    echo [TruthLens] Frontend on port 5173 stopped successfully.
)

echo.
echo ===================================================
if !STOPPED_ANY!==1 (
    echo TruthLens AI development services have been stopped.
) else (
    echo No active TruthLens services were found running.
)
echo ===================================================
echo This window will close in 3 seconds...
timeout /t 3 /nobreak >nul
exit /b 0
