@echo off
setlocal
set "LEXICAL_FIREBASE_CLI_LIB="
for /f "delims=" %%F in ('where firebase.cmd 2^>nul') do if not defined LEXICAL_FIREBASE_CLI_LIB set "LEXICAL_FIREBASE_CLI_LIB=%%~dpFnode_modules\firebase-tools\lib"
if not defined LEXICAL_FIREBASE_CLI_LIB (
  echo Install the Firebase CLI and sign in with firebase login.
  pause
  exit /b 1
)
node "%~dp0clean-expired-deck-codes.cjs" %*
set "cleanup_result=%errorlevel%"
if "%~1"=="" pause
exit /b %cleanup_result%
