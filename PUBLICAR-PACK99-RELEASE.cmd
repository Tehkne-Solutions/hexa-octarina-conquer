@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"

cd /d "%~dp0"
if errorlevel 1 (
  echo ERRO: nao foi possivel abrir a pasta do repositorio.
  exit /b 2
)

echo ============================================================
echo  HOC PACK 99 - PUBLICACAO DO RUNTIME INTEGRAL
echo  Tehkné Solutions
echo ============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\publish_pack99_release.ps1" -RepoRoot "%CD%" %*
set "RESULT=%ERRORLEVEL%"

echo.
if not "%RESULT%"=="0" (
  echo PUBLICACAO INTERROMPIDA. Nenhum bootstrap deve ser removido.
) else (
  echo PUBLICACAO CONCLUIDA. Copie o bloco RESULTADO PARA COLAR NO CHAT.
)
echo.
echo Tehkné Solutions
exit /b %RESULT%
