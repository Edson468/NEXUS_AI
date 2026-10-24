@echo off
title NEXUS AI Launcher
echo =======================================================
echo          Iniciando NEXUS AI - Agente Inteligente
echo =======================================================
echo.
echo [1/2] Iniciando Backend FastAPI na porta 8000...
start "NEXUS AI - Backend" cmd /c "run_backend.bat"

timeout /t 2 /nobreak >nul

echo [2/2] Iniciando Frontend Vite na porta 5173...
start "NEXUS AI - Frontend" cmd /c "run_frontend.bat"

echo.
echo Tudo pronto! O frontend estara disponivel em: http://localhost:5173
echo.
pause
