@echo off
setlocal
cd /d "%~dp0"
py -3 -c "import sys; sys.exit(sys.version_info < (3,8))" >nul 2>&1
if errorlevel 1 goto suite_find_user_python
py -3 "%~dp0run-local.py" %*
goto suite_done

:suite_find_user_python
for /d %%P in ("%LOCALAPPDATA%\Programs\Python\Python*") do (
  if exist "%%~fP\python.exe" (
    call :suite_test_python "%%~fP\python.exe"
    if not errorlevel 1 goto suite_run_python
  )
)
for /d %%P in ("%ProgramFiles%\Python*") do (
  if exist "%%~fP\python.exe" (
    call :suite_test_python "%%~fP\python.exe"
    if not errorlevel 1 goto suite_run_python
  )
)
python -c "import sys; sys.exit(sys.version_info < (3,8))" >nul 2>&1
if errorlevel 1 goto suite_no_python
python "%~dp0run-local.py" %*
goto suite_done

:suite_test_python
"%~1" -c "import sys; sys.exit(sys.version_info < (3,8))" >nul 2>&1
if errorlevel 1 exit /b 1
set "suitePython=%~1"
exit /b 0

:suite_run_python
"%suitePython%" "%~dp0run-local.py" %*
goto suite_done

:suite_no_python
echo Python 3 was not found. Install Python 3 and run this file again.
pause
exit /b 1

:suite_done
set "suiteExit=%errorlevel%"
if not "%suiteExit%"=="0" pause
exit /b %suiteExit%
