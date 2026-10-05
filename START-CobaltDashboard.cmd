@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js is missing. Install Node.js 20 or newer, then run this again.
  pause
  exit /b 1
)
if not exist "src\application\services\cobalt-spy-source.ts" (
  echo The project folder is incomplete. Extract the entire repair ZIP here.
  pause
  exit /b 1
)
echo Checking project dependencies...
call npx.cmd --yes pnpm@10.27.0 install --frozen-lockfile
if errorlevel 1 (
  echo Dependency installation failed. See the error above.
  pause
  exit /b 1
)
node "%~dp0scripts\start-dashboard.mjs"
if errorlevel 1 pause
