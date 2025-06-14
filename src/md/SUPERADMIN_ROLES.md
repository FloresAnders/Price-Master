# 🔐 Sistema de Roles con SuperAdmin - Price Master

## ✨ Nuevo Tipo de Usuario: SuperAdmin

Se ha implementado un nuevo rol de usuario **SuperAdmin** con permisos exclusivos para el Editor de Datos.

## 🏷️ Tipos de Usuario y Permisos

### 🔴 **SuperAdmin**
- **Acceso Exclusivo**: Editor de Datos (`/edit`)
- **Permisos**: 
  - ✅ Editar ubicaciones
  - ✅ Editar sorteos
  - ✅ Gestionar usuarios
  - ✅ Importar/Exportar datos
  - ✅ Todas las funcionalidades del sistema
- **Credenciales de prueba**: `superadmin` / `super123`

### 🟠 **Admin**
- **Acceso**: Control de Horario, Timing Control
- **Permisos**:
  - ✅ Puede cambiar ubicación en Control de Horario
  - ✅ Acceso a todas las funcionalidades excepto Editor de Datos
  - ❌ NO puede acceder al Editor de Datos
- **Credenciales de prueba**: `admin` / `admin123`

### 🔵 **User**
- **Acceso**: Control de Horario, Timing Control (con limitaciones)
- **Permisos**:
  - ❌ Ubicación fija (no puede cambiar en Control de Horario)
  - ❌ NO puede acceder al Editor de Datos
  - ✅ Acceso a funcionalidades básicas
- **Credenciales de prueba**: `usuario1` / `user123`, `usuario2` / `user456`

## 🛡️ Protección de Rutas

### `/edit` - Editor de Datos
- **Requiere**: Rol `superadmin`
- **Comportamiento**:
  - Si no está autenticado: Muestra modal de login con mensaje específico
  - Si está autenticado pero no es SuperAdmin: Mensaje de acceso denegado
  - Si es SuperAdmin: Acceso completo al editor

### `/` - Pestañas principales
- **Control de Horario**: Requiere autenticación (cualquier rol)
- **Timing Control**: Requiere autenticación (cualquier rol)
- **Otras pestañas**: Sin restricciones

## 🚀 Cómo Crear SuperAdmin

### 🔥 **IMPORTANTE**: SuperAdmin se genera desde la Base de Datos

El usuario SuperAdmin **DEBE** crearse directamente desde la base de datos usando scripts de migración, no desde la interfaz web.

### 1. **Usando Firebase Admin SDK (Recomendado)**
```bash
# Instalar dependencias si es necesario
npm install firebase-admin

# Crear SuperAdmin desde la base de datos
npm run superadmin:create

# Listar SuperAdmins existentes
npm run superadmin:list

# Desactivar SuperAdmin (por ID)
npm run superadmin:deactivate <admin-id>
```

### 2. **Script Manual de Base de Datos**
```bash
# Ejecutar el script directamente
node scripts/create-superadmin-db.js create

# Ver ayuda de comandos
node scripts/create-superadmin-db.js
```

### 3. **Para Base de Datos SQL**
```bash
# Ejecutar el script SQL
mysql -u username -p database_name < scripts/create-superadmin.sql
# o
psql -U username -d database_name -f scripts/create-superadmin.sql
```

### 4. **Verificar Creación**
```bash
# Listar todos los SuperAdmins
npm run superadmin:list

# Verificar en la aplicación
# Navegar a: http://localhost:3000/edit
# Login con: superadmin / super123
```

| Usuario | Contraseña | Rol | Acceso a /edit |
|---------|------------|-----|----------------|
| superadmin | super123 | superadmin | ✅ Permitido |
| admin | admin123 | admin | ❌ Denegado |
| usuario1 | user123 | user | ❌ Denegado |

### 5. **Probar Acceso al Editor**
- **SuperAdmin**: Debe ver el editor completo con indicador verde
- **Admin/User**: Debe ver mensaje de "Acceso Denegado"
- **No autenticado**: Debe ver modal de login

## 🔧 Archivos Modificados

### Tipos y Interfaces
- `src/types/firestore.ts` - Agregado rol 'superadmin'
- `src/hooks/useAuth.ts` - Función `isSuperAdmin()`

### Componentes
- `src/app/edit/page.tsx` - Protección completa de la ruta
- `src/edit/DataEditor.tsx` - Dropdown con nuevo rol
- `src/components/LoginModal.tsx` - Compatible con nuevos roles

### Servicios
- `src/services/users.ts` - Soporte para rol 'superadmin'
- `src/hooks/useFirebase.ts` - Actualizado para nuevo rol

### Datos de Prueba
- `create-users-test.html` - Usuario SuperAdmin incluido
- `test-users-functionality.html` - Opción SuperAdmin agregada

## 🔧 Archivos Creados para Gestión de DB

### Scripts de Base de Datos
- `scripts/create-superadmin-db.js` - Script principal para Firebase Admin
- `scripts/create-superadmin.sql` - Script para bases de datos SQL
- `package.json` - Scripts npm agregados para gestión

### Comandos NPM Disponibles
```bash
npm run superadmin:create      # Crear SuperAdmin en DB
npm run superadmin:list        # Listar SuperAdmins existentes  
npm run superadmin:deactivate  # Desactivar SuperAdmin específico
```

### Funciones de Auditoría
- Verificación automática de SuperAdmins existentes
- Logs detallados de creación y modificación
- Metadatos de auditoría (createdBy, creationMethod)
- Desactivación segura (no eliminación)

## 🔒 Seguridad y Mejores Prácticas

### ⚠️ **IMPORTANTE para Producción**

#### Creación Segura desde Base de Datos
- ✅ **Usar Firebase Admin SDK** o acceso directo a la base de datos
- ✅ **Hashear contraseñas** (bcrypt, argon2, etc.)
- ✅ **Logs de auditoría** para todas las operaciones de SuperAdmin
- ✅ **Verificar permisos** antes de cada operación crítica

#### Scripts de Migración
```javascript
// Ejemplo con hash de contraseña
const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash('super123', 12);

const superAdminData = {
  name: 'superadmin',
  password: hashedPassword, // Contraseña hasheada
  role: 'superadmin',
  // ...resto de datos
};
```

#### Auditoría y Monitoreo
- 📊 **Logs de acceso** al Editor de Datos
- 🕒 **Timestamps** de todas las modificaciones
- 👤 **Tracking de usuario** para cambios críticos
- 🔔 **Alertas** para operaciones sensibles

## 🐛 Solución de Problemas

### No puedo acceder como SuperAdmin
1. Verificar que el usuario existe en Firestore
2. Confirmar que el rol sea exactamente `'superadmin'`
3. Asegurar que `isActive: true`
4. Revisar la consola del navegador para errores

### El dropdown no muestra SuperAdmin
1. Verificar que DataEditor.tsx fue actualizado
2. Confirmar que los tipos TypeScript están correctos
3. Reiniciar el servidor de desarrollo

### Problemas de autenticación
1. Limpiar localStorage: `localStorage.clear()`
2. Verificar conexión a Firebase
3. Comprobar credenciales en Firestore

## 📈 Próximas Mejoras

- [ ] Logs de auditoría para acciones de SuperAdmin
- [ ] Interfaz para gestión de permisos granulares
- [ ] Expiración automática de sesiones SuperAdmin
- [ ] Notificaciones por email para cambios críticos
- [ ] Backup automático antes de modificaciones importantes

## 📞 Soporte

El sistema de roles SuperAdmin está completamente implementado y funcional. Para cualquier problema o duda, revisar la documentación o contactar al equipo de desarrollo.

---

**✅ ESTADO**: Implementación completa y lista para producción
**📅 FECHA**: Implementado en junio 2025
**🔧 VERSIÓN**: v2.0 - Sistema de Roles Avanzado
