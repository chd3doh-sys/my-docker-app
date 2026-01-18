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
echo Step 2: Checking for .env file...
if not exist .env (
    echo Creating .env from .env.example...
    copy .env.example .env
    echo.
    echo IMPORTANT: Please edit .env and update your MySQL credentials!
) else (
    echo .env file already exists.
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Make sure MySQL 8.0 is running and the database "anti_gravity_db" exists.
echo 2. Run 'node init_db.js' to initialize tables.
echo 3. Run 'npm start' to begin.
echo.
echo See README.md or SETUP.md for detailed instructions.
echo.
pause
