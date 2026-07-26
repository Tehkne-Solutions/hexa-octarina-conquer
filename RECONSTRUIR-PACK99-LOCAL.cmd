@echo off
chcp 65001 >nul
setlocal EnableExtensions

cd /d "%~dp0"
if errorlevel 1 (
  echo ERRO: não foi possível abrir a pasta do repositório.
  exit /b 2
)

echo ============================================================
echo  HOC PACK 99 - RECONSTRUÇÃO E PROMOÇÃO LOCAL
echo  Tehkné Solutions
echo ============================================================
echo.

where py >nul 2>nul
if errorlevel 1 (
  where python >nul 2>nul
  if errorlevel 1 (
    echo ERRO: Python 3 não foi encontrado no PATH.
    exit /b 2
  )
  python scripts\rebuild_pack99_local.py --repo "%CD%" --assets-root "W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS" %*
) else (
  py -3 scripts\rebuild_pack99_local.py --repo "%CD%" --assets-root "W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS" %*
)

set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo OPERAÇÃO INTERROMPIDA. O runtime anterior deve permanecer preservado.
  echo Consulte W:\TEHKNE-SOLUTIONS\PROJETOS\JOGO-HOC\ASSETS\PACK99-REPORTS\PACK99_LOCAL_PROMOTION.log
) else (
  echo OPERAÇÃO CONCLUÍDA. Copie o bloco RESULTADO PARA COLAR NO CHAT exibido acima.
)
echo.
echo Tehkné Solutions
exit /b %RESULT%
