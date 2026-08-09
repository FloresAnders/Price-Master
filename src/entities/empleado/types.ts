// Documento de la nueva colección "empleados" (relacionado por empresaId)
export interface Empleado {
  id?: string;
  empresaId: string;
  // opcional: para futuras reglas multi-tenant (no es requerido para relacionar con empresa)
  ownerId?: string;
  // Nombre del empleado
  Empleado: string;
  ccssType: "TC" | "MT" | "PH"; // Tipo de cotización en CCSS (Tiempo Completo, Medio Tiempo, Pago por Hora)

  // --- Datos adicionales (sección Empleados) ---
  // 1) Pago de hora en bruto
  pagoHoraBruta?: number;
  // 2) Día de contratación (guardado como YYYY-MM-DD para evitar problemas de zona horaria)
  diaContratacion?: string;
  // 3) Pagan aguinaldo
  paganAguinaldo?: string;
  // 4) Cantidad de horas que trabaja
  cantidadHorasTrabaja?: number;
  // 5) Le dan recibo de pago
  danReciboPago?: string;
  // 6) Contrato físico
  contratoFisico?: string;
  // 7) Se cuenta con espacio de comida
  espacioComida?: string;
  // 8) Se brindan vacaciones
  brindanVacaciones?: string;
  // 9) Incluido en CCSS
  incluidoCCSS?: boolean;
  // 10) Incluido en INS
  incluidoINS?: boolean;

  // Preguntas adicionales configurables
  preguntasExtra?: Array<{
    pregunta: string;
    respuesta: string;
  }>;

  createdAt?: Date;
  updatedAt?: Date;
}
