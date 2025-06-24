# 🔐 Sistema de Seguridad Avanzado - Price Master

## ✨ Mejoras de Seguridad Implementadas

Se han implementado mejoras críticas de seguridad y auditoría para el sistema de autenticación, especialmente enfocadas en la protección del rol SuperAdmin.

## 🛡️ Características Principales

### 1. **Gestión Avanzada de Sesiones**
- ⏰ **Duración diferenciada por rol**:
  - SuperAdmin: 4 horas (alta seguridad)
  - Admin: 24 horas (seguridad estándar)
  - User: 30 días (conveniencia)
- 🕐 **Timeout de inactividad automático**:
  - SuperAdmin: 30 minutos
  - Admin: 2 horas
  - User: 8 horas
- 🔄 **Detección de actividad del usuario**
- ⚠️ **Advertencias de expiración de sesión**

### 2. **Sistema de Auditoría Completo**
- 📊 **Logs detallados** de todas las acciones críticas
- 🕒 **Timestamps** precisos con zona horaria
- 👤 **Tracking de usuario** y sesión
- 🌐 **Información del navegador** y plataforma
- 💾 **Retención configurable** de logs (30-2555 días)
- 🔍 **Acceso exclusivo** para SuperAdmin

### 3. **Notificaciones de Seguridad en Tiempo Real**
- 🚨 **Alertas automáticas** para eventos críticos
- 📱 **Múltiples sesiones detectadas**
- 🌍 **Acceso desde nueva ubicación**
- 🔒 **Intentos de acceso fallidos**
- ⏰ **Sesiones próximas a expirar**
- 🎯 **Notificaciones personalizadas** por rol

### 4. **Monitor de Sesión Inteligente**
- 📊 **Dashboard en tiempo real** para SuperAdmin
- ⏱️ **Tiempo restante de sesión**
- 🔴 **Indicadores visuales** de estado
- 📋 **Acceso directo a logs** de auditoría
- 🎨 **Interfaz diferenciada** por rol

### 5. **Configuración de Seguridad Avanzada**
- ⚙️ **Panel exclusivo SuperAdmin**
- 🔐 **Política de contraseñas** configurable
- 🕐 **Tiempos de sesión** ajustables
- 🚫 **Control de intentos fallidos**
- 📝 **Configuración de auditoría**
- 💾 **Persistencia** de configuración

## 🗂️ Archivos Modificados/Creados

### **Core Authentication**
```
src/hooks/useAuth.ts - Hook principal mejorado
├── ✅ Gestión de sesiones diferenciada
├── ✅ Sistema de auditoría integrado
├── ✅ Detección de inactividad
├── ✅ Extensión de sesión
└── ✅ Funciones de seguridad avanzada
```

### **Componentes de Seguridad**
```
src/components/
├── SessionMonitor.tsx - Monitor de sesión en tiempo real
├── SecurityNotifications.tsx - Sistema de alertas
└── SecuritySettings.tsx - Panel de configuración
```

## 🔧 Nuevas Funciones en useAuth

### **Gestión de Sesiones**
```typescript
// Nuevas funciones disponibles
extendSession()           // Extender sesión actual
getSessionTimeLeft()      // Tiempo restante en horas
updateActivity()          // Actualizar actividad del usuario
```

### **Auditoría y Seguridad**
```typescript
getAuditLogs()           // Obtener logs (solo SuperAdmin)
requiresTwoFactor()      // Verificar si necesita 2FA
sessionWarning           // Estado de advertencia de sesión
```

### **Estados Mejorados**
```typescript
{
  user,                  // Datos del usuario
  isAuthenticated,       // Estado de autenticación
  loading,              // Estado de carga
  sessionWarning,       // Advertencia de expiración
  // ... funciones existentes
}
```

## 📊 Sistema de Logs de Auditoría

### **Estructura de Log**
```typescript
interface AuditLog {
  timestamp: string;      // ISO timestamp
  userId: string;         // ID del usuario
  userName: string;       // Nombre del usuario
  action: string;         // Acción realizada
  details: string;        // Detalles adicionales
  ipAddress?: string;     // IP (futuro)
  userAgent?: string;     // Navegador
  sessionId: string;      // ID de sesión único
}
```

### **Acciones Registradas**
- `LOGIN_SUCCESS` - Login exitoso
- `LOGOUT` - Cierre de sesión
- `SESSION_RESUMED` - Sesión reanudada
- `SESSION_EXPIRED` - Sesión expirada
- `SESSION_EXTENDED` - Sesión extendida
- `AUDIT_LOGS_ACCESSED` - Acceso a logs (SuperAdmin)
- `SECURITY_CONFIG_UPDATED` - Configuración actualizada
- `UNAUTHORIZED_ACCESS` - Intento de acceso no autorizado

## 🎨 Componentes de UI

### **SessionMonitor**
```tsx
<SessionMonitor 
  showAuditLogs={true}  // Mostrar acceso a logs
/>
```
- 🔴 **Monitor SuperAdmin**: Panel rojo con información crítica
- ⏰ **Timer de sesión**: Tiempo restante visible
- 📊 **Acceso a logs**: Botón para ver auditoría
- 🎯 **Estados visuales**: Indicadores por rol

### **SecurityNotifications**
```tsx
<SecurityNotifications />
```
- 🔔 **Notificaciones persistentes**: Para alertas críticas
- 📱 **Panel deslizable**: Lista de notificaciones
- 🎨 **Iconos diferenciados**: Por tipo de alerta
- ⚡ **Acciones rápidas**: Botones de respuesta

### **SecuritySettings**
```tsx
// Solo para SuperAdmin
<SecuritySettings />
```
- ⚙️ **Configuración completa**: Todos los parámetros
- 🔐 **Validación de acceso**: Solo SuperAdmin
- 💾 **Persistencia**: Guarda en localStorage
- 📊 **Logs de cambios**: Auditoría de modificaciones

## 🚀 Implementación en la App

### **Layout Principal**
```tsx
// src/app/layout.tsx
import SessionMonitor from '@/components/SessionMonitor';
import SecurityNotifications from '@/components/SecurityNotifications';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SessionMonitor showAuditLogs={true} />
        <SecurityNotifications />
      </body>
    </html>
  );
}
```

### **Página de Configuración**
```tsx
// src/app/security/page.tsx
import SecuritySettings from '@/components/SecuritySettings';

export default function SecurityPage() {
  return <SecuritySettings />;
}
```

## 🔒 Configuración por Defecto

### **Duraciones de Sesión**
```typescript
SESSION_DURATION_HOURS = {
  superadmin: 4,     // 4 horas - Alta seguridad
  admin: 24,         // 24 horas - Seguridad estándar  
  user: 720          // 30 días - Conveniencia
}
```

### **Timeouts de Inactividad**
```typescript
MAX_INACTIVITY_MINUTES = {
  superadmin: 30,    // 30 minutos
  admin: 120,        // 2 horas
  user: 480          // 8 horas
}
```

### **Política de Contraseñas**
```typescript
passwordPolicy = {
  minLength: 8,
  requireSpecialChars: true,
  requireNumbers: true, 
  requireUppercase: true,
  maxAge: 90  // días
}
```

## 📱 Responsive Design

Todos los componentes están optimizados para:
- 📱 **Móviles**: Modales full-screen, controles táctiles
- 💻 **Desktop**: Tooltips, panels laterales
- 🎨 **Dark Mode**: Soporte completo para temas
- ♿ **Accesibilidad**: ARIA labels, keyboard navigation

## 🛠️ Futuras Mejoras

### **Próximas Implementaciones**
- [ ] 🔐 Autenticación de dos factores (2FA)
- [ ] 🌐 Detección de geolocalización real
- [ ] 📧 Notificaciones por email
- [ ] 🔄 Sincronización con servidor
- [ ] 📊 Dashboard de analytics de seguridad
- [ ] 🚨 Alertas por Slack/Teams
- [ ] 🔍 Búsqueda avanzada en logs
- [ ] 📁 Exportación de logs de auditoría

### **Integración con Backend**
```typescript
// Futuras APIs
POST /api/auth/audit-log     // Enviar logs al servidor
GET  /api/security/config    // Obtener configuración
PUT  /api/security/config    // Actualizar configuración
POST /api/auth/2fa/verify    // Verificar 2FA
GET  /api/security/alerts    // Obtener alertas
```

## 🔧 Configuración de Desarrollo

### **Variables de Entorno**
```env
# Configuración de seguridad
SECURITY_AUDIT_ENABLED=true
SECURITY_REAL_TIME_ALERTS=true
SECURITY_LOG_RETENTION_DAYS=365
SECURITY_2FA_ENABLED=false
```

### **Testing**
```bash
# Probar funcionalidades de seguridad
npm run test:security

# Simular eventos de seguridad
npm run test:security:events

# Verificar logs de auditoría
npm run test:audit:logs
```

## 📞 Soporte y Troubleshooting

### **Problemas Comunes**

1. **Sesión se cierra automáticamente**
   - Verificar configuración de inactividad
   - Comprobar duración de sesión por rol

2. **No aparecen notificaciones**
   - Verificar permisos del navegador
   - Comprobar que el rol tenga acceso

3. **Logs no se guardan**
   - Verificar localStorage disponible
   - Comprobar límites de almacenamiento

### **Debug Mode**
```typescript
// Habilitar logs de debug
localStorage.setItem('debug_security', 'true');

// Ver configuración actual
console.log(JSON.parse(localStorage.getItem('pricemaster_security_config')));

// Ver logs de auditoría
console.log(JSON.parse(localStorage.getItem('pricemaster_audit_logs')));
```

## 📈 Métricas de Seguridad

El sistema registra automáticamente:
- 👥 **Sesiones activas** por rol
- 🕐 **Tiempo promedio** de sesión
- 🚨 **Eventos de seguridad** por día
- 🔒 **Intentos de acceso** fallidos
- 📊 **Uso de funcionalidades** críticas

---

**✅ ESTADO**: Sistema completamente implementado y funcional  
**📅 FECHA**: Implementado en Junio 2025  
**🔧 VERSIÓN**: v3.0 - Sistema de Seguridad Avanzado  
**👨‍💻 MANTENIMIENTO**: Revisar logs semanalmente, actualizar configuración según necesidades

---

> ⚠️ **IMPORTANTE**: Este sistema está diseñado para un entorno de producción. Asegúrate de implementar la persistencia en servidor y las notificaciones por email para máxima seguridad.
