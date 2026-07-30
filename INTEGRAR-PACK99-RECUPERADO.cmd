@echo off
setlocal
chcp 65001 >nul

set "SCRIPT=%~dp0scripts\integrate_recovered_pack99.ps1"

if not exist "%SCRIPT%" (
  echo ERRO: script nao encontrado: %SCRIPT%
  exit /b 2
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
set "EXITCODE=%ERRORLEVEL%"

if not "%EXITCODE%"=="0" (
  echo.
  echo INTEGRACAO INTERROMPIDA. Nenhum runtime deve ser promovido antes da validacao.
  exit /b %EXITCODE%
)

exit /b 0
