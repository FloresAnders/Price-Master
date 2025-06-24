# 💰 Configuración de Pago CCSS - Price Master

## 📋 Descripción

Nueva funcionalidad agregada al Editor de Datos que permite configurar los montos de pago a la Caja Costarricense de Seguro Social (CCSS) para empleados de Tiempo Completo (TC) y Medio Tiempo (MT).

## 🚀 Características

### Valores por Defecto
- **Tiempo Completo (TC)**: ₡11,017.39
- **Medio Tiempo (MT)**: ₡3,672.46

### Funcionalidades
- ✅ Configuración individual para TC y MT
- ✅ Validación de valores numéricos
- ✅ Almacenamiento en Firebase Firestore
- ✅ Sincronización automática con el sistema
- ✅ Respaldo en localStorage
- ✅ Exportación/Importación de configuración
- ✅ Restauración de valores por defecto
- ✅ Interfaz responsive y amigable

## 🛠 Implementación Técnica

### Archivos Modificados/Creados

1. **`src/types/firestore.ts`**
   - Agregado tipo `CcssConfig`

2. **`src/services/ccss-config.ts`** (NUEVO)
   - Servicio para manejar configuración CCSS
   - Métodos: `getCcssConfig()`, `updateCcssConfig()`, `initializeCcssConfig()`

3. **`src/services/firestore.ts`**
   - Agregado método `addWithId()` para crear documentos con ID específico

4. **`src/edit/DataEditor.tsx`**
   - Nueva pestaña "Pago CCSS"
   - Integración completa con el sistema existente
   - Interfaz de usuario profesional

5. **`src/hooks/useFirebase.ts`**
   - Nuevo hook `useCcssConfig()`
   - Actualizado `useFirebaseData()` para incluir CCSS

6. **`src/firebase/index.ts`**
   - Exportación del nuevo servicio y tipo

### Base de Datos

#### Colección: `ccss-config`
```typescript
{
  id: "default",           // ID fijo para la configuración
  mt: 3672.46,            // Valor para Medio Tiempo
  tc: 11017.39,           // Valor para Tiempo Completo
  updatedAt: Date         // Timestamp de última actualización
}
```

## 🎯 Cómo Usar

### Para Administradores
1. Acceder al **Editor de Datos** (`/edit`)
2. Seleccionar la pestaña **"Pago CCSS"**
3. Modificar los valores según necesidad
4. Hacer clic en **"Guardar Configuración"**

### Para Desarrolladores
```typescript
import { CcssConfigService } from '@/services/ccss-config';

// Obtener configuración actual
const config = await CcssConfigService.getCcssConfig();

// Actualizar configuración
await CcssConfigService.updateCcssConfig({
  mt: 3800.00,
  tc: 11500.00
});
```

### Usando el Hook
```typescript
import { useCcssConfig } from '@/hooks/useFirebase';

function MyComponent() {
  const { ccssConfig, loading, error, updateCcssConfig } = useCcssConfig();
  
  // Tu código aquí...
}
```

## 🔧 Integración con Sistema Existente

La configuración CCSS se integra automáticamente con:
- ✅ Sistema de exportación/importación de datos
- ✅ Detección de cambios sin guardar
- ✅ Notificaciones de éxito/error
- ✅ Validación de datos
- ✅ Respaldo automático en localStorage

## 🎨 Interfaz de Usuario

### Características de la UI
- 🎯 Interfaz limpia y profesional
- 📱 Diseño responsive
- 🌙 Soporte para modo oscuro
- 💡 Información contextual y ayuda
- ⚡ Feedback inmediato
- 🔄 Botón para restaurar valores por defecto

### Elementos Visuales
- Iconos distintivos para TC y MT
- Colores diferenciados (verde para TC, naranja para MT)
- Campos de entrada con formato de moneda
- Resumen de configuración actual
- Timestamps de última actualización

## 🛡️ Validación y Seguridad

- ✅ Validación de tipos numéricos
- ✅ Valores mínimos (0)
- ✅ Manejo de errores robusto
- ✅ Confirmación para restaurar valores por defecto
- ✅ Indicadores de estado de guardado

## 🔄 Estado de la Funcionalidad

**✅ COMPLETADO**
- Implementación completa
- Integración con Firebase
- Interfaz de usuario
- Hooks de React
- Validación y manejo de errores
- Documentación

## 🧪 Testing

Para probar la funcionalidad:
1. Ejecutar `npm run dev`
2. Navegar a `/edit`
3. Seleccionar pestaña "Pago CCSS"
4. Modificar valores y guardar
5. Verificar en Firebase Console que se almacenen correctamente

¡La nueva funcionalidad de configuración de Pago CCSS está lista para usar! 🎉
