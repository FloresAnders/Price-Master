# Funcionalidad de Exportación con QR y Firebase Storage

## Descripción de la Nueva Funcionalidad

Se ha implementado una nueva funcionalidad de exportación que permite:

1. **Exportación automática en PC**: La imagen se descarga automáticamente en la computadora
2. **Subida a Firebase Storage**: La imagen se sube temporalmente a Firebase Storage
3. **Generación de QR**: Se genera un código QR que contiene la URL de descarga
4. **Descarga móvil**: Los usuarios pueden escanear el QR para descargar la imagen en dispositivos móviles
5. **Eliminación automática**: La imagen se elimina del storage cuando se cierra el modal de QR

## Tecnologías Utilizadas

- **Firebase Storage**: Para almacenamiento temporal de imágenes
- **QRCode.js**: Para generar códigos QR
- **html2canvas**: Para convertir el resumen en imagen
- **Lucide React**: Para los íconos de interfaz

## Flujo de Funcionamiento

### 1. Exportación
```
Usuario hace clic en "Exportar + QR" → 
Imagen se descarga en PC → 
Imagen se sube a Firebase Storage → 
Se genera QR con URL de descarga → 
Se muestra modal con QR
```

### 2. Descarga Móvil
```
Usuario escanea QR con móvil → 
Se abre URL de descarga → 
Imagen se descarga automáticamente en móvil
```

### 3. Limpieza
```
Usuario cierra modal de QR → 
Imagen se elimina de Firebase Storage → 
Se libera espacio de almacenamiento
```

## Componentes Modificados

### TimingControl.tsx
- **Nuevos estados agregados**:
  - `showQRModal`: Controla la visibilidad del modal de QR
  - `qrCodeDataURL`: Almacena la imagen del código QR
  - `downloadURL`: URL de descarga de Firebase Storage
  - `storageRef`: Referencia del archivo en Storage

- **Nuevas funciones**:
  - `handleConfirmExport()`: Función principal de exportación mejorada
  - `handleCloseQRModal()`: Cierra modal y elimina imagen del storage
  - `handleDirectDownload()`: Descarga directa desde el modal

### firebase.ts
- **Agregado**: Configuración de Firebase Storage
- **Export**: `storage` para uso en componentes

## Configuración Requerida

### Firebase Storage Rules
Las reglas de seguridad deben configurarse en la consola de Firebase:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /exports/{allPaths=**} {
      allow read, write: if true;
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### Variables de Entorno
Asegurar que estas variables estén configuradas:
```
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
```

## Funcionalidades del Modal de QR

### Elementos de la Interfaz
1. **Código QR**: Imagen de 256x256 pixels para fácil escaneo
2. **Botón "Descargar directamente"**: Para descarga desde PC sin escanear
3. **Botón "Cerrar (eliminar imagen)"**: Cierra modal y limpia storage
4. **Texto informativo**: Explica el proceso y la eliminación automática

### Características de Seguridad
- **Eliminación automática**: Las imágenes no se acumulan en el storage
- **Nombres únicos**: Cada archivo tiene timestamp para evitar conflictos
- **Acceso temporal**: Las URLs solo son válidas mientras el archivo existe

## Beneficios

1. **Conveniencia**: Descarga automática en PC y móvil
2. **Eficiencia**: No requiere cables ni transferencias manuales
3. **Limpieza**: No deja archivos residuales en el almacenamiento
4. **Accesibilidad**: Funciona con cualquier dispositivo con cámara
5. **Seguridad**: URLs temporales y archivos auto-eliminables

## Uso

1. Completar el resumen de ventas
2. Ingresar nombre de la persona
3. Hacer clic en "Exportar + QR"
4. La imagen se descarga automáticamente en PC
5. Escanear el QR con el móvil para descargar en el dispositivo
6. Cerrar el modal para eliminar la imagen del storage

## Consideraciones Técnicas

- **Límites de Firebase**: Ten en cuenta los límites gratuitos de Firebase Storage
- **Tamaño de imagen**: Las imágenes son PNG optimizadas
- **Compatibilidad**: Compatible con todos los navegadores modernos
- **Performance**: La subida puede tomar unos segundos según la conexión
