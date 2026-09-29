LeerRegistro 1.0.4
===================

Objetivo
--------
Carga en el cierre diario de Fondo General estos cuatro valores:

- R08: Total vendido de la fila exacta TUCAN en el cierre de Contica.
- T11: Total vendido de la fila exacta TIEMPOS en el cierre de Contica.
- Tucan: Total General de Pagos de un Cajero en BCR Corresponsales.
- Tiempos: Total vendido del reporte #tiempostucan en TimeMaster.

Instalacion
-----------
1. Abra chrome://extensions o edge://extensions.
2. Active el modo de desarrollador.
3. Elija "Cargar descomprimida".
4. Seleccione la carpeta extensions/LeerRegistro.

Uso
---
1. Mantenga abierta y autenticada una pestaña de BCR Corresponsales.
2. Mantenga abierta y autenticada la pagina de cierres de Contica:
   https://contica.app/app/modules/cierre/index.php?tt=adm
3. En TimeMaster abra #fondogeneral y el modal "Cierre diario del fondo".
4. En "Verificacion Contica / Tucan / Tiempos", pulse "Cargar datos".

La extension abre #tiempostucan en segundo plano para actualizar su reporte.
Esa pestaña solo se cierra automaticamente cuando fue creada por la extension.

Reglas
------
- Desde las 00:00 hasta antes de 01:00 se consulta el dia anterior.
- Contica usa el cierre mas reciente de la fecha operativa, sin exigir una
  antiguedad minima. Un cierre de las 16:00 puede cargarse inmediatamente.
- Los cierres de medianoche que Contica asigna al dia anterior conservan esa
  fecha operativa.
- La carga es completa: si una fuente falla, no se modifican los cuatro campos.
- La extension no guarda claves, usuarios, contrasenas ni datos de sesion.

Si la pagina cambia su estructura, LeerRegistro mostrara el origen que no pudo
leer y conservara intactos los valores que ya estaban en el modal.
