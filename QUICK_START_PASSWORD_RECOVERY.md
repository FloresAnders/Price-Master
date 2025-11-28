# 🚀 Guía Rápida - Sistema de Recuperación de Contraseña

## Para Usuarios (Superadmins)

### ¿Olvidaste tu contraseña?

1. **Ve al login** de Time Master
2. Click en **"¿Olvidaste tu contraseña?"**
3. **Ingresa tu email** de superadministrador
4. Click en **"Enviar Enlace"**
5. **Revisa tu email** (puede tardar 1-2 minutos)
6. **Click en el enlace** del email (o copia el URL en tu navegador)
7. **Ingresa tu nueva contraseña** (debe cumplir requisitos de seguridad)
8. **Confirma la contraseña**
9. Click en **"Restablecer Contraseña"**
10. ✅ **Listo!** Serás redirigido al login

### Requisitos de la Nueva Contraseña

Tu contraseña debe tener:
- ✅ Mínimo 8 caracteres
- ✅ Al menos una mayúscula (A-Z)
- ✅ Al menos una minúscula (a-z)
- ✅ Al menos un número (0-9)
- ✅ Al menos un carácter especial (!@#$%^&*)

### ⏰ Importante

- El enlace de recuperación **expira en 1 hora**
- Solo puedes usar el enlace **una vez**
- Si expira, debes solicitar uno nuevo

## Para Desarrolladores

### Configuración Inicial

1. **Variables de entorno** (`.env.local`):
```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

2. **Configurar Gmail App Password**:
   - Ve a: https://myaccount.google.com/apppasswords
   - Habilita verificación en 2 pasos
   - Genera contraseña de aplicación
   - Usa esa contraseña en `GMAIL_APP_PASSWORD`

### Uso Programático

#### Solicitar recuperación:
```typescript
const response = await fetch('/api/auth/request-password-reset', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@example.com' })
});
```

#### Resetear contraseña:
```typescript
const response = await fetch('/api/auth/reset-password', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: 'TOKEN_FROM_EMAIL',
    newPassword: 'NewPassword123!',
    confirmPassword: 'NewPassword123!'
  })
});
```

### Limpieza de Tokens Expirados

Ejecutar manualmente:
```typescript
import { RecoveryTokenService } from '@/services/recoveryTokenService';

const count = await RecoveryTokenService.cleanupExpiredTokens();
//(`Tokens eliminados: ${count}`);
```

### Verificar Logs de Seguridad

En Firestore:
```
Collection: security_logs
Filter: type == 'password_recovery_request'
Sort: timestamp DESC
```

## Solución de Problemas

### 🔴 No recibo el email

**Posibles causas:**
1. Email en spam/correo no deseado
2. Email incorrecto en Firestore
3. Configuración de Gmail incorrecta
4. Usuario no es superadmin

**Solución:**
- Revisa carpeta spam
- Verifica `GMAIL_USER` y `GMAIL_APP_PASSWORD`
- Verifica rol del usuario en Firestore
- Revisa logs del servidor

### 🔴 Token inválido o expirado

**Causas:**
- Token ya usado
- Más de 1 hora desde solicitud
- Token copiado incorrectamente

**Solución:**
- Solicita un nuevo enlace
- Copia el URL completo del email
- Usa el enlace dentro de 1 hora

### 🔴 Error al actualizar contraseña

**Causas:**
- Contraseña no cumple requisitos
- Contraseñas no coinciden
- Token inválido

**Solución:**
- Verifica requisitos de contraseña
- Asegúrate de escribir igual en ambos campos
- Solicita nuevo enlace si es necesario

## Testing Local

### 1. Iniciar desarrollo:
```bash
npm run dev
```

### 2. Probar flujo completo:
1. Ve a: http://localhost:3000
2. Click "¿Olvidaste tu contraseña?"
3. Ingresa un email de superadmin
4. Revisa consola del servidor para ver logs
5. Copia el URL generado (se muestra en logs)
6. Pega en navegador
7. Completa formulario

### 3. Ver tokens en Firestore:
- Collection: `recovery_tokens`
- Verifica campos: `token`, `email`, `expiresAt`, `used`

## Monitoreo

### Métricas importantes:

1. **Solicitudes de recuperación**
   - Collection: `security_logs`
   - Type: `password_recovery_request`

2. **Tokens activos**
   - Collection: `recovery_tokens`
   - Filter: `used == false AND expiresAt > NOW()`

3. **Tasa de éxito**
   - Tokens usados vs tokens creados
   - Tiempo promedio de resolución

## Seguridad

### ✅ Implementado:
- Hash SHA-256 de tokens
- Expiración de 1 hora
- Uso único de tokens
- Invalidación de tokens anteriores
- Logs de auditoría
- Validación de requisitos de contraseña
- No revelación de información sensible

### ⚠️ Recomendaciones adicionales:
- Implementar rate limiting
- Agregar CAPTCHA
- Monitorear solicitudes inusuales
- Alertas por múltiples intentos fallidos

## Mantenimiento

### Tareas recomendadas:

**Diario:**
- Monitorear logs de error
- Verificar emails enviados

**Semanal:**
- Revisar tokens expirados
- Análisis de uso del sistema

**Mensual:**
- Limpiar logs antiguos
- Revisar métricas de seguridad
- Actualizar dependencias

## Contacto de Soporte

Si necesitas ayuda adicional:
1. Revisa logs en Firestore (`security_logs`)
2. Verifica configuración de email
3. Consulta documentación completa en `PASSWORD_RECOVERY_SYSTEM.md`

---

✅ Sistema listo para usar - Happy coding!
