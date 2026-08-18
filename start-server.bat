@echo off
echo Starting Pete ^& Elise Italy Honeymoon...
echo.
echo Opening in browser at http://localhost:8080
echo Press Ctrl+C to stop the server.
echo.
cd /d "%~dp0"
python -m http.server 8080
pause
