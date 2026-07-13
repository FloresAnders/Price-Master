# Registro Tucan Design

## Goal

Add a Registro Tucan section that records a dated snapshot with:

- Current balance from the Tucan page, entered manually.
- Current Fondo Tucan balance, read from the existing Fondo General Tucan ledger.
- SINPEs received, entered manually.
- Total calculated as:

```text
total = saldoPaginaTucan + saldoFondoTucan + saldoSinpesRecibidos
```

Records are stored by company under `registrotucan/{empresaId}/records`.

## Scope

Included:

- Replace the current Registro Tucan maintenance placeholder with a real page.
- Keep the existing `registroTucan` permission gate.
- Add a service for `registrotucan`.
- Show a form and recent saved records.
- Save records with company/user/date metadata.

Not included:

- Automatic import from SINPE reports.
- Editing or deleting saved records.
- Changes to the existing Fondo General Tucan movement flow.

## Data Model

Collection path: `registrotucan/{empresaId}/records`

Record fields:

- `id?: string`
- `empresaId?: string`
- `empresa: string`
- `dateKey: number`
- `fecha: string`
- `saldoPaginaTucan: number`
- `saldoFondoTucan: number`
- `saldoSinpesRecibidos: number`
- `total: number`
- `currency: "CRC"`
- `createdById?: string`
- `createdByName?: string`
- `createdAt?: Date`
- `updatedAt?: Date`

## Data Flow

1. User opens `#registroTucan`.
2. Page verifies `user.permissions.registroTucan`.
3. Page resolves the user's company from `user.ownercompanie`.
4. Page loads Fondo Tucan balance from `MovimientosFondos`.
5. User enters date, saldo pagina Tucan, and SINPEs recibidos.
6. UI calculates total live.
7. Save writes one record to `registrotucan/{empresaId}/records`.
8. Recent records reload and display newest first.

## UI

Layout:

- Top summary cards for the three amounts and total.
- Compact form below.
- Recent records table/list below the form.

Field behavior:

- Date defaults to today.
- Fondo Tucan balance is read-only.
- Manual amounts accept Costa Rica currency style text and store numbers.
- Save disabled while loading/saving or if company is missing.

## Error Handling

- If user lacks permission, show restricted access message.
- If company is missing, show a clear blocked state.
- If Fondo Tucan balance cannot load, allow manual fields but block save until balance loads.
- Firestore save failures show an error message without clearing form.

## Testing

Run:

```bash
npx tsc --noEmit
npx eslint src/app/page.tsx src/components/business/RegistroTucan.tsx src/services/registro-tucan.ts src/types/firestore.ts
```

Manual checks:

- User with `registroTucan` sees card and page.
- User without `registroTucan` cannot open via hash.
- Save creates a `registrotucan/{empresaId}/records` doc with correct total.
- Fondo Tucan balance is separate from manual Tucan page balance.
