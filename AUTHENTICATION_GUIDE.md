# 🔐 Sistema de Autenticación - Price Master

## ✨ Nuevas Funcionalidades Implementadas

### 🔑 Autenticación Requerida
- **Control de Horario** y **Timing Control** ahora requieren autenticación
- Al acceder por primera vez, se muestra un modal de login
- La sesión se guarda en `localStorage` por 24 horas

### 👥 Tipos de Usuario y Permisos

#### 🔴 **Admin**
- Puede cambiar la ubicación en **Control de Horario**
- Acceso completo a todas las funcionalidades
- Credenciales de prueba: `admin` / `admin123`

#### 🔵 **User** 
- Ubicación fija (no puede cambiar en Control de Horario)
- Acceso a todas las funcionalidades pero con ubicación restringida
- Credenciales de prueba: `usuario1` / `user123`

### 🏢 Gestión de Ubicaciones
- Los usuarios se autentican automáticamente con su ubicación asignada
- Solo los **administradores** pueden cambiar de ubicación en Control de Horario
- **Timing Control** no tiene restricción de cambio de ubicación (para todos los roles)

## 🚀 Cómo Probar

### 1. Crear Usuarios de Prueba
1. Abre el archivo `create-users-test.html` en tu navegador
2. Haz clic en "✅ Crear Usuarios de Prueba"
3. Verifica que los usuarios se hayan creado correctamente

### 2. Probar el Sistema de Login
1. Ejecuta la aplicación con `npm run dev`
2. Ve a las pestañas **Control de Horario** o **Timing Control**
3. Se mostrará el modal de login
4. Usa las credenciales de prueba:
   - **Admin**: `admin` / `admin123`
   - **Usuario**: `usuario1` / `user123`

### 3. Verificar Permisos
- **Como admin**: Podrás cambiar la ubicación en Control de Horario
- **Como user**: La ubicación estará fija en Control de Horario
- **Todos los roles**: Pueden cambiar ubicación en Timing Control

## 🔧 Archivos Modificados

### Nuevos Archivos
- `src/components/LoginModal.tsx` - Modal de autenticación
- `src/hooks/useAuth.ts` - Hook para manejo de autenticación
- `create-users-test.html` - Herramienta para crear usuarios de prueba

### Archivos Modificados
- `src/components/ControlHorario.tsx` - Agregada autenticación y control de permisos
- `src/components/TimingControl.tsx` - Agregada autenticación

## 💾 Almacenamiento de Sesión

La sesión se guarda en `localStorage` con la siguiente estructura:
```json
{
  "id": "user_id",
  "name": "username", 
  "location": "user_location",
  "role": "admin|user",
  "loginTime": "2024-01-01T12:00:00.000Z"
}
```

La sesión expira automáticamente después de 24 horas.

## 🔒 Seguridad

⚠️ **IMPORTANTE**: Este es un sistema básico de autenticación para desarrollo/demostración. Para producción se recomienda:
- Hashear las contraseñas
- Usar tokens JWT
- Implementar autenticación Firebase Auth
- Agregar rate limiting
- Validación del lado del servidor

## 🐛 Solución de Problemas

### El modal no aparece
- Verifica que los usuarios existan en Firestore
- Revisa la consola del navegador para errores

### Error de autenticación
- Verifica las credenciales
- Asegúrate de que Firebase esté configurado correctamente
- Verifica que el usuario tenga `isActive: true`

### Problemas de permisos
- Verifica el rol del usuario en Firestore
- El campo `role` debe ser exactamente: `'admin'` o `'user'`

## 📋 Usuarios de Prueba Predefinidos

| Usuario | Contraseña | Rol | Ubicación | Permisos Control Horario |
|---------|------------|-----|-----------|-------------------------|
| admin | admin123 | admin | puntarenas | ✅ Puede cambiar ubicación |
| usuario1 | user123 | user | puntarenas | ❌ Ubicación fija |
| usuario2 | user456 | user | cartago | ❌ Ubicación fija |
