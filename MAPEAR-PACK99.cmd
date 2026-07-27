@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul

set "SOURCE=W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS\PACK99-RECOVERED\HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1"
set "SHA_FILE=W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS\PACK99-RECOVERED\HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1.zip.sha256"
set "REPORT_FILE=W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS\PACK99-RECOVERED\HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1.zip.report.json"
set "REPO=W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\hexa-octarina-conquer"

set "COMMAND=%~1"
if not defined COMMAND set "COMMAND=audit"
if not "%~1"=="" shift

rem O %%* original nao muda depois de SHIFT. Por isso, reconstruimos somente
rem os argumentos extras para nao enviar o comando (audit/import/etc.) duas vezes.
set "EXTRA_ARGS="
:collect_args
if "%~1"=="" goto run_mapper
set "EXTRA_ARGS=%EXTRA_ARGS% %1"
shift
goto collect_args

:run_mapper
if not exist "%REPO%\scripts\map_pack99_recovered.py" (
  echo ERRO: importador nao encontrado em:
  echo %REPO%\scripts\map_pack99_recovered.py
  exit /b 2
)

where py >nul 2>nul
if errorlevel 1 (
  echo ERRO: Python Launcher ^(py^) nao encontrado.
  exit /b 2
)

echo.
echo ============================================================
echo  HOC PACK 99 - MAPEAMENTO E IMPORTACAO
echo  Comando: %COMMAND%
echo ============================================================
echo.

py -3 "%REPO%\scripts\map_pack99_recovered.py" "%COMMAND%" ^
  --source "%SOURCE%" ^
  --repo "%REPO%" ^
  --sha-file "%SHA_FILE%" ^
  --recovery-report "%REPORT_FILE%" %EXTRA_ARGS%

set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" (
  echo Falha no PACK 99. Codigo: %EXIT_CODE%
  exit /b %EXIT_CODE%
)

echo PACK 99 concluido com sucesso.
echo Assinatura: Tehkne Solutions
exit /b 0
