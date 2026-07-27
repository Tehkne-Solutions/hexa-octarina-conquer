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

rem O %%* original nao muda depois de SHIFT. Reconstruimos somente os extras.
set "EXTRA_ARGS="
:collect_args
if "%~1"=="" goto validate
set "EXTRA_ARGS=%EXTRA_ARGS% %1"
shift
goto collect_args

:validate
if not exist "%REPO%\scripts\map_pack99_recovered.py" (
  echo ERRO: mapeador nao encontrado em:
  echo %REPO%\scripts\map_pack99_recovered.py
  exit /b 2
)
if not exist "%REPO%\scripts\import_pack99_canonical.py" (
  echo ERRO: importador deduplicado nao encontrado em:
  echo %REPO%\scripts\import_pack99_canonical.py
  exit /b 2
)
if not exist "%REPO%\scripts\materialize_pack99_runtime.py" (
  echo ERRO: materializador com politica de runtime nao encontrado em:
  echo %REPO%\scripts\materialize_pack99_runtime.py
  exit /b 2
)
if not exist "%REPO%\runtime\packs\PACK_99_RECOVERED\runtime-policy.json" (
  echo ERRO: politica de runtime nao encontrada em:
  echo %REPO%\runtime\packs\PACK_99_RECOVERED\runtime-policy.json
  exit /b 2
)
where py >nul 2>nul
if errorlevel 1 (
  echo ERRO: Python Launcher ^(py^) nao encontrado.
  exit /b 2
)

if /I "%COMMAND%"=="audit" goto run_mapper
if /I "%COMMAND%"=="status" goto run_mapper
if /I "%COMMAND%"=="materialize" goto run_materialize
if /I "%COMMAND%"=="import" goto run_import
if /I "%COMMAND%"=="all" goto run_all

echo ERRO: comando invalido: %COMMAND%
echo Use: audit, import, materialize, all ou status.
exit /b 2

:header
echo.
echo ============================================================
echo  HOC PACK 99 - MAPEAMENTO E IMPORTACAO
echo  Comando: %COMMAND%
echo ============================================================
echo.
exit /b 0

:run_mapper
call :header
py -3 "%REPO%\scripts\map_pack99_recovered.py" "%COMMAND%" ^
  --source "%SOURCE%" ^
  --repo "%REPO%" ^
  --sha-file "%SHA_FILE%" ^
  --recovery-report "%REPORT_FILE%" %EXTRA_ARGS%
set "EXIT_CODE=%ERRORLEVEL%"
goto done

:run_import
call :header
py -3 "%REPO%\scripts\import_pack99_canonical.py" ^
  --source "%SOURCE%" ^
  --repo "%REPO%" ^
  --sha-file "%SHA_FILE%" ^
  --recovery-report "%REPORT_FILE%" %EXTRA_ARGS%
set "EXIT_CODE=%ERRORLEVEL%"
goto done

:run_materialize
call :header
py -3 "%REPO%\scripts\materialize_pack99_runtime.py" ^
  --repo "%REPO%" %EXTRA_ARGS%
set "EXIT_CODE=%ERRORLEVEL%"
goto done

:run_all
call :header
echo [1/3] Auditoria e catalogo
py -3 "%REPO%\scripts\map_pack99_recovered.py" audit ^
  --source "%SOURCE%" ^
  --repo "%REPO%" ^
  --sha-file "%SHA_FILE%" ^
  --recovery-report "%REPORT_FILE%" %EXTRA_ARGS%
if errorlevel 1 goto capture_failure

echo.
echo [2/3] Importacao canonica deduplicada
py -3 "%REPO%\scripts\import_pack99_canonical.py" ^
  --source "%SOURCE%" ^
  --repo "%REPO%" ^
  --sha-file "%SHA_FILE%" ^
  --recovery-report "%REPORT_FILE%" %EXTRA_ARGS%
if errorlevel 1 goto capture_failure

echo.
echo [3/3] Materializacao Web e Godot com politica oficial
py -3 "%REPO%\scripts\materialize_pack99_runtime.py" ^
  --repo "%REPO%" %EXTRA_ARGS%
set "EXIT_CODE=%ERRORLEVEL%"
goto done

:capture_failure
set "EXIT_CODE=%ERRORLEVEL%"

goto done

:done
echo.
if not "%EXIT_CODE%"=="0" (
  echo Falha no PACK 99. Codigo: %EXIT_CODE%
  exit /b %EXIT_CODE%
)
echo PACK 99 concluido com sucesso.
echo Assinatura: Tehkne Solutions
exit /b 0
