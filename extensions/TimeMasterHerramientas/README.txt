TIMEMASTER HERRAMIENTAS 1.2.0
================================

Esta extensión reúne CambioTab, división de efectivo, movimiento entre medios
de pago, cierre automático del modal de impresión de Contica, SumaTiempos,
ingreso de venta con Ctrl+Enter y MoverEnter en una sola instalación. Las tres extensiones originales permanecen
como respaldo, pero deben estar desactivadas mientras se usa esta versión para
evitar acciones duplicadas.

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
- Movimiento entre medios de pago en Contica: desactivado.
- SumaTiempos en Gente Crystal: activado.
- Ingresar venta con Ctrl+Enter en Gente Crystal: desactivado.
- Impresión automática en Gente Crystal: desactivada.
- Resaltado de líneas del tiquete en Gente Crystal: desactivado.
- Formato completo de impresión BCR en about:blank: desactivado.

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

Al activarlo, puede definir desde el popup un tiempo entero de 1 segundo en
adelante; el valor inicial es 5 segundos. La extensión detecta cada apertura de
#printInvoice, espera el tiempo configurado y pulsa una sola vez el botón X / ESC
del mismo modal. La espera se cancela si el modal se cierra antes o si la
herramienta se desactiva.

Mientras transcurre la espera, muestra un recordatorio lateral con el mensaje
inicial "Recuerde consultar si desea la factura impresa". El texto puede
cambiarse desde el popup de la extensión y se guarda para las siguientes ventas.

DIVISIÓN DE EFECTIVO EN CONTICA
-------------------------------
Sitio: https://contica.app/app/modules/punto_de_venta/*

Al activarla, permite escribir una división directamente en los campos de
efectivo en dólares o colones. Acepta divisores del 2 al 5; por ejemplo,
7500/2 se reemplaza por 3750 en el mismo campo. Los resultados no exactos se
redondean a dos decimales. Los demás campos de pago no se modifican.

MOVER MONTO ENTRE MEDIOS DE PAGO EN CONTICA
--------------------------------------------
Sitio: https://contica.app/app/modules/punto_de_venta/*

Al activarlo, pulse E, T o S dentro de un campo de pago para mover su monto a
efectivo, tarjeta o SINPE, respectivamente, conservando la moneda. El destino
reemplaza cualquier monto anterior. Si el origen está vacío, solamente mueve
el cursor al campo de destino.

SUMATIEMPOS EN GENTE CRYSTAL
----------------------------
Sitio: https://gentecrystal.net/controllers/sales/SalesController.php*

El panel muestra:

  total general = total del tiquete
                + cantidad de números × (monto principal + monto compañero)

El monto compañero solo se suma cuando su control está visible y habilitado.

INGRESAR VENTA CON CTRL+ENTER EN GENTE CRYSTAL
----------------------------------------------
Sitio: https://gentecrystal.net/controllers/sales/SalesController.php*

Al activarlo, Ctrl+Enter o Ctrl+Enter del teclado numérico pulsa una sola vez
el botón #btn-submit-sale. El atajo no actúa cuando el botón no existe, está
oculto o deshabilitado.

IMPRESIÓN AUTOMÁTICA EN GENTE CRYSTAL
-------------------------------------
Al activarla, la extensión pulsa una sola vez el botón de impresión web por
cada apertura del diálogo de venta completada. Esto abre o envía la impresión
según la configuración del navegador; no equivale por sí solo a aceptar el
diálogo nativo de impresión.

Para impresión totalmente desatendida, Edge o Chrome debe iniciarse con la
opción --kiosk-printing y la impresora correcta debe estar configurada. Use esa
opción únicamente en un equipo controlado destinado a caja.

RESALTAR LÍNEAS DEL TIQUETE EN GENTE CRYSTAL
--------------------------------------------
Sitio: https://gentecrystal.net/print_pagos.php*

Al pulsar el interruptor del popup principal se abre un configurador separado.
Este muestra las últimas líneas detectadas en el tiquete y permite elegirlas
individualmente, seleccionar todas o no seleccionar ninguna. El formato común
de tamaño (10 a 72 px), grosor (600 a 900) y tipo de letra se aplica solamente
a las líneas marcadas. Los valores iniciales son 22 px, grosor 700 y el tipo de
letra original.

La activación, la selección lógica de líneas y la fuente cambian únicamente al
pulsar Guardar configuración. Restablecer valores modifica el borrador, pero no
escribe en storage hasta guardar. La identidad lógica se conserva cuando cambia
el código, la fecha u otro valor del tiquete. Las líneas nuevas aparecen sin
marcar una vez inicializada la selección.

FORMATO COMPLETO DE IMPRESIÓN BCR
---------------------------------
Sitio iniciador: https://www.bcrcorresponsal.bancobcr.com/*

Al pulsar el interruptor se abre el mismo tipo de configurador para el
comprobante generado dentro de about:blank. Muestra sus últimas líneas
detectadas y permite aplicar una fuente común solo a las líneas marcadas. Los
valores iniciales son 21 px, grosor 900 y Verdana. Tamaño permitido: 10 a 72 px.
La activación, selección y fuente se persisten juntas al pulsar Guardar
configuración. Restablecer valores cambia únicamente el borrador hasta guardar.

El catálogo lógico de líneas se conserva permanentemente y acumula campos de
los distintos tipos de comprobante. Los valores variables no crean duplicados:
por ejemplo, CONVENIO: LIBERTY MOVIL y CONVENIO: RECARGA LIBERTY usan la misma
identidad CONVENIO. Solo se guardan permanentemente el identificador y la
etiqueta lógica; nombres, teléfonos, referencias, montos y el texto actual se
mantienen únicamente durante la sesión del navegador. La impresión espera a que
storage cargue y el formato quede aplicado antes de abrir el diálogo nativo; si
la página reemplaza su DOM, las líneas se detectan y formatean de nuevo. También
reconoce las variantes de reimpresión BCR tablaConcentrador y reciboImpresion.

ACTUALIZACIONES
---------------
Después de reemplazar archivos o recargar la extensión desde la página de
extensiones, recargue también las pestañas de Contica, Gente Crystal y BCR.
