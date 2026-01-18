@echo off
echo ========================================
echo Department of Health - Setup Script
echo ========================================
echo.

echo Step 1: Installing Node.js dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to install dependencies
    echo Please make sure Node.js is installed
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Make sure MySQL 8.0 is running
echo 2. Create database: anti_gravity_db
echo 3. Update MySQL password in server.js
echo 4. Run: npm start
echo.
echo See SETUP.md for detailed instructions
echo.
pause
