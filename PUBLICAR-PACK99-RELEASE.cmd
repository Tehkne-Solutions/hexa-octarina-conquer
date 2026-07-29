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
echo  Tehkne Solutions
echo ============================================================
echo.
echo Uso padrao:
echo   PUBLICAR-PACK99-RELEASE.cmd
echo.
echo Com caminho explicito para o ZIP recuperado:
echo   PUBLICAR-PACK99-RELEASE.cmd -SourceArchive "W:\CAMINHO\HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip"
echo.

set "SOURCE_PS1=%CD%\scripts\publish_pack99_release.ps1"
set "TEMP_PS1=%TEMP%\hoc-pack99-publish-utf8.ps1"

rem Windows PowerShell 5.1 interpreta UTF-8 sem BOM como ANSI. Gere uma copia
rem temporaria com BOM para preservar travessoes e acentos sem quebrar o parser.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$source=$env:SOURCE_PS1; $target=$env:TEMP_PS1; $content=[IO.File]::ReadAllText($source,[Text.Encoding]::UTF8); [IO.File]::WriteAllText($target,$content,(New-Object Text.UTF8Encoding($true)))"
if errorlevel 1 (
  echo ERRO: nao foi possivel preparar a copia UTF-8 do publicador.
  exit /b 3
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP_PS1%" -RepoRoot "%CD%" %*
set "RESULT=%ERRORLEVEL%"

del /q "%TEMP_PS1%" >nul 2>&1

echo.
if not "%RESULT%"=="0" (
  echo PUBLICACAO INTERROMPIDA. O bootstrap continua ativo e nenhum marcador deve ser promovido.
) else (
  echo PUBLICACAO CONCLUIDA. Copie o bloco RESULTADO PARA COLAR NO CHAT.
  echo O workflow PACK 99 Production Gate validara o deploy publico e tornara o runtime full obrigatorio.
)
echo.
echo Tehkne Solutions
exit /b %RESULT%
