# Auditoría de `extensions/EncabezadoImpresion`

Fecha: 2026-10-13

## Inventario verificado

| Componente actual | Decisión | Motivo |
| --- | --- | --- |
| `manifest.json` MV3 | Adaptar | Ya usa permisos concretos, `all_frames` implícito solo para el marco superior y `match_about_blank`; SmartPrint necesita más orígenes y todos los marcos relacionados. |
| `settings-core.js` | Reutilizar mediante adaptador | La clave real es `encabezadoImpresionSettingsV1`; contiene `schemaVersion`, `imageDataUrl`, `maxCharacters` y `lines` con fuente/tamaño. |
| `image-core.js` | Compatibilidad, sin copiar | SmartPrint consume la imagen validada ya guardada. El editor actual sigue siendo referencia para una futura edición de imagen dentro de SmartPrint. |
| `popup.*` | Adaptar | Su editor de imagen/líneas sigue siendo útil, pero SmartPrint requiere estado del documento, impresión, papel y modo de plantilla. |
| `print-core.js` | Adaptar parcialmente | Detección Tucán/Junta e inserción segura mediante `textContent`; su `HEADER_ID` evita encabezado doble. No extrae ni normaliza comprobantes. |
| `print-content.*` | Excluir del runtime SmartPrint | Si ambas extensiones están activas puede insertar un encabezado antes de que SmartPrint capture el DOM. SmartPrint lee configuración, pero renderiza su propio encabezado una sola vez. |
| `fontSettings` | Excluir del MVP | SmartPrint usa pila local configurable sin enumerar fuentes; reduce permisos. |

`match_origin_as_fallback` exige patrones `https://host/*`. Por eso el manifest declara solo los cuatro hosts autorizados con esa ruta y `content-core.js` vuelve a restringir Contica, BCR y Junta a sus rutas operativas antes de registrar listeners o leer el DOM.

## Dominios y comportamiento existentes

- BCR/Tucán: `https://www.bcrcorresponsal.bancobcr.com/BCRCorresponsalesExterno/*`.
- Junta: `https://puntosventa.jpsenlinea.go.cr/PS.ODB.ODBHandlers/Receipt/Generate*`.
- Detectores: `#tablaComprobantePago` y `.receipt-container` con `.header-top-row` y `.receipt-footer`.
- Eventos: `MutationObserver`, `DOMContentLoaded` y `beforeprint`.
- Persistencia: `chrome.storage.local`; no hay perfiles, sucursales, márgenes ni tamaño de papel.

## Migración y rollback

SmartPrint nunca escribe `encabezadoImpresionSettingsV1`. `settings-adapter.js` la lee, normaliza una copia y crea `smartPrintSettingsV1` solo cuando el usuario guarda opciones SmartPrint. La migración es idempotente porque conserva `schemaVersion: 1` y deriva el encabezado en lectura.

Rollback: deshabilitar SmartPrint y volver a habilitar EncabezadoImpresion. La clave y archivos originales quedan intactos. Para evitar doble encabezado o doble impresión, no deben ejecutarse ambas extensiones simultáneamente sobre Tucán/Junta.

## Fuente visual ausente

El repositorio no contiene `impresion.liquid`. `templates/impresion-original.liquid` documenta esta ausencia y no suplanta el original; `impresion-universal.liquid` implementa solo las medidas y jerarquía descritas por el plan. Paridad visual final requiere comparar contra el archivo real y papel físico.
