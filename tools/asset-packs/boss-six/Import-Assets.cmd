@echo off
setlocal
title Boss 6 Sprite Import
set /p "BOSS_SPRITE_SOURCE=Paste or drag the downloaded ZIP/folder here: "
set "BOSS_SPRITE_SOURCE=%BOSS_SPRITE_SOURCE:"=%"
python "%~dp0manage-assets.py" import --source "%BOSS_SPRITE_SOURCE%"
if errorlevel 1 echo Import failed. Review the error above.
pause
