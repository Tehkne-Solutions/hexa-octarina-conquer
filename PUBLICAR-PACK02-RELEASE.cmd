@echo off
setlocal
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish_pack02_release.ps1" -RepoRoot "%~dp0" %*
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Falha ao publicar o PACK 02. Codigo: %EXIT_CODE%
)
exit /b %EXIT_CODE%
