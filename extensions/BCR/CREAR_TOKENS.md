# Crear tokens BCR para TimeMaster

Ejecuta los comandos desde la raíz del proyecto. Cada computadora debe tener
su propio `deviceId` y su propio token. El token se muestra una sola vez; en
Firestore se almacena únicamente su SHA-256.

Sustituye `empresa-palmares`, `bcr-palmares-01` y `PALMARES-BCR-01` por los
valores reales.

## Desarrollo con el emulador de Firestore

En PowerShell:

```powershell
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:FIREBASE_PROJECT_ID = "timemaster-development"
npm run provision:bcr-device -- empresa-palmares bcr-palmares-01 "PALMARES-BCR-01"
```

Configura la extensión con la URL local correspondiente:

```text
http://localhost:3000
```

Antes de usar comandos de producción en la misma terminal, elimina las
variables del emulador:

```powershell
Remove-Item Env:FIRESTORE_EMULATOR_HOST -ErrorAction SilentlyContinue
Remove-Item Env:FIREBASE_PROJECT_ID -ErrorAction SilentlyContinue
```

## Producción

Guarda la cuenta de servicio fuera del repositorio. Luego, en PowerShell:

```powershell
Remove-Item Env:FIRESTORE_EMULATOR_HOST -ErrorAction SilentlyContinue
$env:FIREBASE_SERVICE_ACCOUNT_KEY = Get-Content -Raw "C:\ruta-segura\firebase-production.json"
$env:FIRESTORE_DATABASE_ID = "restauracion"
npm run provision:bcr-device -- empresa-palmares bcr-palmares-01 "PALMARES-BCR-01"
Remove-Item Env:FIREBASE_SERVICE_ACCOUNT_KEY
Remove-Item Env:FIRESTORE_DATABASE_ID -ErrorAction SilentlyContinue
```

TimeMaster usa la base nombrada `restauracion` en producción. El script también
la selecciona de forma predeterminada fuera del emulador, pero el comando la
declara explícitamente para evitar aprovisionar el dispositivo en otra base.

Si otro entorno usa una base diferente, sustituye el valor antes del comando:

```powershell
$env:FIRESTORE_DATABASE_ID = "nombre-de-la-base"
```

Y elimínala al terminar:

```powershell
Remove-Item Env:FIRESTORE_DATABASE_ID -ErrorAction SilentlyContinue
```

Configura la extensión de producción con:

```text
https://www.timemaster.es
```

## Resultado esperado

El comando imprime JSON con `ok: true` y el token con prefijo `tm_bcr_`.
Copia ese token inmediatamente al popup de la extensión BCR. No lo guardes en
el repositorio ni lo compartas entre dispositivos.
