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
echo  HOC PACK 99 - PUBLICACAO INTEGRAL 1.0.2
echo  Web + Godot + GitHub Release + Production Gate
echo  Tehkné Solutions
echo ============================================================
echo.
echo Uso padrao:
echo   PUBLICAR-PACK99-RELEASE.cmd
echo.
echo Com caminho explicito para o ZIP recuperado:
echo   PUBLICAR-PACK99-RELEASE.cmd -SourceArchive "W:\CAMINHO\HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip"
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%CD%\scripts\publish_pack99_release.ps1" -RepoRoot "%CD%" %*
set "RESULT=%ERRORLEVEL%"

echo.
if not "%RESULT%"=="0" (
  echo PUBLICACAO INTERROMPIDA. O bootstrap continua ativo e nenhum marcador deve ser promovido.
) else (
  echo PUBLICACAO CONCLUIDA. Copie o bloco RESULTADO PARA COLAR NO CHAT.
  echo O workflow PACK 99 Production Gate validara o deploy publico e tornara o runtime full obrigatorio.
)
echo.
echo Tehkné Solutions
exit /b %RESULT%
