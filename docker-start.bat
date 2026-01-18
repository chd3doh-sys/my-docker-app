@echo off
echo ========================================
echo   DOH Document Upload - Docker Launcher
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [OK] Docker is running
echo.

REM Check if docker-compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] docker-compose is not available!
    echo Please install Docker Compose.
    pause
    exit /b 1
)

echo [OK] Docker Compose is available
echo.

echo Starting services...
echo.

docker-compose up -d

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start services!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Services Started Successfully!
echo ========================================
echo.
echo Application: http://localhost:3000
echo MySQL: localhost:3306
echo.
echo To view logs: docker-compose logs -f
echo To stop: docker-compose down
echo.
echo Press any key to view logs...
pause >nul

docker-compose logs -f
