# Fondo General: sincronizacion remota y persistencia transaccional del ledger

Fecha: 2026-09-23

## Contexto

El ledger agregado de `MovimientosFondos/movements_<EMPRESA>` se calcula hoy a
partir de `storageSnapshotRef.current` y se guarda junto con el movimiento en un
batch. El batch evita escrituras parciales, pero no evita que una pestaña o un
dispositivo atrasado sobrescriba un saldo mas reciente.

El incidente de DELIKOR SINAI del 22 de septiembre de 2026 demostro este caso:
un cliente que conservaba un saldo de CRC 103000 escribio dos movimientos con
efecto neto cero y devolvio el ledger de CRC 138000 a CRC 103000. Los movimientos
posteriores operaron correctamente sobre ese saldo ya desviado y el cierre
termino reportando "Sin diferencias" contra un ledger incorrecto.

## Objetivos

- Impedir que una escritura basada en estado local atrasado sobrescriba el
  saldo autoritativo de Firestore.
- Refrescar el saldo de Fondo General entre dispositivos mientras la pantalla
  se encuentra activa.
- Mantener sincronizado el movimiento que origino el cambio sin escuchar toda
  la coleccion de movimientos.
- Detectar una divergencia entre apertura, movimientos y ledger antes de
  guardar un cierre como "Sin diferencias".
- Preservar el contrato contable actual: para egresos con `amountPayment`, el
  impacto real es `amountPayment`; en los demas casos es `amountEgreso`.
- Mantener compatibilidad con los documentos y movimientos existentes.

## Fuera de alcance

- Reescribir historicamente cierres o movimientos de produccion.
- Cambiar las reglas de redondeo, notas de credito o pagos FCR/FCO.
- Escuchar en tiempo real toda la subcoleccion `movements`.
- Migrar inmediatamente `balancesByAccount` de arreglo a subdocumentos.

## Diseno propuesto

### 1. Mutaciones transaccionales

`MovimientosFondosService` expondra una operacion transaccional que reciba una
creacion, edicion o eliminacion y ejecute en una sola transaccion:

1. Leer el documento autoritativo del ledger.
2. Para ediciones y eliminaciones, leer el movimiento original dentro de la
   misma transaccion.
3. Calcular el delta mediante la misma regla usada por
   `resolveEffectiveEgresoAmount`.
4. Actualizar solamente el balance logico de la cuenta y moneda afectadas en la
   copia mas reciente del ledger.
5. Escribir o eliminar el movimiento.
6. Escribir el ledger con una revision monotona y la descripcion del ultimo
   cambio.
7. Ejecutar las escrituras adicionales de Facturas/NC dentro de la misma
   transaccion cuando el flujo actual ya exige atomicidad.

Firestore reintentara la transaccion si otro cliente modifica el ledger entre
la lectura y el commit. El saldo no se calculara desde
`storageSnapshotRef.current`; esa referencia quedara limitada a presentacion y
cache local.

Las aperturas conservaran su semantica especial: una apertura nueva establece
el saldo contado, y una edicion aplicara la diferencia entre el valor anterior
y el nuevo valor. El movimiento original de una edicion o eliminacion siempre
provendra de Firestore, no del cache del navegador.

La persistencia automatica de configuracion de cuenta (`initialBalance` y
`enabled`) que hoy guarda el documento completo desde
`storageSnapshotRef.current` sera eliminada. La pantalla actual no contiene
controles de usuario que modifiquen esos valores: solo se hidratan y se
reinician al cambiar de contexto. Aplicar un snapshot remoto a la UI no debe
disparar ninguna escritura de vuelta a Firestore. Si en el futuro se agrega un
editor de configuracion, debera usar una operacion transaccional explicita.

Las rutas auxiliares que hoy guardan el documento completo para modificar
`lockedUntil` tambien leeran el ledger dentro de una transaccion y cambiaran
solo ese campo en la copia autoritativa. La limpieza unica del arreglo legacy
`operations.movements` usara una actualizacion puntual del campo, sin volver a
escribir balances.

### 2. Metadatos de revision

El estado del ledger aceptara campos opcionales, compatibles con documentos
anteriores:

```ts
type LedgerMovementChange = {
  kind: "movement";
  revision: number;
  movementId: string;
  operation: "create" | "edit" | "delete";
  accountId: MovementAccountKey;
  currency: MovementCurrencyKey;
  updatedAt: string;
  clientMutationId?: string;
};

type LedgerLastChange = LedgerMovementChange;

type MovementStorageState = {
  // campos existentes
  revision?: number;
  lastChange?: LedgerLastChange;
};
```

Cada transaccion incrementara `revision`. Los documentos sin revision se
interpretaran como revision cero.

### 3. Listener remoto del ledger

Se agregara `MovimientosFondosService.subscribeToLedger`. El listener observara
unicamente el documento `MovimientosFondos/movements_<EMPRESA>`.

El hook de hidratacion:

- se suscribira cuando la empresa este resuelta, el usuario tenga acceso y la
  pestaña este visible;
- cancelara la suscripcion al ocultar la pestaña, cambiar de empresa o desmontar
  el componente;
- ignorara snapshots locales con `metadata.hasPendingWrites`;
- no marcara como sincronizado ni aplicara como autoritativo un snapshot con
  `metadata.fromCache`;
- aplicara el estado confirmado a `storageSnapshotRef.current` y
  `ledgerSnapshot`;
- conservara la revision aplicada mas reciente por empresa.

No se instalara un listener sobre toda la subcoleccion de movimientos.

### 4. Sincronizacion selectiva de movimientos

Al recibir una revision remota:

- Si `revision === lastAppliedRevision + 1` y la cuenta coincide con la cuenta
  abierta, se leera solo `lastChange.movementId` para create/edit, o se retirara
  ese ID del cache para delete.
- Si el cambio corresponde a otra cuenta, solo se actualizara el ledger.
- Si la revision salta mas de una unidad, el cliente asumira que perdio cambios
  mientras estuvo desconectado y recargara una vez el rango activo de
  movimientos.
- Los eventos confirmados de una mutacion local ya reflejada en cache no
  duplicaran el movimiento.

Esto limita el costo normal a una lectura del ledger por actualizacion y, en
otro dispositivo que este viendo la misma cuenta, una lectura adicional del
movimiento afectado.

### 5. Validacion de integridad antes del cierre

Antes de guardar un cierre de Fondo General se realizara una lectura fresca del
ledger y una conciliacion desde la apertura aplicable:

```text
saldo esperado = saldo de apertura
               + ingresos posteriores
               - egresos efectivos posteriores
```

Si el saldo esperado no coincide con el ledger autoritativo:

- no se guardara el cierre;
- no se generara un movimiento informativo de "Sin diferencias";
- se mostrara la desviacion por moneda;
- se ofrecera refrescar la pantalla, sin corregir datos automaticamente.

La comprobacion se ejecutara solo al cerrar, no en cada render. Los movimientos
se consultaran desde la apertura hasta el instante del cierre y se usara
`amountPayment` como salida efectiva cuando corresponda.

La comprobacion usara lecturas forzadas al servidor. Leera el ledger antes y
despues de paginar los movimientos; si `revision` o `updatedAt` cambian durante
la consulta, repetira el intento de forma acotada. Si no obtiene una vista
estable o Firestore no esta disponible, bloqueara el cierre.

El cierre usara los saldos autoritativos devueltos por esa comprobacion, no una
copia React potencialmente atrasada. Al guardar, la transaccion ya existente de
`DailyClosingsService` leera el ledger y exigira la misma `revision` y
`updatedAt` validadas. Si hubo un movimiento entre la conciliacion y el commit,
el cierre abortara en vez de guardar una comparacion obsoleta.

### 6. Estado de sincronizacion y errores

El hook expondra uno de estos estados:

- `connecting`
- `synced`
- `offline`
- `error`

Una perdida temporal del listener no borrara datos locales, pero el cierre se
bloqueara si no se puede obtener una lectura autoritativa. Las mutaciones
transaccionales mostraran error si Firestore no confirma el commit; no se
mostrara "guardado correctamente" por una escritura solo local.

## Cambios de codigo previstos

- `src/services/movimientos-fondos.ts`
  - tipos de revision;
  - referencia publica al ledger y movimientos;
  - suscripcion a un ledger;
  - commit transaccional.
- `src/app/fondogeneral/utils/fondo/persistence.ts`
  - reemplazar el calculo desde el snapshot y el batch por la nueva transaccion;
  - actualizar caches solamente despues del resultado confirmado.
- `src/app/fondogeneral/utils/fondo/mutations.ts`
  - actualizar `lockedUntil` mediante la copia autoritativa del ledger.
- `src/app/fondogeneral/hooks/fondo/useV2MovementsHydration.ts`
  - ciclo de vida del listener y aplicacion de revisiones remotas.
- `src/app/fondogeneral/utils/closing/dailyClosing.ts`
  - validacion de integridad inmediatamente antes de persistir el cierre.
- `src/services/daily-closings.ts`
  - precondicion transaccional de revision del ledger al guardar el cierre.
- `src/app/fondogeneral/components/layout/FondoSection.tsx`
  - integrar estado de sincronizacion y mensajes de bloqueo;
  - eliminar la persistencia automatica ciega de configuracion y comprobar que
    la hidratacion remota no genera escrituras reflejas.

## Pruebas

Se agregaran pruebas para:

1. Dos clientes leen el mismo saldo; el segundo commit ocurre sobre la version
   autoritativa y no sobre su copia atrasada.
2. Dos creaciones concurrentes conservan ambos deltas.
3. Una edicion usa el movimiento original de Firestore.
4. Una eliminacion revierte exactamente el impacto efectivo almacenado.
5. `amountPayment` sigue prevaleciendo sobre `amountEgreso`.
6. Una apertura establece el saldo contado sin duplicar deltas.
7. El listener actualiza `ledgerSnapshot` en otro cliente.
8. Una revision consecutiva obtiene solo el movimiento afectado.
9. Un salto de revision recarga el rango activo una sola vez.
10. Un cierre se bloquea cuando la cadena contable y el ledger divergen.
11. Un cierre sano conserva el comportamiento actual.
12. Un snapshot remoto no provoca un bucle de escritura de configuracion.
13. Actualizar `lockedUntil` o limpiar movimientos legacy no sobrescribe un
    balance mas reciente.
14. El cierre usa el saldo autoritativo y aborta si la revision cambia antes
    del commit.

La verificacion final incluira pruebas enfocadas, suite completa relevante,
typecheck, lint aplicable, build y `git diff --check`.

## Despliegue y compatibilidad

- No se requiere migracion previa: `revision` y `lastChange` son opcionales.
- La primera mutacion con el codigo nuevo inicializara la revision.
- El listener puede desplegarse junto con las transacciones; clientes antiguos
  seguiran leyendo los campos existentes.
- Mientras existan clientes antiguos, todavia podrian realizar una escritura
  ciega. Por eso, despues del despliegue se debe forzar la actualizacion de la
  aplicacion mediante el mecanismo de version/mantenimiento existente.
- No se efectuara ninguna reparacion de produccion como parte del despliegue de
  codigo. La correccion del incidente de CRC 35000 requiere una decision
  contable y un procedimiento separado con respaldo.

## Criterios de aceptacion

- Un cliente con un saldo local atrasado no puede reducir ni reemplazar el
  saldo autoritativo al crear, editar o eliminar un movimiento.
- Dos dispositivos abiertos en la misma empresa reciben el saldo confirmado
  sin recargar la pagina.
- La pantalla no abre un listener para toda la coleccion de movimientos.
- El cierre no puede registrar "Sin diferencias" cuando el ledger agregado y
  la cadena desde la apertura difieren.
- Los movimientos existentes y los documentos sin revision siguen cargando.
- El costo normal del listener queda limitado al documento del ledger y a una
  lectura selectiva del movimiento remoto cuando corresponda.
