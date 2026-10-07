@echo off
cd /d "%~dp0"

echo ========================================================
echo Starting New Indie Live 24 - DRY RUN SANDBOX
echo ========================================================
node src/index.js --dry-run
echo ========================================================
echo Sandbox test completed!
echo ========================================================
pause
