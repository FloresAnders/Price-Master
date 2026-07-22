# Deudas internas - diseño

## Objetivo

Crear una sección `Deudas internas` para administrar deudas entre empresas,
admins y colaboradores del mismo `ownerId`, sin mezclar estos registros con
`MovimientosFondos`.

Ejemplos:

- `Delikor Palmares` debe `534000` a `Delikor San Vito`.
- `Delikor Palmares` debe `1000000` a `Diana Aguilar`.

## Alcance

- Agregar permiso nuevo `deudasInternas`.
- Agregar navegación `#deudasinternas` junto a `Agregar proveedor`, `Fondo General`,
  `FC/NC` y `Reportes SINPE`.
- Crear vista con lista, filtros, tarjetas, modal de creación y detalle de deuda.
- Permitir cargos/deudas creados solo por el deudor.
- Permitir abonos registrados solo por el acreedor.
- Mostrar deudas solo a partes involucradas.
- Mantener deuda interna aislada de caja, bancos, facturas y `MovimientosFondos`.

## No alcance

- No crear movimientos en `MovimientosFondos`.
- No afectar saldos de Fondo General, BCR, BN, BAC, Caja Negra ni Tucan.
- No crear facturas ni notas de crédito.
- No hacer conciliación contable automática.
- No borrar documentos de deuda en la primera versión.

## Modelo de datos

Colección: `internalDebts`.

Documento:

```ts
type InternalDebtPartyType = "empresa" | "user" | "empleado";
type InternalDebtStatus = "open" | "paid";
type InternalDebtMovementType = "charge" | "payment";

interface InternalDebtParty {
  type: InternalDebtPartyType;
  id: string;
  name: string;
  roleLabel?: string;
}

interface InternalDebtMovement {
  id: string;
  type: InternalDebtMovementType;
  amount: number;
  reason: string;
  reference?: string;
  date: string;
  createdAt: Date;
  createdById: string;
  createdByName: string;
}

interface InternalDebt {
  id?: string;
  ownerId: string;
  debtor: InternalDebtParty;
  creditor: InternalDebtParty;
  participantIds: string[];
  amountOriginal: number;
  balance: number;
  reason: string;
  reference?: string;
  date: string;
  status: InternalDebtStatus;
  movements: InternalDebtMovement[];
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  createdByName: string;
}
```

`participantIds` usa ids estables con prefijo:

- Empresa: `empresa:<empresaId>`
- Usuario admin: `user:<userId>`
- Colaborador: `empleado:<empleadoId>`

## Actores disponibles

La pantalla arma un catálogo por `ownerId`:

- Empresas: documentos `empresas` cuyo `ownerId` coincide.
- Admins: usuarios `admin` con el mismo `ownerId`.
- Colaboradores: documentos `empleados` con el mismo `ownerId`; si falta
  `ownerId`, se derivan desde su `empresaId` y la empresa correspondiente.

Un actor no puede deberse a sí mismo.

## Reglas de negocio

- Solo usuarios con permiso `deudasInternas` entran a la sección.
- Solo partes involucradas ven una deuda.
- Crear deuda:
  - usuario actual debe representar al deudor elegido.
  - `ownerId` de deudor y acreedor debe coincidir.
  - monto debe ser mayor a `0`.
  - se crea movimiento inicial `charge`.
- Registrar abono:
  - usuario actual debe representar al acreedor.
  - monto debe ser mayor a `0`.
  - monto no puede exceder saldo.
  - se agrega movimiento `payment`.
  - `balance` baja; si llega a `0`, `status = "paid"`.
- Agregar cargo adicional:
  - usuario actual debe representar al deudor.
  - monto debe ser mayor a `0`.
  - se agrega movimiento `charge`.
  - `balance` sube; `status = "open"`.

## Identidad de usuario actual

El usuario actual representa:

- su propio `user:<id>`.
- empresas visibles de su mismo `ownerId`, cuando tenga permiso de operación.
- colaboradores solo si existe relación explícita futura; en esta versión los
  colaboradores se pueden elegir como acreedor/deudor, pero no inician sesión
  como parte independiente salvo que también existan como usuario.

## UI

Vista principal:

- Header: `Deudas internas` + badge `BETA`.
- Métricas:
  - deudas visibles
  - solo involucradas
  - abonos por acreedor
- Filtros:
  - buscar empresa/persona
  - tipo `Empresa / Persona`
  - rol `Deudor / Acreedor`
  - limpiar
- Cards:
  - icono según tipo
  - nombre
  - tipo/rol
  - monto total/saldo
  - motivo
  - fecha actualizada
  - acción `Ver detalle`

Modal `Agregar deuda`:

- selector de deudor tipo empresa/colaborador/admin
- selector de acreedor tipo empresa/colaborador/admin
- monto
- fecha
- motivo
- referencia interna opcional
- guardar

Detalle:

- resumen de partes
- saldo actual
- historial de movimientos
- botón `Agregar cargo` si usuario representa deudor
- botón `Registrar abono` si usuario representa acreedor

## Integración de rutas

- `src/app/fondogeneral/deudasinternas/page.tsx`
- `src/services/internal-debts.ts`
- `src/app/page.tsx`: dynamic import, `ActiveTab`, hash válido y render.
- `src/components/layout/Header.tsx`: botón desktop/mobile en grupo Fondo.
- `src/components/layout/HeaderWrapper.tsx`: hash válido.
- `src/types/firestore.ts`: permiso y tipos.
- `src/utils/permissions.ts`: defaults por rol.
- `src/components/auth/UserPermissionsManager.tsx` y `src/edit/DataEditor.tsx`:
  etiqueta/descripción del permiso.
- `firestore.rules`: regla explícita antes del catchall.

## Reglas Firestore

Agregar `match /internalDebts/{debtId}` antes del catchall.

Restricción objetivo:

- `read`: usuario autenticado y participante.
- `create`: usuario autenticado, mismo `ownerId`, creador representa deudor.
- `update`: usuario autenticado y:
  - acreedor agrega solo abono, o
  - deudor agrega solo cargo.
- `delete`: solo admin/superadmin, si se habilita después.

Nota: las reglas actuales dependen parcialmente de claims (`role`, `email`) y la
app guarda identidad en sesión. Si las claims no contienen ids suficientes, la
primera versión reforzará validación en servicio cliente y dejará la regla
Firestore lo más estricta posible con los campos disponibles.

## Pruebas

Pruebas unitarias/servicio:

- normaliza actores y `participantIds`.
- rechaza deudor igual a acreedor.
- rechaza monto `<= 0`.
- crea deuda con movimiento inicial `charge`.
- abono reduce saldo.
- abono mayor al saldo falla.
- cargo adicional sube saldo.
- estado pasa a `paid` cuando saldo queda `0`.

Pruebas de integración manual:

- usuario sin `deudasInternas` no entra.
- deudor crea deuda.
- acreedor registra abono.
- tercero no ve deuda.
- no se crea nada en `MovimientosFondos`.

## Decisiones aprobadas

- Usar permiso nuevo `deudasInternas`.
- No integrar ni mezclar con `MovimientosFondos`.
- Vista inspirada en el mockup provisto.
- Primera versión enfocada en empresas, admins y colaboradores del mismo owner.
