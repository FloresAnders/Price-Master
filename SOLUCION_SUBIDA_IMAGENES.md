# 🚨 Solución del Problema de Subida de Imágenes

## Problema Identificado
La funcionalidad de subir imágenes no funciona debido a **reglas restrictivas de Firebase Storage**.

## ✅ Solución Paso a Paso

### 1. Actualizar las Reglas de Firebase Storage

Ve a [Firebase Console](https://console.firebase.google.com/project/pricemaster-4a611/storage/rules) y reemplaza las reglas actuales con:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Permitir acceso completo a la carpeta exports
    match /exports/{allPaths=**} {
      allow read, write: if true;
    }
    
    // Permitir acceso para pruebas
    match /test-images/{allPaths=**} {
      allow read, write: if true;
    }
    
    // Acceso temporal para desarrollo hasta 2026-07-25
    match /{allPaths=**} {
      allow read, write: if request.time < timestamp.date(2026, 7, 25);
    }
  }
}
```

### 2. Verificar Variables de Entorno

Confirma que el archivo `.env` contiene:
```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAKj8Cz21p7VNPDNhQ1Z7See9f0c_ulIyU
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=pricemaster-4a611.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=pricemaster-4a611
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=pricemaster-4a611.firebasestorage.app
NEXT_PUBLIC_FIREBASE_APP_ID=1:341709709017:web:b6916b1e85464a249ce8c8
```

### 3. Reiniciar el Servidor

```bash
# Detener el servidor actual
Ctrl + C

# Reiniciar
npm run dev
```

### 4. Probar la Funcionalidad

1. Ve a `http://localhost:3001/backdoor`
2. Ejecuta "Conexión Firebase" en las pruebas de Firebase
3. Intenta subir una imagen en la sección "Subir Imagen a Firebase Storage"

## 🔧 Diagnóstico Adicional

Si sigue sin funcionar, ejecuta este código en la consola del navegador:

```javascript
// Verificar configuración actual
console.log('Firebase Config:', {
    apiKey: window.firebaseConfig?.apiKey || 'No disponible',
    projectId: window.firebaseConfig?.projectId || 'No disponible',
    storageBucket: window.firebaseConfig?.storageBucket || 'No disponible'
});
```

## 📋 Errores Comunes y Soluciones

### Error: `storage/unauthorized`
- **Causa**: Reglas de Storage muy restrictivas
- **Solución**: Actualizar las reglas como se muestra arriba

### Error: `storage/project-not-found`
- **Causa**: PROJECT_ID incorrecto
- **Solución**: Verificar `.env` y Firebase Console

### Error: `storage/bucket-not-found`
- **Causa**: STORAGE_BUCKET incorrecto
- **Solución**: Verificar que el bucket existe en Firebase

## 🎯 Estado Actual

- ✅ Variables de entorno configuradas
- ✅ Firebase Storage inicializado
- ❌ Reglas de Storage muy restrictivas (NECESITA ACTUALIZACIÓN)
- ✅ Código de subida correcto

**Acción Requerida**: Actualizar las reglas de Firebase Storage en la consola.
