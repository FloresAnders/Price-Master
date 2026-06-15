export interface MappedEmpresa {
  id?: string;
  label: string;
  value: string;
  mostrarInfoPago: boolean;
  names: string[];
  employees: {
    name: string;
    ccssType: "TC" | "MT";
    hoursPerShift: number;
    extraAmount: number;
  }[];
}

export interface ControlHorarioProps {
  currentUser?: import("../../../types/firestore").User | null;
}

export interface ScheduleData {
  [employeeName: string]: {
    [day: string]: string;
  };
}

export interface DelifoodHoursData {
  [employeeName: string]: {
    [day: string]: { hours: number };
  };
}

export interface ShiftOption {
  value: string;
  label: string;
  color: string;
  textColor: string;
}

export interface EmployeeSummary {
  workedDays: number;
  hours: number;
  colones: number;
  ccss: number;
  neto: number;
  extraAmount: number;
}

export interface ConfirmModalState {
  open: boolean;
  message: string;
  onConfirm: (() => Promise<void>) | null;
  actionType?: "assign" | "delete" | "change";
}

export interface DelifoodModalState {
  isOpen: boolean;
  employeeName: string;
  day: number;
  currentHours: number;
}

export interface QrState {
  show: boolean;
  dataURL: string;
  storageRef: string;
  imageBlob: Blob | null;
  countdown: number | null;
}
