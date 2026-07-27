@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "PARTS_DIR=%~1"
if not defined PARTS_DIR set "PARTS_DIR=%CD%"

set "MANIFEST=%PARTS_DIR%\HOC_PACK_99_RELEASE_PARTS_MANIFEST.json"
set "OUTPUT=%PARTS_DIR%\HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip"
set "REPORT=%PARTS_DIR%\HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.2.zip.reassembly-report.json"

if not exist "%MANIFEST%" (
  echo ERRO: manifesto nao encontrado em "%MANIFEST%".
  echo Copie as sete partes e o manifesto para a mesma pasta.
  exit /b 2
)

python "%~dp0scripts\reassemble_pack99_parts.py" ^
  --manifest "%MANIFEST%" ^
  --parts-dir "%PARTS_DIR%" ^
  --output "%OUTPUT%" ^
  --report "%REPORT%"

if errorlevel 1 (
  echo.
  echo A remontagem falhou. O runtime anterior foi preservado.
  exit /b %errorlevel%
)

echo.
echo PACK 99 remontado e validado com sucesso.
echo Arquivo: "%OUTPUT%"
echo Relatorio: "%REPORT%"
echo.
echo Tehkne Solutions
endlocal
