@echo off
echo ========================================
echo    Time Master - APK Builder
echo ========================================
echo.

echo 🔨 Paso 1: Construyendo aplicacion web...
node build-capacitor.js
if %ERRORLEVEL% neq 0 (
    echo Error en el build de la aplicacion web
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo 📱 Paso 2: Sincronizando con proyecto Android...
npx cap sync android
if %ERRORLEVEL% neq 0 (
    echo Error sincronizando con Android
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Paso 3: Intentando construir APK...
cd android
echo Verificando Java...
java -version

echo.
echo Construyendo APK de debug...
gradlew assembleDebug
if %ERRORLEVEL% equ 0 (
    echo.
    echo ¡APK generado exitosamente!
    echo Ubicacion: android\app\build\outputs\apk\debug\app-debug.apk
    echo.
    echo Para instalar en tu dispositivo Android:
    echo 1. Activa "Fuentes desconocidas" en Configuracion > Seguridad
    echo 2. Transfiere el archivo APK a tu dispositivo
    echo 3. Toca el archivo APK para instalarlo
) else (
    echo.
    echo No se pudo construir el APK automáticamente
    echo Soluciones alternativas:
    echo.
    echo 1. Instala Android Studio y abre el proyecto:
    echo    npx cap open android
    echo.
    echo 2. Instala Java 21 desde:
    echo    https://www.oracle.com/java/technologies/downloads/#java21
    echo.
    echo 3. Usa el servicio online APK Builder:
    echo    https://www.buildapkonline.com/
)

echo.
pause
cd ..