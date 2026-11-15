@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-github.ps1"
if errorlevel 1 echo Update failed. Read the message above before trying again.
pause
