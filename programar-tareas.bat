@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "PUSH_SCRIPT=%PROJECT_DIR%run-git-push.bat"
set "UPDATE_SCRIPT=%PROJECT_DIR%run-npm-update.bat"

schtasks /Create /F /TN "PriceMaster Git Push" /SC DAILY /ST 02:00 /TR "\"%PUSH_SCRIPT%\""
if errorlevel 1 (
  echo Error creando tarea: PriceMaster Git Push
  pause
  exit /b 1
)

schtasks /Create /F /TN "PriceMaster NPM Update" /SC DAILY /ST 02:15 /TR "\"%UPDATE_SCRIPT%\""
if errorlevel 1 (
  echo Error creando tarea: PriceMaster NPM Update
  pause
  exit /b 1
)

echo Tareas creadas:
echo - PriceMaster Git Push: diario 02:00
echo - PriceMaster NPM Update: diario 02:15
pause
