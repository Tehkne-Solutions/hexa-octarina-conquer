@echo off
setlocal EnableExtensions
chcp 65001 >nul

echo ==========================================================
echo  HEXA OCTARINA CONQUER - INSTALACAO ANDROID DIAGNOSTICA
echo  Tehkne Solutions
echo ==========================================================
echo.

where adb >nul 2>nul
if errorlevel 1 (
  echo ERRO: ADB nao foi encontrado no PATH.
  echo Instale o Android Platform Tools e execute este arquivo novamente.
  exit /b 2
)

if "%~1"=="" (
  echo Uso: %~nx0 "CAMINHO_DO_APK"
  echo Exemplo: %~nx0 "HexaOctarinaConquer-v0.11.2-arm64.apk"
  exit /b 2
)

set "APK=%~f1"
if not exist "%APK%" (
  echo ERRO: APK nao encontrado: %APK%
  exit /b 2
)

echo Dispositivos conectados:
adb devices -l
echo.

echo Removendo pacotes antigos que podem bloquear a assinatura...
adb uninstall com.tehkne.hexaoctarina >nul 2>&1
adb uninstall com.tehkne.hexaoctarina.mobile >nul 2>&1

echo Instalando sem streaming para exibir o erro real do Android...
adb install --no-streaming "%APK%"
if errorlevel 1 (
  echo.
  echo A instalacao falhou. O codigo acima identifica a causa exata.
  echo Salve esta tela para o diagnostico da Tehkne Solutions.
  exit /b 1
)

echo.
echo Pacote instalado:
adb shell pm path com.tehkne.hexaoctarina.mobile
adb shell dumpsys package com.tehkne.hexaoctarina.mobile | findstr /I "versionCode versionName primaryCpuAbi"

echo.
echo INSTALACAO CONCLUIDA.
exit /b 0
