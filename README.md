# Price Master

**Price Master** es una aplicación web moderna para la gestión de horarios de empleados, control de turnos, exportación de reportes y administración de ubicaciones, diseñada para empresas que requieren un control visual, flexible y seguro de los horarios laborales.

---

## 🚀 Características principales

- **Control de horarios por ubicación**: Visualiza y edita los turnos de cada empleado por día y ubicación.
- **Gestión de turnos**: Asigna turnos Nocturno (N), Diurno (D), Libre (L) y No disponible (N/A) con validaciones inteligentes.
- **Visualización intuitiva**: Tabla de horarios con colores y leyendas, resaltando el día actual y mostrando tooltips informativos.
- **Exportación de horarios**: Descarga la quincena o el mes como imagen PNG, con opción de compartir mediante QR y descarga móvil.
- **Integración con Firebase**: Persistencia de datos en Firestore y exportaciones seguras en Firebase Storage.
- **Accesibilidad y experiencia de usuario**: Interfaz responsiva, accesible y con notificaciones en tiempo real.
- **Soporte para ubicaciones especiales (DELIFOOD)**: Registro y exportación de horas trabajadas en vez de turnos.
- **Leyenda de colores**: Explicación visual de cada estado de turno y horas.
- **Autenticación y roles**: Acceso seguro, con roles de usuario, administrador y superadministrador.
- **Borrado automático de exportaciones**: Los archivos exportados se eliminan automáticamente tras 1 minuto para mayor seguridad.

---

## 🖥️ Estructura del proyecto

```
Price-Master/
├── public/                  # Archivos estáticos e íconos
├── scripts/                 # Scripts de migración y utilidades
├── src/
│   ├── app/                 # Páginas principales y rutas
│   ├── components/          # Componentes reutilizables (incluye ControlHorario)
│   ├── config/              # Configuración de Firebase y otros servicios
│   ├── data/                # Datos estáticos (ubicaciones, sorteos)
│   ├── edit/                # Componentes de edición de datos
│   ├── firebase/            # Lógica de integración con Firebase
│   ├── hooks/               # Custom hooks (useAuth, useScanning, etc.)
│   ├── md/                  # Documentación interna y guías
│   ├── services/            # Servicios de negocio y acceso a datos
│   ├── types/               # Tipos y modelos TypeScript
│   └── utils/               # Utilidades generales
├── package.json             # Dependencias y scripts
├── tailwind.config.js       # Configuración de Tailwind CSS
└── ...
```

---

## 📋 Guía rápida de uso

### 1. **Inicio de sesión**
- Accede con tu usuario y contraseña. El acceso a la funcionalidad depende de tu rol.

### 2. **Selección de ubicación**
- Elige la ubicación para ver y editar los horarios de los empleados asignados.

### 3. **Visualización y edición de horarios**
- La tabla muestra los empleados y los días del período seleccionado (quincena o mes completo).
- Asigna turnos usando los selectores:
  - **N**: Nocturno (azul)
  - **D**: Diurno (amarillo)
  - **L**: Libre (magenta)
  - **N/A**: No disponible (rosa oscuro)
  - **Vacío**: Sin asignar
- El día actual se resalta en verde con un tooltip informativo.
- Para ubicaciones DELIFOOD, registra horas trabajadas en vez de turnos.

### 4. **Exportación de horarios/quincena**
- Solo los SuperAdmin pueden exportar la tabla como imagen PNG.
- Al exportar, puedes descargar la imagen directamente o escanear un QR para descargarla desde otro dispositivo.
- El enlace de descarga y el QR expiran automáticamente tras 1 minuto.

### 5. **Leyenda de colores**
- Consulta la leyenda para entender el significado de cada color y estado en la tabla.

### 6. **Notificaciones y seguridad**
- Recibe notificaciones en tiempo real sobre cambios, errores o acciones exitosas.
- Los archivos exportados se eliminan automáticamente del servidor tras 1 minuto.

---

## 🛠️ Instalación y configuración

1. **Clona el repositorio:**
   ```bash
   git clone <url-del-repo>
   cd Price-Master
   ```
2. **Instala dependencias:**
   ```bash
   npm install
   ```
3. **Configura Firebase:**
   - Edita `src/config/firebase.ts` con tus credenciales de Firebase.
   - Asegúrate de tener reglas de seguridad adecuadas en Firestore y Storage.
4. **Inicia la app:**
   ```bash
   npm run dev
   ```
5. **Accede desde tu navegador:**
   - Por defecto en `http://localhost:3000`

---

## 🔒 Roles y permisos

- **Usuario**: Visualiza horarios y turnos asignados.
- **Administrador**: Puede editar horarios y turnos de su ubicación.
- **SuperAdmin**: Acceso total, puede exportar horarios, cambiar ubicaciones y gestionar usuarios.

---

## 🧩 Componentes clave

- **ControlHorario**: Componente principal para la gestión y visualización de horarios.
- **LoginModal**: Modal de autenticación.
- **DelifoodHoursModal**: Registro de horas para ubicaciones especiales.
- **Legend**: Leyenda de colores y estados.
- **Exportación y QR**: Funcionalidad de exportación y generación de QR.

---

## 📦 Dependencias principales

- **React**
- **Next.js**
- **Tailwind CSS**
- **Firebase** (Firestore y Storage)
- **html2canvas** (para exportar tablas como imagen)
- **qrcode** (para generación de QR)

---

## 📚 Documentación adicional

- Consulta la carpeta `src/md/` para guías técnicas, fixes y documentación interna.
- Ejemplos de uso y scripts en la carpeta `scripts/`.

---

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Por favor, abre un issue o pull request para sugerencias, mejoras o reportes de bugs.

---

## 📝 Licencia

Este proyecto es privado y para uso interno. Contacta al administrador para más información sobre permisos y licencias.

---

## 👨‍💻 Autor

Desarrollado y mantenido por Anders Flores y colaboradores.

---

**¡Gracias por usar Price Master!**
