@echo off
setlocal
cd /d "%~dp0"

set "LS_PYTHON="
where py >nul 2>&1
if not errorlevel 1 (
  py -3 -c "import sys" >nul 2>&1
  if not errorlevel 1 set "LS_PYTHON=py -3"
)
if not defined LS_PYTHON (
  python -c "import sys" >nul 2>&1
  if not errorlevel 1 set "LS_PYTHON=python"
)
if not defined LS_PYTHON (
  echo Python 3 was not found. Install it from https://www.python.org/downloads/
  pause
  exit /b 1
)

%LS_PYTHON% -c "import socket; s=socket.socket(); result=s.connect_ex(('127.0.0.1',8780)); s.close(); raise SystemExit(result == 0)"
if errorlevel 1 (
  echo Port 8780 is already in use. Close the other local server and try again.
  pause
  exit /b 1
)

echo Opening LexicalSpace at http://127.0.0.1:8780/
echo Keep this window open. An internet connection is required for Firebase.
echo Press Ctrl+C or close this window to stop.
%LS_PYTHON% serve_local.py
echo.
echo The local server stopped. If it did not start, check the message above.
pause
