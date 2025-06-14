# Gestión de SuperAdmin desde Base de Datos

## 📋 Resumen

El usuario **SuperAdmin** se crea y gestiona directamente desde la base de datos usando scripts de migración y herramientas administrativas, no desde la interfaz web.

## 🚀 Comandos Rápidos

```bash
# Crear SuperAdmin
npm run superadmin:create

# Verificar SuperAdmins existentes  
npm run superadmin:list

# Desactivar SuperAdmin
npm run superadmin:deactivate <admin-id>
```

## 🔐 Credenciales por Defecto

```
Usuario: superadmin
Contraseña: super123
Rol: superadmin  
Ubicación: san-jose
Estado: Activo
```

## ⚠️ Seguridad

- Las contraseñas deben hashearse en producción
- Usar Firebase Admin SDK para operaciones seguras
- Mantener logs de auditoría de todas las operaciones
- Nunca eliminar SuperAdmins, solo desactivar

## 📁 Archivos Relacionados

- `scripts/create-superadmin-db.js` - Script principal
- `scripts/create-superadmin.sql` - Para bases SQL
- `src/md/SUPERADMIN_ROLES.md` - Documentación completa
