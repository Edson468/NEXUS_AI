@echo off
echo ==============================================
echo Iniciando Servidor Backend RAG (FastAPI)...
echo ==============================================
cd /d "%~dp0backend"
..\.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
