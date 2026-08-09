import type { MovementAccountKey } from "@/shared/services/movimientos-fondos";

export interface ProviderEntry {
  code: string;
  name: string;
  company: string;
  accountId?: MovementAccountKey;
  type?: string;
  category?: "Ingreso" | "Gasto" | "Egreso";
  createdAt?: string;
  updatedAt?: string;
  correonotifi?: string;
  agent?: {
    name: string;
    phone: string;
  };
  visit?: {
    createOrderDays: Array<"D" | "L" | "M" | "MI" | "J" | "V" | "S">;
    receiveOrderDays: Array<"D" | "L" | "M" | "MI" | "J" | "V" | "S">;
    frequency: "SEMANAL" | "QUINCENAL" | "MENSUAL" | "22 DIAS";
    /**
     * Date key (ms at local midnight) that anchors the recurrence.
     * Used for non-weekly frequencies (quincenal/22 días/mensual) to decide which weeks apply.
     */
    startDateKey?: number;
  };
  /**
   * Contador de movimientos asociados al proveedor.
   * Se incrementa cada vez que se guarda un nuevo movimiento (no en ediciones).
   * Se usa para ordenar proveedores de mayor a menor frecuencia en el formulario.
   */
  movementCount?: number;
}
