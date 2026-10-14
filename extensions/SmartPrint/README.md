# SmartPrint 0.1.1

Extensión Manifest V3 para Microsoft Edge. Reconoce comprobantes HTML de Contica, Gente Crystal y Tucán/BCR, crea una vista previa uniforme y abre el diálogo normal de impresión del navegador.

## Instalación

1. Abra `edge://extensions`.
2. Active **Modo de desarrollador**.
3. Pulse **Cargar descomprimida** y elija `extensions/SmartPrint`.
4. Deshabilite `EncabezadoImpresion` en las mismas páginas para evitar un encabezado doble.
5. Recargue las pestañas ya abiertas de Contica, Gente Crystal o BCR.

## Uso

Abra el comprobante y pulse **Imprimir con SmartPrint** desde el botón flotante o el popup. Revise advertencias y use **Imprimir** para abrir el diálogo de Edge. **Imprimir original** conserva el flujo nativo cuando el documento no se reconoce o cambie el HTML del proveedor.

La configuración permite papel de 48, 58 u 80 mm, escala, plantilla preferida y encabezado compatible. SmartPrint lee `encabezadoImpresionSettingsV1` sin modificarlo y guarda sus opciones en `smartPrintSettingsV1`.

## Privacidad y límites

- El contenido capturado se guarda solo en `chrome.storage.session`, en memoria, hasta recargar/deshabilitar la extensión o cerrar el navegador. No se sube a servidores.
- No lee cookies, contraseñas ni tokens.
- `Ctrl+P`, menús nativos y llamadas de la página a `window.print()` no pueden interceptarse universalmente.
- No hay impresión silenciosa ni selección de impresora. Eso requeriría un Native Messaging Host instalado aparte y no forma parte del MVP.
- `about:blank`, `srcdoc` y popups funcionan solo si fueron creados por un origen autorizado y Edge permite el marco relacionado.
- Los fixtures incluyen el HTML real suministrado de Gente Crystal y Tucán/BCR. De Contica se recibió el modal real, pero no el HTML interior autenticado de `impresion_factura.php`; su extractor cubre `srcdoc`, `contentDocument`, tablas sin `thead` y totales separados. Aún faltan validación visual en Edge y pruebas en papel físico de 58/80 mm.

## Pruebas

Desde la raíz del repositorio:

```powershell
npx vitest run tests/extensions/smartprint.test.ts
```
