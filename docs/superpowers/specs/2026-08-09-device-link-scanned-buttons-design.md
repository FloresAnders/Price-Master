# Device Link Scanned Buttons Design

## Context

`DeviceLinkModal` shows a QR request with three action buttons: `Autorizar`, `Rechazar`, and `Cancelar`. Today `Autorizar` and `Cancelar` can be pressed while the request is still `pending`, before the mobile device has scanned the QR.

The device-link API and client use the status value `scanned`. The user wrote `scaned`, but the codebase status is `scanned`, so this change uses `scanned`.

## Requirements

- When the QR is visible and `status !== "scanned"`, disable `Autorizar`.
- When the QR is visible and `status !== "scanned"`, disable `Cancelar`.
- When `status === "scanned"`, enable `Autorizar` and `Cancelar`.
- Keep `Rechazar` unchanged.
- Add handler guards so disabled UI cannot be bypassed by accidental calls.
- Do not change API routes, Firestore data, request statuses, or deployment config.

## Design

Create a pure helper that answers whether QR approval/cancel actions are enabled:

```ts
export function canApproveOrCancelDeviceLink(status: string | null): boolean {
  return status === "scanned";
}
```

`DeviceLinkModal` will use this helper to set `disabled` on `Autorizar` and `Cancelar`, apply disabled styling, and return early in `approveRequest` plus the cancel handler when the status is not `scanned`.

## Tests

Add Node tests for the pure helper:

- `pending` returns `false`.
- `null` returns `false`.
- `scanned` returns `true`.
- `approved`, `rejected`, `expired`, and `used` return `false`.

## Success Criteria

- QR screen shows disabled `Autorizar` and `Cancelar` until status becomes `scanned`.
- `Rechazar` remains clickable as before.
- Focused tests, TypeScript, and build pass.
