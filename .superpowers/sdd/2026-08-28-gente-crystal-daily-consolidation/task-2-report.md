# Tarea 2: Escritura doble transaccional

## Implementación

- `FirestoreGenteCrystalSalesRepository.sync()` conserva sus dos escrituras existentes (venta individual y `lastSeenAt` del dispositivo) dentro de la misma transacción.
- Cuando `mergeGenteCrystalSale()` produce un registro, calcula `planGenteCrystalDailyMutation(existingSale, merged.record)` y aplica escrituras dirigidas con `merge: true` al mapa `sales` diario.
- Una venta que cambia de día elimina primero la entrada anterior con `FieldValue.delete()` y después inserta la entrada del nuevo día.
- Cuando no existe `merged.record` (`already_exists`), no se planifica ni se escribe una consolidación diaria.

## Pruebas y resultados

| Comando | Resultado |
| --- | --- |
| `npx vitest run tests/gente-crystal/firestore-sales.test.ts` (RED) | Falló como se esperaba: 4 de 6 pruebas fallaron por faltar las escrituras diarias; 2 pasaron para los casos sin escritura. |
| `npx vitest run tests/gente-crystal/firestore-sales.test.ts` (GREEN) | 1 archivo, 6 pruebas aprobadas. |
| `npx vitest run tests/gente-crystal/daily-sales.test.ts tests/gente-crystal/firestore-sales.test.ts` | 2 archivos, 13 pruebas aprobadas. |
| `npm test` | 7 archivos, 29 pruebas aprobadas. |
| `npm run lint` | Completó correctamente sin diagnósticos. |
| `git diff --check` | Completó correctamente, sin errores de espacios. |

## Evidencia RED/GREEN

La prueba RED registró solamente las rutas de venta individual y dispositivo para una venta activa nueva; faltaba `genteCrystalSales/DELIKOR PALMARES/daily/2026-08-23`. Los casos de reemplazo, movimiento y eliminación tampoco observaron escrituras diarias. Tras la implementación, las seis pruebas del repositorio pasan, cubriendo creación, reemplazo del mismo día, movimiento entre días, eliminación con centinela de Firestore, eliminación sin venta previa y `already_exists` sin escrituras.

## Archivos

- Modificado: `src/lib/gente-crystal/firestore-sales.ts`
- Creado: `tests/gente-crystal/firestore-sales.test.ts`
- Creado: `.superpowers/sdd/2026-08-28-gente-crystal-daily-consolidation/task-2-report.md`

## Auto-revisión

- La escritura diaria usa rutas por compañía y fecha derivada por el planificador aprobado de la Tarea 1.
- Todas las operaciones siguen dentro del callback de la transacción existente.
- Las eliminaciones usan `FieldValue.delete()` anidado bajo `sales[ticketId]` y todas las escrituras diarias usan `{ merge: true }`.
- La prueba usa una transacción falsa, sin conexión a Firebase, y verifica rutas, orden, contenido y opciones observables del repositorio.

## Preocupaciones

- Ninguna bloqueante. La ejecución contra Firebase real queda deliberadamente fuera del alcance; las pruebas validan el contrato transaccional con una falsificación local y el uso anidado de `FieldValue.delete()` está permitido por el SDK según el brief.
