@echo off
setlocal
for /f "delims=" %%F in ('where firebase.cmd 2^>nul') do if not defined LEXICAL_FIREBASE_CLI_LIB set "LEXICAL_FIREBASE_CLI_LIB=%%~dpFnode_modules\firebase-tools\lib"
if not defined LEXICAL_FIREBASE_CLI_LIB (
  echo Install firebase-tools with npm and run firebase login first.
  pause
  exit /b 1
)
node "%~dp0enable-deck-ttl.cjs"
set "TTL_RESULT=%ERRORLEVEL%"
if /i not "%~1"=="--quiet" pause
exit /b %TTL_RESULT%
