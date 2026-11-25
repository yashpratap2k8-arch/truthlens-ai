@echo off
setlocal enabledelayedexpansion
title TruthLens AI - Startup Launcher

echo ===================================================
echo       TruthLens AI - Local Development Launcher
echo ===================================================
echo.

set "PROJECT_ROOT=%~dp0"
if not exist "!PROJECT_ROOT!backend\app\main.py" (
    if exist "!PROJECT_ROOT!fake-news-analyzer\backend\app\main.py" (
        set "PROJECT_ROOT=!PROJECT_ROOT!fake-news-analyzer\"
    )
)

if not exist "!PROJECT_ROOT!backend\app\main.py" (
    echo [ERROR] Could not locate TruthLens backend at:
    echo   "!PROJECT_ROOT!backend"
    echo.
    echo Please make sure start-truthlens.bat is located in your TruthLens folder.
    pause
    exit /b 1
)

set "PYTHON_EXE=!PROJECT_ROOT!backend\venv\Scripts\python.exe"

if not exist "!PYTHON_EXE!" (
    echo [ERROR] Virtual environment python.exe not found at:
    echo   "!PYTHON_EXE!"
    echo Please ensure backend\venv exists.
    pause
    exit /b 1
)

where.exe npm.cmd >nul 2>&1
if !errorlevel! neq 0 (
    where.exe npm >nul 2>&1
    if !errorlevel! neq 0 (
        echo [ERROR] Node.js / npm was not found in your system PATH.
        echo Please ensure Node.js is installed.
        pause
        exit /b 1
    )
)

REM 0. DETECT LAPTOP LAN IPv4 ADDRESS
set "LAN_IP=127.0.0.1"
if exist "!PROJECT_ROOT!backend\app\get_lan_ip.py" (
    pushd "!PROJECT_ROOT!backend"
    for /f "delims=" %%a in ('venv\Scripts\python.exe app\get_lan_ip.py') do (
        set "LAN_IP=%%a"
    )
    popd
)

if "!LAN_IP!"=="" set "LAN_IP=127.0.0.1"
if "!LAN_IP!"=="127.0.0.1" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i /c:"IPv4 Address"') do (
        if "!LAN_IP!"=="127.0.0.1" (
            for /f "tokens=1" %%b in ("%%a") do set "LAN_IP=%%b"
        )
    )
)

echo [Network] Detected LAN IPv4 Address: !LAN_IP!

REM 1. BACKEND PROCESS MANAGEMENT (Port 8000, 0.0.0.0)
set BACKEND_RUNNING=0
netstat -ano | findstr :8000 | findstr LISTENING >nul 2>&1
if !errorlevel!==0 (
    set BACKEND_RUNNING=1
)

if !BACKEND_RUNNING!==1 (
    echo [1/3] Backend is already running on port 8000 [reusing existing process].
) else (
    echo [1/3] Starting FastAPI Backend on 0.0.0.0:8000 ...
    start "TruthLens AI - Backend (Port 8000)" /D "!PROJECT_ROOT!backend" cmd /k ""!PYTHON_EXE!" -m uvicorn app.main:app --app-dir "!PROJECT_ROOT!backend" --host 0.0.0.0 --port 8000"
)

REM 2. FRONTEND PROCESS MANAGEMENT (Port 5173, 0.0.0.0)
set FRONTEND_RUNNING=0
netstat -ano | findstr :5173 | findstr LISTENING >nul 2>&1
if !errorlevel!==0 (
    set FRONTEND_RUNNING=1
)

if !FRONTEND_RUNNING!==1 (
    echo [2/3] Frontend is already running on port 5173 [reusing existing process].
) else (
    echo [2/3] Starting Vite Frontend on 0.0.0.0:5173 ...
    start "TruthLens AI - Frontend (Port 5173)" /D "!PROJECT_ROOT!frontend" cmd /k npm.cmd run dev
)

REM 3. HEALTH CHECK & BROWSER LAUNCH
echo.
echo [3/3] Checking services health...

set BACKEND_READY=0
for /L %%i in (1,1,15) do (
    if !BACKEND_READY!==0 (
        curl.exe -s -m 1 http://127.0.0.1:8000/api/health >nul 2>&1
        if !errorlevel!==0 (
            set BACKEND_READY=1
            echo [TruthLens] Backend is UP and responding: http://127.0.0.1:8000/api/health
        ) else (
            timeout /t 1 /nobreak >nul 2>&1
        )
    )
)

if !BACKEND_READY!==0 (
    echo [WARNING] Backend did not respond within 15 seconds.
    echo Check the "TruthLens AI - Backend (Port 8000)" terminal window for error details.
)

set FRONTEND_READY=0
for /L %%i in (1,1,15) do (
    if !FRONTEND_READY!==0 (
        netstat -ano | findstr :5173 | findstr LISTENING >nul 2>&1
        if !errorlevel!==0 (
            set FRONTEND_READY=1
            echo [TruthLens] Frontend is UP and listening on port 5173.
        ) else (
            timeout /t 1 /nobreak >nul 2>&1
        )
    )
)

if !FRONTEND_READY!==0 (
    echo [WARNING] Frontend did not become active on port 5173 within 15 seconds.
    echo Check the "TruthLens AI - Frontend (Port 5173)" terminal window for error details.
)

timeout /t 1 /nobreak >nul 2>&1

echo.
echo [TruthLens] Opening browser at http://localhost:5173/ ...
start "" "http://localhost:5173/"

echo.
echo ===================================================
echo TruthLens AI is running and ready for LAN demo!
echo.
echo LOCAL ACCESS (This Laptop):
echo   Frontend : http://localhost:5173/
echo   Backend  : http://127.0.0.1:8000/
echo   API Docs : http://127.0.0.1:8000/docs
echo.
echo LAN DEMO ACCESS (Phone / Friends on Same Wi-Fi):
echo   Frontend : http://!LAN_IP!:5173/
echo   Backend  : http://!LAN_IP!:8000/
echo   API Docs : http://!LAN_IP!:8000/docs
echo.
echo Note: Ensure your mobile phone or testing laptop is
echo connected to the same Wi-Fi network (!LAN_IP!).
echo.
echo To safely stop all services:
echo   Double-click stop-truthlens.bat
echo ===================================================
echo This launcher window will close automatically in 10 seconds.
timeout /t 10 /nobreak >nul 2>&1
exit /b 0
