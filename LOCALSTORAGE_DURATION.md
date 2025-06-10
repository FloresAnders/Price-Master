# 🕒 Configuración de Duración del LocalStorage

## ✅ Cambio Aplicado

### 📅 **Duración Extendida del LocalStorage**

**Antes**: 24 horas (1 día)  
**Después**: 720 horas (30 días)  

### 🔧 **Archivo Modificado**
- `src/hooks/useAuth.ts` - Hook de autenticación

## ⚙️ **Configuración Actual**

```typescript
// Duración de la sesión en horas
const SESSION_DURATION_HOURS = 720; // 30 días
```

### 📋 **Opciones Disponibles**

| Duración | Horas | Descripción |
|----------|-------|-------------|
| 1 día | 24 | Sesión corta |
| 1 semana | 168 | Sesión semanal |
| **30 días** | **720** | **✅ Configuración actual** |
| 90 días | 2160 | Sesión trimestral |
| 1 año | 8760 | Sesión anual |

## 🔒 **Cómo Funciona**

1. **Al hacer login**: Se guarda la fecha/hora actual en `localStorage`
2. **Al cargar la app**: Se compara el tiempo transcurrido vs. la duración configurada
3. **Si no ha expirado**: Se mantiene la sesión activa
4. **Si ha expirado**: Se cierra la sesión automáticamente

## 🛠️ **Cómo Cambiar la Duración**

Para modificar la duración del localStorage, edita el archivo `src/hooks/useAuth.ts`:

```typescript
// Cambiar esta línea:
const SESSION_DURATION_HOURS = 720; // 30 días

// Por ejemplo, para 90 días:
const SESSION_DURATION_HOURS = 2160; // 90 días
```

## 💾 **Estructura del LocalStorage**

La sesión se guarda con la siguiente estructura:

```json
{
  "id": "user_id",
  "name": "nombre_usuario",
  "location": "ubicacion_usuario", 
  "role": "admin|user",
  "loginTime": "2025-06-09T10:30:00.000Z"
}
```

## 🎯 **Beneficios del Cambio**

- ✅ **Mayor comodidad**: Los usuarios no necesitan autenticarse cada día
- ✅ **Mejor experiencia**: Sesión persistente durante un mes completo
- ✅ **Configurable**: Fácil cambiar la duración cuando sea necesario
- ✅ **Seguro**: Aún expira automáticamente después del tiempo configurado

## 📝 **Notas Importantes**

- La sesión se extiende automáticamente cada vez que el usuario hace login
- Si se borra manualmente el localStorage del navegador, se perderá la sesión
- El logout manual sigue funcionando normalmente para cerrar sesión inmediatamente
