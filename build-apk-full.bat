@echo off
rem ==========================================================
rem build-apk-full.bat
rem Script completo para construir APK (debug/release) con Capacitor
rem - Detecta JDK (usa jdk-21 si está disponible)
rem - Ejecuta build web (Next.js) y npx cap sync android
rem - Compila con Gradle wrapper (assembleDebug o assembleRelease)
rem - Opcional: genera un keystore de prueba si se solicita para release
rem Uso:
rem   build-apk-full.bat [debug|release] [keystorePath] [keystoreAlias] [storePass] [keyPass]
rem Ejemplo:
rem   build-apk-full.bat debug
rem   build-apk-full.bat release C:\keys\mykeystore.jks myalias mypass mykeypass
rem ==========================================================

setlocal enabledelayedexpansion

echo ==================================================
echo  Price-Master - Build APK (full)
echo ==================================================

rem ---- Parámetros ----
set MODE=%1
if "%MODE%"=="" set MODE=debug

set KEYSTORE=%2
set KEYALIAS=%3
set STOREPASS=%4
set KEYPASS=%5

echo Modo: %MODE%

rem ---- Detectar JDK (preferir jdk-21) ----
set JDK21=C:\Program Files\Java\jdk-21
set JDK17=C:\Program Files\Java\jdk-17
if exist "%JDK21%" (
    set JAVA_HOME=%JDK21%
) else if exist "%JDK17%" (
    set JAVA_HOME=%JDK17%
) else (
    rem fallback: usar variable existente
    if defined JAVA_HOME (
        echo Usando JAVA_HOME existente: %JAVA_HOME%
    ) else (
        echo No se encontró JDK en rutas comunes y JAVA_HOME no está definido.
        echo Instala JDK 21 o define JAVA_HOME y vuelve a intentar.
        pause
        exit /b 1
    )
)

echo JAVA_HOME = %JAVA_HOME%
set PATH=%JAVA_HOME%\bin;%PATH%

rem ---- Step 1: Build web (Next.js) usando build-capacitor.js si existe, sino npm run build ----
if exist build-capacitor.js (
    echo.
    echo 1) Ejecutando build-capacitor.js (flujo Capacitor)...
    node build-capacitor.js
    if %ERRORLEVEL% neq 0 (
        echo Error en build-capacitor.js
        pause
        exit /b %ERRORLEVEL%
    )
) else (
    echo.
    echo 1) Ejecutando npm run build...
    npm run build
    if %ERRORLEVEL% neq 0 (
        echo Error ejecutando npm run build
        pause
        exit /b %ERRORLEVEL%
    )
)

rem ---- Step 2: Sincronizar con Android ----
echo.
echo 2) Sincronizando con Capacitor (npx cap sync android)...
npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo Error sincronizando con Android
    pause
    exit /b %ERRORLEVEL%
)

rem ---- Step 3: Preparar Android build ----
echo.
echo 3) Construyendo APK en la carpeta android...
if not exist android (
    echo No se encontró la carpeta android. Ejecuta `npx cap add android` primero.
    pause
    exit /b 1
)

pushd android

rem Detener daemons previos
echo Deteniendo Gradle daemons...
call gradlew --stop 2>nul

rem Si release, manejar keystore opcional
if /I "%MODE%"=="release" (
    echo Modo release seleccionado.
    rem Si no se proporcionó keystore, preguntar si se debe generar uno de prueba
    if "%KEYSTORE%"=="" (
        set /p GEN=No se proporcionó keystore. Deseas generar un keystore de prueba en android\app\release-keystore.jks? (Y/N): 
        if /I "!GEN!"=="Y" (
            echo Generando keystore de prueba...
            set KEYSTORE=%cd%\app\release-keystore.jks
            set KEYALIAS=timemaster
            set STOREPASS=changeit
            set KEYPASS=changeit
            keytool -genkeypair -v -keystore "%KEYSTORE%" -storetype PKCS12 -alias %KEYALIAS% -keyalg RSA -keysize 2048 -validity 10000 -storepass %STOREPASS% -keypass %KEYPASS% -dname "CN=TimeMaster, OU=Dev, O=Company, L=City, S=State, C=US"
            if %ERRORLEVEL% neq 0 (
                echo Error generando keystore
                popd
                pause
                exit /b %ERRORLEVEL%
            )
            echo Keystore creado en: %KEYSTORE%
        ) else (
            echo Continuando sin keystore: el APK release probablemente será unsigned.
        )
    ) else (
        echo Se usará keystore: %KEYSTORE%
    )
)

rem Ejecutar gradle
if /I "%MODE%"=="release" (
    echo Ejecutando: gradlew assembleRelease
    call gradlew assembleRelease
    set BUILD_EXIT=%ERRORLEVEL%
) else (
    echo Ejecutando: gradlew assembleDebug
    call gradlew assembleDebug
    set BUILD_EXIT=%ERRORLEVEL%
)

if %BUILD_EXIT% neq 0 (
    echo.
    echo La compilacion fallo con codigo %BUILD_EXIT%.
    echo Revisa la salida anterior. Puedes abrir el proyecto en Android Studio con: npx cap open android
    popd
    pause
    exit /b %BUILD_EXIT%
)

rem ---- Mostrar artefactos ----
echo.
echo Build completado con éxito.
if /I "%MODE%"=="release" (
    if exist app\build\outputs\apk\release\app-release.apk (
        echo APK release firmado (o configurado) en: app\build\outputs\apk\release\app-release.apk
    ) else if exist app\build\outputs\apk\release\app-release-unsigned.apk (
        echo APK release sin firmar en: app\build\outputs\apk\release\app-release-unsigned.apk
    ) else (
        echo No se encontró APK release en app\build\outputs\apk\release\
    )
) else (
    if exist app\build\outputs\apk\debug\app-debug.apk (
        echo APK debug en: app\build\outputs\apk\debug\app-debug.apk
    ) else (
        echo No se encontró APK debug en app\build\outputs\apk\debug\
    )
)

popd

echo.
echo Fin del script.
pause

endlocal
