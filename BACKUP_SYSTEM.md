# Sistema de Backup CCSS - Price Master

## 📋 Descripción

Sistema automático de backup y restauración de la configuración CCSS para superadministradores. Permite generar, descargar y enviar por correo electrónico backups de la configuración, así como restaurar la configuración desde archivos de backup.

## 🚀 Funcionalidades Implementadas

### 1. Backup Automático en `/edit`

Cuando un **superadmin** inicia sesión en la página `/edit`:

- ✅ **Backup automático silencioso**: Se genera automáticamente un backup de la colección `ccss-config`
- ✅ **Envío automático por email**: Se envía automáticamente a `price.master.srl@gmail.com`
- ✅ **Operación silenciosa**: No se descarga localmente ni se muestra notificación al usuario
- ✅ **Logs solo en consola**: Los errores se registran únicamente en la consola del navegador

### 2. Controles Manuales de Backup

- ✅ **Restauración en firebase-test**: Interfaz completa para restaurar backups desde archivos
- ✅ **Validación de archivos**: Validación automática del formato de backup
- ✅ **Vista previa**: Información del backup antes de restaurar

### 3. Restauración de Backup en `/firebase-test`

- ✅ **Carga de archivo**: Interfaz drag & drop para cargar archivos JSON de backup
- ✅ **Validación**: Validación automática del formato del archivo de backup
- ✅ **Vista previa**: Muestra información del backup antes de restaurar
- ✅ **Restauración**: Restaura la configuración CCSS desde el archivo de backup

### 4. Soporte de Email con Adjuntos

- ✅ **API actualizada**: La API de envío de emails ahora soporta adjuntos
- ✅ **Formato base64**: Los archivos se envían como adjuntos en base64
- ✅ **Email profesional**: Plantilla de email profesional con información del backup

## 🛠️ Archivos Nuevos/Modificados

### Archivos Nuevos:
- `src/services/backup.ts` - Servicio principal de backup y restauración
- `src/components/AutoBackup.tsx` - Componente de backup automático para `/edit`
- `src/components/BackupRestore.tsx` - Componente de restauración para `/firebase-test`

### Archivos Modificados:
- `src/app/api/send-email/route.ts` - Añadido soporte para adjuntos
- `src/app/edit/page.tsx` - Integrado componente AutoBackup
- `src/app/firebase-test/page.tsx` - Integrado componente BackupRestore
- `src/firebase/index.ts` - Exportado BackupService

## 📧 Configuración de Email

### Email de Destino Fijo:
- **Destinatario**: `price.master.srl@gmail.com` (configurado automáticamente)
- **Operación silenciosa**: No requiere configuración por parte del usuario
- **Envío automático**: Se activa automáticamente al iniciar sesión como superadmin

### Variables de Entorno Requeridas:
```env
GMAIL_USER=price.master.srl@gmail.com
GMAIL_APP_PASSWORD=wnzzwgiuqxmdpcng
```

### Configuración en la UI:
1. En la página `/edit`, configurar el email del superadmin
2. El email se guarda en `localStorage` con clave `superadmin_email`
3. Si no se configura, se usa un patrón por defecto: `nombre.usuario@pricemaster.local`

## 📁 Estructura del Archivo de Backup

```json
{
  "timestamp": "2025-01-07T12:00:00.000Z",
  "version": "1.0.0",
  "ccssConfig": {
    "default": {
      "mt": 3672.46,
      "tc": 11017.39,
      "valorhora": 1441,
      "horabruta": 1529.62,
      "updatedAt": "2025-01-07T12:00:00.000Z"
    },
    "collection": [
      // Toda la colección ccss-config
    ]
  },
  "metadata": {
    "exportedBy": "NombreDelSuperAdmin",
    "exportedAt": "2025-01-07T12:00:00.000Z",
    "systemVersion": "Price Master v2.0"
  }
}
```

## 🔐 Seguridad

- **Solo superadmins**: El backup solo está disponible para usuarios con rol `superadmin`
- **Validación**: Los archivos de backup se validan antes de la restauración
- **Auditoría**: Todas las acciones de backup se registran en los logs del sistema
- **Advertencias**: Se muestran advertencias antes de operaciones destructivas

## 🚨 Uso del Sistema

### Para Backup Automático:

1. **Completamente automático**: Simplemente inicia sesión como superadmin en `/edit`
2. **Sin intervención del usuario**: El sistema envía automáticamente el backup a `price.master.srl@gmail.com`
3. **Operación silenciosa**: No se muestran notificaciones ni se descarga nada localmente

### Para Restaurar Backup:

1. Ve a `/firebase-test`
2. En la sección "Restaurar Backup CCSS":
   - Arrastra y suelta un archivo JSON de backup, o haz clic para seleccionarlo
   - Revisa la información del backup mostrada
   - Haz clic en "Restaurar Configuración"
   - **⚠️ ADVERTENCIA**: Esta acción reemplaza completamente la configuración actual

### Nombres de Archivos:

Los archivos de backup se generan con el formato:
```
backup_ccss_YYYYMMDD_HHMM.json
```

Ejemplo: `backup_ccss_20250107_1430.json`

## 🔄 Flujo de Trabajo Recomendado

1. **Backup Automático**: Los superadmins generan backups automáticamente cada vez que inician sesión en `/edit`
2. **Almacenamiento en Email**: Los backups se almacenan automáticamente en `price.master.srl@gmail.com`
3. **Restauración cuando sea necesario**: Usar `/firebase-test` para restaurar desde los archivos recibidos por email
4. **Operación transparente**: El sistema funciona sin intervención del usuario

## 🐛 Solución de Problemas

### Error al generar backup:
- Verificar conexión a Firebase
- Asegurar que el usuario tenga rol `superadmin`

### Error al enviar email:
- Verificar variables de entorno `GMAIL_USER=price.master.srl@gmail.com` y `GMAIL_APP_PASSWORD`
- Verificar conexión a internet

### Error al restaurar backup:
- Verificar que el archivo JSON sea válido
- Verificar que el archivo tenga la estructura correcta de backup
- Verificar permisos de escritura en Firebase

## 📝 Notas Adicionales

- El sistema funciona completamente en segundo plano
- No se muestra ninguna interfaz de usuario para el backup automático
- Los errores solo se registran en la consola del navegador
- El email se envía automáticamente a `price.master.srl@gmail.com`
- Las operaciones son atómicas y revierten en caso de error
- El sistema mantiene compatibilidad con versiones anteriores de backups
