export function canApproveOrCancelDeviceLink(status: string | null): boolean {
  return status === "scanned";
}
