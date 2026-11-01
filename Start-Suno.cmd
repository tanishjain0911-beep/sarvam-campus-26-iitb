@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required to run Suno.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:3000 after the server starts.
echo Keep this window open while you use Suno. Press Ctrl+C to stop.
node scripts/start-local.mjs
pause
