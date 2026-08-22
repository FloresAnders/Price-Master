TimeMaster - Gente Crystal v1.9.1

INSTALACIÓN / ACTUALIZACIÓN

1. Abre chrome://extensions o edge://extensions.
2. Activa Modo de desarrollador.
3. Si todavía no está instalada, pulsa "Cargar descomprimida" y selecciona
   esta carpeta `extensions`.
4. Si ya está instalada, pulsa el botón Recargar de la extensión TimeMaster -
   Gente Crystal.
5. Abre o recarga https://gentecrystal.net/entradas.php.
6. Abre el popup de TimeMaster.

CONFIGURAR LA SINCRONIZACIÓN

Hasta que exista la pantalla administrativa de integraciones, genera un token
desde la raíz del proyecto con una acción explícita del operador:

  npm run provision:gente-crystal-device -- <companyId> <deviceId> "<deviceName>"

Ejemplo:

  npm run provision:gente-crystal-device -- empresa-palmares palmares-01 "PALMARES-PC-01"

El comando escribe únicamente el hash SHA-256 en Firestore y muestra el token
tm_gc_ una sola vez. Copia ese token en el popup de la extensión. La URL normal
es https://www.timemaster.es. Para desarrollo también se aceptan
http://localhost:3000 y http://127.0.0.1:3000.

No pongas el token en archivos del proyecto ni lo compartas entre
computadoras. Cada dispositivo debe tener su propia credencial.

ESTADOS DE LA COLA

- Pendiente: la venta está guardada localmente y espera envío.
- Enviando: hay una solicitud en curso.
- Sincronizado: TimeMaster confirmó el registro.
- Con error: el popup conserva el detalle de estado y la extensión reintenta
  automáticamente los errores temporales. Los errores de token o permisos se
  reintentan después de guardar nuevamente la configuración.

La extensión guarda primero cada evento en chrome.storage.local. Una alarma de
Manifest V3 despierta el service worker cada minuto para reintentar aunque la
pestaña de Gente Crystal no cambie.

El botón "Limpiar" elimina solamente la lista visual local de ventas. No borra
la cola de entrega ni los registros/tombstones ya almacenados en Firestore.

DIAGNÓSTICO

El popup muestra:

- versión y conexión del detector;
- sorteo seleccionado;
- tiquetes visibles y borrados ignorados;
- ventas locales guardadas;
- pendientes, enviando, sincronizados y errores de la cola.

CAMBIOS DE LA VERSIÓN 1.9.1

- Detecta el número exacto del tiquete que aparece en `print_pagos.php`
  después de pulsar "Ingresar venta".
- Conserva temporalmente esa confirmación al navegar y clasifica únicamente
  ese tiquete como venta directa (`local_button`) al regresar a `entradas.php`.
- Comparte una espera máxima de 15 segundos entre pestañas para no guardar el
  tiquete como indirecto mientras carga la confirmación impresa.
- Mantiene como indirectos los demás tiquetes detectados desde otros
  dispositivos o medios.
- Las ventas que ya estaban almacenadas antes de instalar esta versión no se
  reclasifican automáticamente.

CAMBIOS DE LA VERSIÓN 1.6.0

- Solicita una contraseña al pulsar "Guardar conexión".
- No modifica la configuración si se cancela o la contraseña es incorrecta.
- La contraseña se solicita vacía y nunca se almacena.

CAMBIOS DE LA VERSIÓN 1.5.0

- Clasifica como directa solamente la venta que aparece después de pulsar
  "Ingresar venta" en esta computadora.
- Guarda como indirectas las ventas detectadas desde otro dispositivo o medio.
- Envía el origen de captura a TimeMaster para conservar la clasificación.

CAMBIOS DE LA VERSIÓN 1.4.2

- Conserva un timestamp estable cuando Gente Crystal no muestra una fecha y
  evita reenviar el mismo tiquete en cada escaneo.
- Evita escrituras de actividad para ventas que TimeMaster ya tenía
  sincronizadas sin cambios.

CAMBIOS DE LA VERSIÓN 1.4.1

- Detiene silenciosamente el detector anterior cuando Chrome invalida su
  contexto después de recargar o actualizar la extensión.
- Evita que `Extension context invalidated` quede acumulado como un problema de
  la extensión mientras la pestaña espera su recarga.

CAMBIOS DE LA VERSIÓN 1.4.0

- Añade service worker y API propia de TimeMaster.
- Autentica cada computadora con un token dedicado.
- Evita duplicados por empresa + número de tiquete.
- Sincroniza anulaciones como `status: deleted` sin borrar la auditoría.
- Añade cola local durable, control de revisiones y reintentos automáticos.

CAMBIOS DE LA VERSIÓN 1.3.0

- Corrige la detección de tiquetes borrados aunque la palabra "Borrado" no esté
  visible.
- Reconoce el estado rojo/rosado de la fila, además de texto, clases y
  atributos de borrado.
- Si un tiquete ya guardado aparece después como borrado, se elimina de la
  lista visual de ventas.
