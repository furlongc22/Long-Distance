@echo off
cd /d "%~dp0"
"C:\Program Files\ANSYS Inc\v242\commonfiles\CPython\3_10\winx64\Release\python\python.exe" "%~dp0generate_memories.py"
if errorlevel 1 (
  echo.
  echo Failed to generate memory data.
  pause
  exit /b 1
)

echo.
echo Memories updated successfully.
pause
