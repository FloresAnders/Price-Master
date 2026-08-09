export interface EmpresaEmpleado {
  Empleado: string;
  hoursPerShift: number;
  extraAmount: number;
  ccssType: "TC" | "MT";
  /**
   * Si es true (y amboshorarios no es true), el empleado se muestra solo en CalculoHorasPrecios
   * y se oculta del ControlHorario normal.
   */
  calculoprecios?: boolean;
  /**
   * Si es true, el empleado se muestra en ambos horarios (prioridad sobre calculoprecios).
   */
  amboshorarios?: boolean;
}

export interface Empresas {
  id?: string;
  ownerId: string;
  name: string;
  ubicacion: string;
  correoConfigEmail?: string;
  correoConfigPassword?: string;
  horarioApertura?: string;
  horarioCierre?: string;
  cierreFondoVentasMinutesBeforeEnd?: number;
  cierreFondoVentasMinutesAfterEnd?: number;
  mostrarInfoPago?: boolean;
  unicoCierre?: boolean;
  verificacionSistemas?: boolean;
  solicitarApertura?: boolean;
  editBy?: string;
  empleados: EmpresaEmpleado[];
}
