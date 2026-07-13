# CashCounter: persistencia y verificación

## Alcance

- Persistir tabs y datos de caja en IndexedDB.
- Migrar una vez los datos existentes desde `localStorage.cashCounters`.
- Restaurar por tab los inputs Apertura de caja, Venta actual y Agregar venta.
- Mantener SINPE como modal global y sin persistencia.
- No agregar backend ni sincronización entre dispositivos.

## Arquitectura

- Crear `cashCounterDb.ts` como servicio IndexedDB dedicado.
- Usar un store único con snapshot `{ counters, activeTab, lastSaved }`.
- `useCashCounter` hidrata el estado antes de habilitar autosave.
- IndexedDB será la fuente de verdad después de la migración.
- Centralizar escrituras con debounce para evitar carreras y duplicados.

## Componentes

- `CashCounter`: restaurar Apertura de caja, Venta actual y Agregar venta.
- Agregar venta suma el monto ingresado a `ventaActual` del tab activo.
- Mantener cálculo y mensaje de sobrante/faltante.
- `RightPanel`: limpiar, exportar e importar conservan apertura y venta.
- `SinpeModal`: permanece global desde `CashCounterTabs`; su estado vive solo en memoria.

## Flujo de datos

1. Abrir IndexedDB y leer snapshot.
2. Si no existe, leer y normalizar `localStorage.cashCounters`.
3. Guardar migración en IndexedDB; retirar clave legacy solo tras éxito.
4. Si ambas fuentes están vacías, crear `Contador 1`.
5. Marcar hidratación completa y habilitar autosave.
6. Persistir tabs, orden, tab activo y campos de cada tab.
7. Reiniciar SINPE al recargar la página.

## Errores

- Fallo de lectura: conservar estado visible y mostrar error.
- Fallo de escritura: indicar guardado fallido; no limpiar estado.
- Datos corruptos: normalizar campos válidos y aplicar defaults.
- Limpiar: borrar snapshot IndexedDB y crear contador inicial.
- Nunca ejecutar autosave inicial antes de terminar hidratación.

## Pruebas

- Carga desde IndexedDB.
- Migración desde formatos legacy de `localStorage`.
- Autosave solamente después de hidratar.
- Crear, editar, reordenar, eliminar, importar y limpiar tabs.
- Apertura, venta y agregar venta aislados por tab.
- Recarga conserva tabs y valores.
- `localStorage.clear()` no afecta tabs.
- SINPE no persiste tras recarga.
- Fallos IndexedDB no destruyen estado visible.

## Limitación

IndexedDB sobrevive limpieza de `localStorage` y caché HTTP. El navegador puede borrarlo si el usuario elimina todos los datos del sitio.
