# Sistema de Recuperación de Contraseña - Time Master

## 📋 Resumen

Sistema completo de recuperación de contraseña implementado para superadministradores, utilizando tokens seguros con expiración y notificaciones por email.

## 🏗️ Arquitectura Implementada

### 1. Tipos y Modelos (`src/types/recovery.ts`)
```typescript
- RecoveryToken: Modelo del token en Firestore
- RecoveryRequest: Solicitud de recuperación
- PasswordResetPayload: Datos para resetear contraseña
```

### 2. Servicio de Tokens (`src/services/recoveryTokenService.ts`)
**Funcionalidades:**
- ✅ Generación de tokens criptográficamente seguros (SHA-256)
- ✅ Validación de tokens (expiración, uso único)
- ✅ Invalidación de tokens anteriores
- ✅ Registro en logs de auditoría
- ✅ Limpieza automática de tokens expirados

### 3. Servicio de Email (`src/services/email.ts`)
**Métodos agregados:**
- `sendPasswordRecoveryEmail()`: Envía email con enlace de recuperación
- `sendPasswordChangedNotification()`: Confirma cambio exitoso

**Templates incluyen:**
- HTML con diseño profesional
- Información de expiración clara
- Advertencias de seguridad
- Versión texto plano

### 4. API Routes

#### `/api/auth/request-password-reset`
**POST**: Solicita recuperación de contraseña
```json
Request: { "email": "admin@example.com" }
Response: { "success": true, "message": "Email enviado" }
```

**Seguridad:**
- No revela si el email existe
- Solo permite superadmins
- Invalida tokens anteriores

#### `/api/auth/reset-password`
**POST**: Restablece la contraseña
```json
Request: {
  "token": "abc123...",
  "newPassword": "NewPass123!",
  "confirmPassword": "NewPass123!"
}
Response: { "success": true, "message": "Contraseña actualizada" }
```

**Validaciones:**
- Token válido y no expirado
- Contraseñas coinciden
- Requisitos de seguridad cumplidos

### 5. Componentes UI

#### `PasswordRecoveryModal`
Modal para solicitar recuperación desde el login.

**Features:**
- Validación de email
- Loading states
- Mensajes de éxito/error
- Auto-cierre después de 3s

#### Página `/reset-password`
Formulario completo para establecer nueva contraseña.

**Features:**
- Validación en tiempo real
- Indicadores visuales de requisitos
- Mostrar/ocultar contraseña
- Validación de token automática
- Redirección al login

### 6. Integración en LoginModal
Botón "¿Olvidaste tu contraseña?" agregado al formulario de login.

## 🔒 Seguridad Implementada

| Feature | Descripción |
|---------|-------------|
| **Hash SHA-256** | Tokens hasheados antes de almacenar en BD |
| **Tokens únicos** | Cada solicitud genera un nuevo token criptográfico |
| **Expiración** | Tokens expiran en 1 hora |
| **Uso único** | Tokens se marcan como usados después de aplicar |
| **Invalidación** | Tokens anteriores se invalidan al generar nuevos |
| **Logs de auditoría** | Todas las solicitudes se registran |
| **Validación de contraseña** | Mínimo 8 caracteres, mayúsculas, minúsculas, números y especiales |
| **No revelar información** | API no indica si email existe o no |

## 📧 Configuración de Email

Asegúrate de tener estas variables de entorno:

```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Para Gmail:**
1. Habilita verificación en 2 pasos
2. Genera contraseña de aplicación en: https://myaccount.google.com/apppasswords
3. Usa esa contraseña en `GMAIL_APP_PASSWORD`

## 🚀 Flujo de Usuario

### Recuperación de Contraseña

```mermaid
1. Usuario → Click "¿Olvidaste tu contraseña?"
2. Modal → Ingresa email
3. Sistema → Valida superadmin
4. Sistema → Genera token único
5. Sistema → Envía email con enlace
6. Usuario → Click en enlace del email
7. Página → Valida token
8. Usuario → Ingresa nueva contraseña
9. Sistema → Valida requisitos
10. Sistema → Actualiza contraseña (hash)
11. Sistema → Marca token como usado
12. Sistema → Envía confirmación por email
13. Usuario → Redirigido al login
```

## 📁 Archivos Creados/Modificados

### Nuevos Archivos
```
src/types/recovery.ts
src/services/recoveryTokenService.ts
src/app/api/auth/request-password-reset/route.ts
src/app/api/auth/reset-password/route.ts
src/components/auth/PasswordRecoveryModal.tsx
src/app/reset-password/page.tsx
```

### Archivos Modificados
```
src/services/email.ts (+ 2 métodos)
src/components/auth/LoginModal.tsx (+ botón recuperación)
src/components/auth/index.ts (+ export)
```

## 🧪 Testing

### Flujo de prueba manual:

1. **Solicitar recuperación:**
```bash
curl -X POST http://localhost:3000/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@example.com"}'
```

2. **Verificar email recibido** (revisar bandeja de entrada)

3. **Resetear contraseña:**
```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token":"TOKEN_FROM_EMAIL",
    "newPassword":"NewPassword123!",
    "confirmPassword":"NewPassword123!"
  }'
```

4. **Verificar login con nueva contraseña**

## 🔧 Mantenimiento

### Limpieza de tokens expirados

El servicio incluye un método para limpiar tokens expirados:

```typescript
import { RecoveryTokenService } from '@/services/recoveryTokenService';

// Ejecutar manualmente
const deletedCount = await RecoveryTokenService.cleanupExpiredTokens();
//(`Tokens eliminados: ${deletedCount}`);
```

**Recomendación:** Ejecutar mediante cron job o Cloud Function cada hora.

## ⚠️ Consideraciones

1. **Solo Superadmins**: El sistema solo permite recuperación para usuarios con rol `superadmin`
2. **Email requerido**: Los superadmins deben tener email configurado en Firestore
3. **Firestore rules**: Asegúrate que la colección `recovery_tokens` tenga permisos adecuados
4. **Rate limiting**: Considera implementar límite de solicitudes por IP

## 📊 Colecciones Firestore

### `recovery_tokens`
```typescript
{
  token: string,           // Hash SHA-256 del token
  email: string,          // Email del usuario
  userId: string,         // ID del usuario
  createdAt: number,      // Timestamp de creación
  expiresAt: number,      // Timestamp de expiración
  used: boolean           // Si fue usado
}
```

### `security_logs`
```typescript
{
  type: 'password_recovery_request',
  email: string,
  userId: string,
  timestamp: number
}
```

## 🎨 UI/UX Features

- ✅ Diseño responsive
- ✅ Loading states
- ✅ Error handling completo
- ✅ Validación en tiempo real
- ✅ Indicadores visuales de requisitos
- ✅ Auto-redirect después de éxito
- ✅ Mensajes claros y descriptivos

## 🔐 Buenas Prácticas Implementadas

1. **Never trust client-side validation**: Todas las validaciones se repiten en el servidor
2. **Secure token generation**: Uso de crypto para tokens criptográficamente seguros
3. **Hash storage**: Tokens hasheados antes de guardar en BD
4. **Time-based expiration**: Tokens expiran automáticamente
5. **Single use tokens**: Previene reutilización
6. **Audit logging**: Todas las acciones quedan registradas
7. **Email confirmation**: Usuario notificado de cambios
8. **No information leakage**: API no revela si usuario existe

## 📝 Próximos Pasos (Opcional)

- [ ] Implementar rate limiting
- [ ] Agregar CAPTCHA en solicitud de recuperación
- [ ] Implementar 2FA como requisito adicional
- [ ] Dashboard de auditoría de seguridad
- [ ] Notificaciones push además de email
- [ ] Recuperación mediante SMS
- [ ] Preguntas de seguridad adicionales

---

✅ **Sistema completamente funcional y listo para producción**
