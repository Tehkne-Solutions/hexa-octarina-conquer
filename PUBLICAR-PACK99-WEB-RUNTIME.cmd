@echo off
setlocal
chcp 65001 >nul

echo ============================================================
echo  HOC PACK 99 - PUBLICAR RUNTIME WEB INTEGRAL
echo  GitHub Release + Render Production Gate
echo  Tehkné Solutions
echo ============================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish_pack99_web_runtime.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo PUBLICACAO INTERROMPIDA. O Render nao deve ser redeployado.
  echo Tehkné Solutions
  exit /b %EXIT_CODE%
)

echo.
echo PUBLICACAO DO RUNTIME WEB CONCLUIDA.
echo Agora solicite Manual Deploy no Render e execute verify:production.
echo Tehkné Solutions
exit /b 0
