@echo off
echo ========================================
echo   Stopping Docker Services
echo ========================================
echo.

docker-compose down

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to stop services!
    pause
    exit /b 1
)

echo.
echo [OK] All services stopped successfully!
echo.
pause
