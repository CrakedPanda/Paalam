@echo off
cd /d "%~dp0"
set "PAALAM_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "PAALAM_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "public\vendor\manifest.json" (
  "%PAALAM_NODE%" setup.mjs
  if errorlevel 1 goto fail
)
"%PAALAM_NODE%" server.mjs --open
:fail
pause
