TIMEMASTER HERRAMIENTAS 1.0.2
================================

Esta extensión reúne CambioTab, división de efectivo, cierre automático del
modal de impresión de Contica, SumaTiempos y MoverEnter en una sola instalación.
Las tres extensiones originales permanecen como respaldo, pero deben estar
desactivadas mientras se usa esta versión para evitar acciones duplicadas.

INSTALACIÓN EN EDGE O CHROME
----------------------------
1. Extraiga TimeMasterHerramientas.zip, si va a instalar desde el ZIP.
2. Abra edge://extensions o chrome://extensions.
3. Active el modo de desarrollador.
4. Pulse "Cargar descomprimida" y seleccione la carpeta TimeMasterHerramientas.
5. Desactive CambioTab, SumaTiempos y moverenter antiguas.
6. Recargue las pestañas abiertas de Contica y Gente Crystal.

CONTROLES Y VALORES INICIALES
-----------------------------
- CambioTab en Contica: activado.
- Cierre del modal de impresión en Contica: desactivado.
- División de efectivo en Contica: desactivada.
- SumaTiempos en Gente Crystal: activado.
- Impresión automática en Gente Crystal: desactivada.

Pulse el icono de la extensión para cambiar cada función por separado. Los
cambios se aplican inmediatamente a las páginas compatibles ya abiertas.

CAMBIOTAB EN CONTICA
--------------------
Sitio: https://contica.app/app/modules/punto_de_venta/*

- Ctrl+Alt+Flecha derecha: pestaña disponible siguiente.
- Ctrl+Alt+Flecha izquierda: pestaña disponible anterior.
- Ctrl+Alt+1 a Ctrl+Alt+7: abrir directamente esa pestaña.
- También acepta los números del teclado numérico.

CIERRE DEL MODAL DE IMPRESIÓN EN CONTICA
----------------------------------------
Sitio: https://contica.app/app/modules/punto_de_venta/*

Al activarlo, la extensión detecta cada apertura de #printInvoice, espera cinco
segundos y pulsa una sola vez el botón X / ESC del mismo modal. La espera se
cancela si el modal se cierra antes o si la herramienta se desactiva.

DIVISIÓN DE EFECTIVO EN CONTICA
-------------------------------
Sitio: https://contica.app/app/modules/punto_de_venta/*

Al activarla, permite escribir una división directamente en los campos de
efectivo en dólares o colones. Acepta divisores del 2 al 5; por ejemplo,
7500/2 se reemplaza por 3750 en el mismo campo. Los resultados no exactos se
redondean a dos decimales. Los demás campos de pago no se modifican.

SUMATIEMPOS EN GENTE CRYSTAL
----------------------------
Sitio: https://gentecrystal.net/controllers/sales/SalesController.php*

El panel muestra:

  total general = total del tiquete
                + cantidad de números × (monto principal + monto compañero)

El monto compañero solo se suma cuando su control está visible y habilitado.

IMPRESIÓN AUTOMÁTICA EN GENTE CRYSTAL
-------------------------------------
Al activarla, la extensión pulsa una sola vez el botón de impresión web por
cada apertura del diálogo de venta completada. Esto abre o envía la impresión
según la configuración del navegador; no equivale por sí solo a aceptar el
diálogo nativo de impresión.

Para impresión totalmente desatendida, Edge o Chrome debe iniciarse con la
opción --kiosk-printing y la impresora correcta debe estar configurada. Use esa
opción únicamente en un equipo controlado destinado a caja.

ACTUALIZACIONES
---------------
Después de reemplazar archivos o recargar la extensión desde la página de
extensiones, recargue también las pestañas de Contica y Gente Crystal.
