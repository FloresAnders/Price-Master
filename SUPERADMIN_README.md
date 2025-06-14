# Gestión de SuperAdmin desde Base de Datos

## 📋 Resumen

El usuario **SuperAdmin** se crea y gestiona directamente desde la base de datos usando scripts de migración y herramientas administrativas, no desde la interfaz web.

## 🎯 Funcionalidades Exclusivas del SuperAdmin

### 🔥 **Acceso Completo al Editor de Datos** (`/edit`)
- Editar ubicaciones, sorteos y usuarios
- Importar/Exportar datos en formato JSON
- Gestión completa del sistema

### 🏢 **Control de Ubicación Ampliado**
- **NUEVO**: Puede cambiar ubicación en Control de Horario
- Mismo nivel de permisos que Admin + acceso al editor
- Supervisión multi-ubicación sin restricciones

### 📸 **Exportación de Horarios como Imagen**
- **NUEVO**: Exportar horarios desde Control de Horario como imagen PNG
- Formato de alta resolución (1400x1000px) con leyenda completa
- Incluye información de empleados, turnos y metadatos

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

## 📸 Nueva Funcionalidad: Exportar Horarios como Imagen

- **Ubicación**: Control de Horario (botón naranja "📷 Exportar")
- **Formato**: PNG de alta resolución (1400x1000px)
- **Contenido**: Horarios completos del mes con leyenda de turnos
- **Seguridad**: Solo disponible para SuperAdmin
- **Datos incluidos**: Empleados, turnos (N/D/L), fechas, metadatos

## ⚠️ Seguridad

- Las contraseñas deben hashearse en producción
- Usar Firebase Admin SDK para operaciones seguras
- Mantener logs de auditoría de todas las operaciones
- Nunca eliminar SuperAdmins, solo desactivar

## 📁 Archivos Relacionados

- `scripts/create-superadmin-db.js` - Script principal
- `scripts/create-superadmin.sql` - Para bases SQL
- `src/md/SUPERADMIN_ROLES.md` - Documentación completa
- `EXPORT_DEPENDENCIES.md` - Dependencias opcionales para exportación
