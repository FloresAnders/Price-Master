# 📧 Sistema de Correo con Firestore Triggers - Price Master

## ✅ Implementación Completada

Este documento detalla el sistema de correo implementado usando **Firestore Triggers** y **Firebase Cloud Functions**.

---

## 📁 Archivos Creados

### **Firebase Functions**
- `functions/package.json` - Dependencias de Functions
- `functions/index.js` - Cloud Function para procesar emails
- `functions/.env` - Variables de entorno (Gmail credentials)
- `functions/.gitignore` - Archivos a ignorar

### **Servicio de Email**
- `src/services/email.ts` - Migrado de `sendEmail()` a `queueEmail()`

### **Páginas de Prueba**
- `src/app/test-email/page.tsx` - UI para probar el sistema
- `src/app/api/test-email/route.ts` - API endpoint de prueba

### **Configuración Firebase**
- `firebase.json` - Configuración principal
- `firestore.rules` - Reglas de seguridad
- `firestore.indexes.json` - Índices de Firestore

---

## 🚀 Cómo Desplegar

### 1. Instalar Dependencias de Functions
```bash
cd functions
npm install
cd ..
```

### 2. Configurar Firebase CLI
```bash
# Si no lo tienes instalado
npm install -g firebase-tools

# Login
firebase login

# Seleccionar proyecto
firebase use pricemaster-4a611
```

### 3. Desplegar Functions
```bash
firebase deploy --only functions
```

### 4. Desplegar Reglas de Firestore (Opcional)
```bash
firebase deploy --only firestore:rules
```

---

## 🎯 Arquitectura del Sistema

```
┌─────────────────┐
│   Next.js App   │
│                 │
│ EmailService    │
│  .queueEmail()  │
└────────┬────────┘
         │
         │ addDoc()
         ▼
┌─────────────────┐
│   Firestore DB  │
│                 │
│ Collection:     │
│   "emails"      │
└────────┬────────┘
         │
         │ onDocumentCreated
         ▼
┌─────────────────┐
│ Cloud Function  │
│                 │
│ sendEmailTrigger│
└────────┬────────┘
         │
         │ nodemailer
         ▼
┌─────────────────┐
│   Gmail SMTP    │
│                 │
│  Email Enviado  │
└─────────────────┘
```

---

## 📝 Uso del Sistema

### **Envío de Email Básico**
```typescript
import { EmailService } from '@/services/email';

await EmailService.queueEmail({
  to: 'usuario@ejemplo.com',
  subject: 'Asunto del mensaje',
  text: 'Contenido en texto plano',
  html: '<p>Contenido en <strong>HTML</strong></p>'
});
```

### **Emails Predefinidos**
```typescript
// Recuperación de contraseña
await EmailService.sendPasswordRecoveryEmail(email, token, expiresAt);

// Notificación de cambio de contraseña
await EmailService.sendPasswordChangedNotification(email);
```

---

## 🧪 Probar el Sistema

### **Opción 1: Página de Prueba**
1. Visita: `http://localhost:3000/test-email`
2. Ingresa un email
3. Haz clic en "Enviar Email de Prueba"

### **Opción 2: API Endpoint**
```bash
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@ejemplo.com"}'
```

### **Opción 3: Código Directo**
```typescript
import { EmailService } from '@/services/email';

await EmailService.queueEmail({
  to: 'test@ejemplo.com',
  subject: 'Prueba',
  text: 'Este es un email de prueba'
});
```

---

## 📊 Monitoreo

### **Firebase Console**
- **Functions Logs**: Firebase Console → Functions → Logs
- **Firestore Data**: Firebase Console → Firestore → Collection "emails"

### **Estados del Email**
- `pending` - Email encolado, esperando procesamiento
- `sent` - Email enviado exitosamente
- `failed` - Error al enviar (con detalles del error)

### **Campos en Firestore**
```javascript
{
  to: "usuario@ejemplo.com",
  subject: "Asunto",
  text: "Contenido texto",
  html: "<p>Contenido HTML</p>",
  status: "pending",
  createdAt: Timestamp,
  sentAt: Timestamp,      // Solo si status = "sent"
  messageId: "...",       // ID del mensaje enviado
  error: "...",           // Solo si status = "failed"
  failedAt: Timestamp     // Solo si status = "failed"
}
```

---

## 🔧 Variables de Entorno

### **Functions (.env)**
```env
GMAIL_USER=price.master.srl@gmail.com
GMAIL_APP_PASSWORD=wnzzwgiuqxmdpcng
```

### **Next.js (.env.local)**
```env
# Firebase config ya existente
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
# etc...
```

---

## ⚙️ Configuración Avanzada

### **Límites de Rate**
La configuración actual en `functions/index.js`:
```javascript
pool: true,
maxConnections: 1,
rateDelta: 20000,  // 20 segundos
rateLimit: 5       // 5 emails por periodo
```

### **Timeouts**
Firebase Functions timeout por defecto: **60 segundos**

Para cambiar:
```javascript
exports.sendEmailTrigger = onDocumentCreated(
  {
    document: "emails/{emailId}",
    timeoutSeconds: 120  // 2 minutos
  },
  async (event) => { /* ... */ }
);
```

---

## 🐛 Solución de Problemas

### **Error: "Unsupported field value: undefined"**
**Solución**: Solo incluir campos definidos en `emailData`
```typescript
// ❌ Mal
emailData.html = options.html;

// ✅ Bien
if (options.html !== undefined) {
  emailData.html = options.html;
}
```

### **Error: "Function not found"**
**Solución**: Desplegar functions
```bash
firebase deploy --only functions
```

### **Error: "Permission denied"**
**Solución**: Verificar reglas de Firestore en `firestore.rules`

### **Email no se envía**
**Pasos de diagnóstico**:
1. Verificar logs: `firebase functions:log`
2. Verificar documento en Firestore → collection "emails"
3. Verificar campo `status` (pending/sent/failed)
4. Si `failed`, ver campo `error`

---

## 📈 Beneficios del Sistema

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Escalabilidad** | ❌ Limitada | ✅ Ilimitada (Firebase) |
| **Fiabilidad** | ❌ Síncrono | ✅ Reintentos automáticos |
| **Monitoreo** | ❌ Básico | ✅ Logs completos |
| **Performance** | ❌ Bloquea app | ✅ Asíncrono |
| **Mantenibilidad** | ❌ Acoplado | ✅ Desacoplado |

---

## 📚 Referencias

- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Firestore Triggers](https://firebase.google.com/docs/functions/firestore-events)
- [Nodemailer Documentation](https://nodemailer.com/)

---

## ✨ Próximos Pasos

- [ ] Implementar templates de email más avanzados
- [ ] Agregar soporte para attachments desde Firestore
- [ ] Crear dashboard de monitoreo de emails
- [ ] Implementar rate limiting más sofisticado
- [ ] Agregar notificaciones de bounce/spam

---

**🎉 Sistema implementado y listo para usar!**

*Para preguntas o soporte, consulta los logs de Firebase Functions.*
