@echo off
setlocal EnableExtensions

cd /d "%~dp0"
if errorlevel 1 (
  echo ERRO: nao foi possivel abrir a pasta do repositorio.
  exit /b 2
)

echo ============================================================
echo  HOC PACK 99 - RECONSTRUCAO E PROMOCAO LOCAL
echo  Tehkne Solutions
echo ============================================================
echo.

where py >nul 2>nul
if errorlevel 1 (
  where python >nul 2>nul
  if errorlevel 1 (
    echo ERRO: Python 3 nao foi encontrado no PATH.
    exit /b 2
  )
  python scripts\rebuild_pack99_local.py --repo "%CD%" --assets-root "W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS" %*
) else (
  py -3 scripts\rebuild_pack99_local.py --repo "%CD%" --assets-root "W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS" %*
)

set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo OPERACAO INTERROMPIDA. O runtime anterior deve permanecer preservado.
  echo Consulte W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS\PACK99-REPORTS\PACK99_LOCAL_PROMOTION.log
) else (
  echo OPERACAO CONCLUIDA. Copie o bloco RESULTADO PARA COLAR NO CHAT exibido acima.
)
echo.
echo Tehkne Solutions
exit /b %RESULT%
