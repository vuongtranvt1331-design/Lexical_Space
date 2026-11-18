@echo off
setlocal
pushd "%~dp0"
where py >nul 2>nul
if errorlevel 1 goto use_python
set "runner=py -3"
goto pack
:use_python
set "runner=python"
:pack
%runner% tools\pack-dictation.py %*
set "pack_status=%errorlevel%"
if not exist apps\quick-ears\lesson-packs\available.json goto done
%runner% tools\build-suite.py
if errorlevel 1 set "pack_status=1"
:done
popd
pause
exit /b %pack_status%
