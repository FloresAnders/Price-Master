// src/components/PayrollExporter.tsx
"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useAuth } from "../../hooks/useAuth";
import { useActorOwnership } from "../../hooks/useActorOwnership";
import {
  Calculator,
  DollarSign,
  Image,
  Save,
  Calendar,
  MapPin,
  Building2,
  Users,
  Filter,
} from "lucide-react";
import { EmpresasService } from "../../services/empresas";
import useToast from "../../hooks/useToast";
import ConfirmModal from "../ui/ConfirmModal";
import { SchedulesService, ScheduleEntry } from "../../services/schedules";
import { PayrollRecordsService } from "../../services/payroll-records";
import { CcssConfigService } from "../../services/ccss-config";

interface MappedEmpresa {
  id?: string;
  label: string;
  value: string;
  names: string[];
  employees: {
    name: string;
    ccssType: "TC" | "MT";
    hoursPerShift: number;
    extraAmount: number;
  }[];
}

interface EmployeeData {
  name: string;
  ccssType: "TC" | "MT";
  hoursPerShift: number;
  extraAmount: number;
}

interface BiweeklyPeriod {
  start: Date;
  end: Date;
  label: string;
  year: number;
  month: number;
  period: "first" | "second";
}

interface EmployeePayrollData {
  employeeName: string;
  ccssType: "TC" | "MT";
  days: { [day: number]: string };
  regularHours: number;
  overtimeHours: number;
  totalWorkDays: number;
  hoursPerDay: number;
  totalHours: number;
  regularSalary: number;
  overtimeSalary: number;
  extraAmount: number;
  totalIncome: number;
  ccssDeduction: number;
  comprasDeduction: number;
  adelantoDeduction: number;
  otrosDeduction: number;
  totalDeductions: number;
  netSalary: number;
}

interface EditableDeductions {
  [employeeKey: string]: {
    compras: number;
    adelanto: number;
    otros: number;
    extraAmount: number; // Para el monto extra editable
  };
}

interface EnhancedEmployeePayrollData extends EmployeePayrollData {
  deductions: {
    compras: number;
    adelanto: number;
    otros: number;
    extraAmount: number;
  };
  regularTotal: number;
  overtimeTotal: number;
  finalExtraAmount: number;
  totalIncome: number;
  ccssAmount: number;
  totalDeductions: number;
  finalNetSalary: number;
}

interface LocationPayrollData {
  location: MappedEmpresa;
  employees: EmployeePayrollData[];
}

interface PayrollExporterProps {
  currentPeriod: BiweeklyPeriod | null;
  selectedLocation?: string;
  onLocationChange?: (location: string) => void;
  availablePeriods?: BiweeklyPeriod[];
  onPeriodChange?: (period: BiweeklyPeriod) => void;
}

export default function PayrollExporter({
  currentPeriod,
  selectedLocation = "all",
  onLocationChange,
  availablePeriods = [],
  onPeriodChange,
}: PayrollExporterProps) {
  const { user: currentUser } = useAuth();
  const { ownerIds: actorOwnerIds, primaryOwnerId } =
    useActorOwnership(currentUser);
  const actorOwnerIdSet = useMemo(
    () => new Set(actorOwnerIds.map((id) => String(id))),
    [actorOwnerIds]
  );
  const [locations, setLocations] = useState<MappedEmpresa[]>([]);
  const [payrollData, setPayrollData] = useState<LocationPayrollData[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const [editableDeductions, setEditableDeductions] =
    useState<EditableDeductions>({});
  const [tempInputValues, setTempInputValues] = useState<{
    [key: string]: string;
  }>({});
  const [debounceTimers, setDebounceTimers] = useState<{
    [key: string]: NodeJS.Timeout;
  }>({});
  const [ccssConfigs, setCcssConfigs] = useState<{
    [empresaName: string]: { tc: number; mt: number; horabruta: number };
  }>({});
  const optionStyle = {
    backgroundColor: "var(--card-bg)",
    color: "var(--foreground)",
  };
  const selectedLocationLabel = useMemo(() => {
    if (selectedLocation === "all") {
      return "Todas las empresas";
    }
    return (
      locations.find((loc) => loc.value === selectedLocation)?.label ||
      selectedLocation
    );
  }, [selectedLocation, locations]);

  // Constantes de salario por defecto (fallback)
  const REGULAR_HOURLY_RATE = 1529.62;
  const OVERTIME_HOURLY_RATE = 2294.43;
  const DEFAULT_CCSS_TC = 11017.39;
  const DEFAULT_CCSS_MT = 3672.46;
  // notifications handled by ToastProvider via showToast()

  // Función para obtener configuración CCSS para una empresa específica
  const getCcssConfigForEmpresa = useCallback(
    (empresaName: string) => {
      const config = ccssConfigs[empresaName];
      return {
        tc: config?.tc || DEFAULT_CCSS_TC,
        mt: config?.mt || DEFAULT_CCSS_MT,
        horabruta: config?.horabruta || REGULAR_HOURLY_RATE,
      };
    },
    [ccssConfigs]
  );

  // Función para crear clave única del empleado
  const getEmployeeKey = (
    locationValue: string,
    employeeName: string
  ): string => {
    return `${locationValue}-${employeeName}`;
  }; // Función para actualizar deducciones editables con debounce optimizado
  const updateDeduction = useCallback(
    (
      locationValue: string,
      employeeName: string,
      type: "compras" | "adelanto" | "otros" | "extraAmount",
      inputValue: string
    ) => {
      const employeeKey = getEmployeeKey(locationValue, employeeName);
      const inputKey = `${employeeKey}-${type}`;
      const defaults = { compras: 0, adelanto: 0, otros: 0, extraAmount: 0 };

      // Actualizar el valor temporal inmediatamente para responsividad de UI
      setTempInputValues((prev) => ({
        ...prev,
        [inputKey]: inputValue,
      }));

      // Limpiar timer anterior si existe
      if (debounceTimers[inputKey]) {
        clearTimeout(debounceTimers[inputKey]);
      }

      // Crear nuevo timer para debounce
      const newTimer = setTimeout(() => {
        const numericValue = parseFloat(inputValue) || 0;

        setEditableDeductions((prev) => ({
          ...prev,
          [employeeKey]: {
            ...defaults,
            ...prev[employeeKey], // Spread existing values
            [type]: numericValue, // Override with new value
          },
        }));

        // Limpiar el timer del estado
        setDebounceTimers((prev) => {
          const newTimers = { ...prev };
          delete newTimers[inputKey];
          return newTimers;
        });
      }, 1000); // 500ms de debounce

      // Guardar el timer
      setDebounceTimers((prev) => ({
        ...prev,
        [inputKey]: newTimer,
      }));
    },
    [debounceTimers]
  ); // Función para obtener deducciones editables de un empleado
  const getEmployeeDeductions = useCallback(
    (locationValue: string, employeeName: string) => {
      const employeeKey = getEmployeeKey(locationValue, employeeName);
      const defaults = { compras: 0, adelanto: 0, otros: 0, extraAmount: 0 };
      const existing = editableDeductions[employeeKey];

      if (!existing) {
        return defaults;
      }

      // Ensure all properties exist with defaults
      return {
        compras: existing.compras ?? defaults.compras,
        adelanto: existing.adelanto ?? defaults.adelanto,
        otros: existing.otros ?? defaults.otros,
        extraAmount: existing.extraAmount ?? defaults.extraAmount,
      };
    },
    [editableDeductions]
  );

  // Función para obtener el valor temporal de un input (para mostrar mientras se escribe)
  const getTempInputValue = useCallback(
    (
      locationValue: string,
      employeeName: string,
      type: "compras" | "adelanto" | "otros" | "extraAmount"
    ): string => {
      const employeeKey = getEmployeeKey(locationValue, employeeName);
      const inputKey = `${employeeKey}-${type}`;

      // Si hay un valor temporal, usarlo
      if (tempInputValues[inputKey] !== undefined) {
        return tempInputValues[inputKey];
      }

      // Sino, usar el valor guardado directamente del estado
      const defaults = { compras: 0, adelanto: 0, otros: 0, extraAmount: 0 };
      const existing = editableDeductions[employeeKey];

      if (!existing) {
        return "";
      }

      const value = existing[type] ?? defaults[type];
      return value > 0 ? value.toString() : "";
    },
    [tempInputValues, editableDeductions]
  );
  const calculatePayrollData = useCallback(
    (
      employeeName: string,
      days: { [day: number]: string },
      ccssType: "TC" | "MT",
      locationValue: string,
      extraAmount: number = 0,
      employee?: EmployeeData
    ): EmployeePayrollData => {
      const workShifts = Object.values(days).filter(
        (shift) => shift === "D" || shift === "N"
      );
      const totalWorkDays = workShifts.length;

      // Usar hoursPerShift del empleado o 8 horas por defecto
      const hoursPerDay = employee?.hoursPerShift || 8;
      const totalHours = totalWorkDays * hoursPerDay;

      // Calcular horas regulares y extraordinarias
      const regularHours = totalHours; // Todas las horas básicas
      const overtimeHours = 0; // Por ahora 0, se puede ajustar según reglas de negocio

      // Calcular salarios según el formato solicitado
      const regularSalary = REGULAR_HOURLY_RATE; // 1529.62
      const overtimeSalary = OVERTIME_HOURLY_RATE; // 2294.43
      // Calcular totales por tipo (T/S = S/H * T/H)
      const regularTotal = regularSalary * totalHours;
      const overtimeTotal = overtimeSalary * overtimeHours; // Obtener deducciones editables para usar el valor de "Otros" ingresos
      const deductions = getEmployeeDeductions(locationValue, employeeName);

      // Usar el monto extra editable en lugar del valor fijo del empleado
      const editableExtraAmount =
        deductions.extraAmount > 0 ? deductions.extraAmount : extraAmount;

      // Total de ingresos: suma de todos los T/S + monto extra editable
      const totalIncome = regularTotal + overtimeTotal + editableExtraAmount;

      // Obtener el nombre de la empresa para la configuración CCSS
      const location = locations.find((loc) => loc.value === locationValue);
      const empresaName = location?.label || locationValue;
      const ccssConfig = getCcssConfigForEmpresa(empresaName);

      // Deducciones
      const ccssDeduction = ccssType === "TC" ? ccssConfig.tc : ccssConfig.mt;
      const comprasDeduction = deductions.compras;
      const adelantoDeduction = deductions.adelanto;
      const otrosDeduction = deductions.otros;

      const totalDeductions =
        ccssDeduction + comprasDeduction + adelantoDeduction + otrosDeduction;
      const netSalary = totalIncome - totalDeductions;
      return {
        employeeName,
        ccssType,
        days,
        regularHours,
        overtimeHours,
        totalWorkDays,
        hoursPerDay,
        totalHours,
        regularSalary,
        overtimeSalary,
        extraAmount: editableExtraAmount,
        totalIncome,
        ccssDeduction,
        comprasDeduction,
        adelantoDeduction,
        otrosDeduction,
        totalDeductions,
        netSalary,
      };
    },
    [getEmployeeDeductions, getCcssConfigForEmpresa, locations]
  );
  // Cargar ubicaciones
  useEffect(() => {
    const loadLocationsAndCcssConfigs = async () => {
      try {
        // Cargar empresas y mapear a la forma que espera el componente (location-like)
        const empresas = await EmpresasService.getAllEmpresas();

        // Mostrar solo empresas pertenecientes al actor que visualiza:
        // - superadmin ve todas
        // - otherwise sólo empresas cuyo ownerId es currentUser.id o coincide con currentUser.ownerId
        let owned: typeof empresas = [];
        if (!currentUser) {
          owned = [];
        } else if (currentUser.role === "superadmin") {
          owned = empresas || [];
        } else {
          if (actorOwnerIdSet.size > 0) {
            owned = (empresas || []).filter((e: unknown) => {
              const obj = e as Record<string, unknown>;
              const ownerId = obj?.ownerId;
              if (ownerId === undefined || ownerId === null) return false;
              return actorOwnerIdSet.has(String(ownerId));
            });
          } else {
            owned = (empresas || []).filter((e: unknown) => {
              const obj = e as Record<string, unknown>;
              const ownerId = obj?.ownerId;
              if (ownerId === undefined || ownerId === null) return false;
              return (
                (currentUser.id &&
                  String(ownerId) === String(currentUser.id)) ||
                (currentUser.ownerId &&
                  String(ownerId) === String(currentUser.ownerId))
              );
            });
          }
        }

        const mapped = (owned || []).map((e) => {
          const obj = e as unknown as Record<string, unknown>;
          const empleados = (obj.empleados as unknown) || [];
          return {
            id: (obj.id as string) || undefined,
            label:
              (obj.name as string) ||
              (obj.ubicacion as string) ||
              (obj.id as string) ||
              "Empresa",
            value:
              (obj.ubicacion as string) ||
              (obj.name as string) ||
              (obj.id as string) ||
              "",
            names: [],
            employees: (Array.isArray(empleados) ? empleados : []).map(
              (emp) => {
                const empObj = emp as unknown as Record<string, unknown>;
                return {
                  name: (empObj.Empleado as string) || "",
                  ccssType: (empObj.ccssType as "TC" | "MT") || "TC",
                  hoursPerShift: (empObj.hoursPerShift as number) || 8,
                  extraAmount: (empObj.extraAmount as number) || 0,
                };
              }
            ),
          };
        });
        setLocations(mapped);

        // Cargar configuraciones CCSS para cada empresa
        if (currentUser) {
          const userOwnerId = primaryOwnerId || currentUser.id || "";
          const ccssConfig = await CcssConfigService.getCcssConfig(userOwnerId);

          if (ccssConfig && ccssConfig.companie) {
            const configMap: {
              [empresaName: string]: {
                tc: number;
                mt: number;
                horabruta: number;
              };
            } = {};

            ccssConfig.companie.forEach((comp) => {
              if (comp.ownerCompanie) {
                configMap[comp.ownerCompanie] = {
                  tc: comp.tc || DEFAULT_CCSS_TC,
                  mt: comp.mt || DEFAULT_CCSS_MT,
                  horabruta: comp.horabruta || REGULAR_HOURLY_RATE,
                };
              }
            });

            setCcssConfigs(configMap);
          }
        }
      } catch (error) {
        console.error("Error loading empresas and CCSS configs:", error);
      }
    };
    loadLocationsAndCcssConfigs();
  }, [actorOwnerIdSet, actorOwnerIds, currentUser, primaryOwnerId]);

  // Limpiar timers al desmontar el componente
  useEffect(() => {
    return () => {
      Object.values(debounceTimers).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, [debounceTimers]);

  // Cargar datos de planilla cuando cambie el período o ubicación
  useEffect(() => {
    const loadPayrollData = async () => {
      if (!currentPeriod) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let periodSchedules: ScheduleEntry[] = [];

        if (selectedLocation === "all") {
          periodSchedules = await SchedulesService.getSchedulesByYearMonth(
            currentPeriod.year,
            currentPeriod.month
          );
        } else {
          periodSchedules =
            await SchedulesService.getSchedulesByLocationYearMonth(
              selectedLocation,
              currentPeriod.year,
              currentPeriod.month
            );
        }

        // Filtrar por quincena (días 1-15 o 16-end)
        periodSchedules = periodSchedules.filter((schedule) => {
          if (currentPeriod.period === "first") {
            return schedule.day >= 1 && schedule.day <= 15;
          } else {
            return schedule.day >= 16;
          }
        });

        // Agrupar por ubicación
        const locationGroups = new Map<string, ScheduleEntry[]>();

        periodSchedules.forEach((schedule) => {
          if (!locationGroups.has(schedule.companieValue)) {
            locationGroups.set(schedule.companieValue, []);
          }
          locationGroups.get(schedule.companieValue)!.push(schedule);
        });

        const payrollDataArray: LocationPayrollData[] = [];

        const locationsToProcess =
          selectedLocation === "all"
            ? locations.filter((location) => location.value !== "DELIFOOD")
            : locations.filter(
                (loc) =>
                  loc.value === selectedLocation && loc.value !== "DELIFOOD"
              );

        locationsToProcess.forEach((location) => {
          const locationSchedules = locationGroups.get(location.value) || [];

          // Agrupar por empleado
          const employeeGroups = new Map<string, ScheduleEntry[]>();
          locationSchedules.forEach((schedule) => {
            if (!employeeGroups.has(schedule.employeeName)) {
              employeeGroups.set(schedule.employeeName, []);
            }
            employeeGroups.get(schedule.employeeName)!.push(schedule);
          });

          const employees: EmployeePayrollData[] = [];
          employeeGroups.forEach((schedules, employeeName) => {
            const days: { [day: number]: string } = {};

            schedules.forEach((schedule) => {
              if (schedule.shift && schedule.shift.trim() !== "") {
                days[schedule.day] = schedule.shift;
              }
            });
            if (Object.keys(days).length > 0) {
              // Buscar el empleado para obtener tipo de CCSS y monto extra
              const employee = location.employees?.find(
                (emp) => emp.name === employeeName
              );
              const ccssType = employee?.ccssType || "TC"; // Por defecto TC
              const baseExtraAmount = employee?.extraAmount || 0; // Monto extra base, por defecto 0

              const payrollData = calculatePayrollData(
                employeeName,
                days,
                ccssType,
                location.value,
                baseExtraAmount,
                employee
              );

              // Solo agregar empleados que tienen días trabajados (totalWorkDays > 0)
              if (payrollData.totalWorkDays > 0) {
                employees.push(payrollData);
              }
            }
          });

          if (employees.length > 0) {
            payrollDataArray.push({
              location,
              employees,
            });
          }
        });
        setPayrollData(payrollDataArray);
      } catch (error) {
        console.error("Error loading payroll data:", error);
        showToast("Error al cargar los datos de planilla", "error");
      } finally {
        setLoading(false);
      }
    };
    if (currentPeriod && locations.length > 0) {
      loadPayrollData();
    }
  }, [
    currentPeriod,
    selectedLocation,
    locations,
    calculatePayrollData,
    showToast,
  ]);

  // Memorizar cálculos de planilla para evitar recálculos innecesarios
  const memoizedPayrollCalculations = useMemo(() => {
    return payrollData.map((locationData) => ({
      ...locationData,
      employees: locationData.employees.map((employee) => {
        const deductions = getEmployeeDeductions(
          locationData.location.value,
          employee.employeeName
        );
        const regularTotal = employee.regularSalary * employee.totalHours;
        const overtimeTotal = employee.overtimeSalary * 0;
        const finalExtraAmount =
          deductions.extraAmount > 0
            ? deductions.extraAmount
            : employee.extraAmount;
        const totalIncome = regularTotal + overtimeTotal + finalExtraAmount;

        // Obtener configuración CCSS para esta empresa
        const empresaName = locationData.location.label;
        const ccssConfig = getCcssConfigForEmpresa(empresaName);
        const ccssAmount =
          employee.ccssType === "TC" ? ccssConfig.tc : ccssConfig.mt;

        const totalDeductions =
          ccssAmount +
          deductions.compras +
          deductions.adelanto +
          deductions.otros;
        const finalNetSalary = totalIncome - totalDeductions;

        return {
          ...employee,
          deductions,
          regularTotal,
          overtimeTotal,
          finalExtraAmount,
          totalIncome,
          ccssAmount,
          totalDeductions,
          finalNetSalary,
        };
      }),
    }));
  }, [payrollData, getEmployeeDeductions, getCcssConfigForEmpresa]);
  const totalEmployees = useMemo(
    () =>
      memoizedPayrollCalculations.reduce(
        (sum, loc) => sum + loc.employees.length,
        0
      ),
    [memoizedPayrollCalculations]
  );
  const totalCompanies = memoizedPayrollCalculations.length;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Función para generar imagen de planilla para un empleado
  const generateEmployeeImage = async (
    employee: EnhancedEmployeePayrollData,
    locationName: string,
    periodDates: string
  ): Promise<void> => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Configurar canvas (más grande para mejor resolución)
    canvas.width = 900;
    canvas.height = 540;

    // Fondo blanco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Configuración inicial
    ctx.textAlign = "left";
    ctx.font = "14px Arial";
    let y = 40;
    const margin = 20;
    const cellHeight = 35;
    const colWidths = [130, 120, 120, 120, 180, 170, 170]; // Anchos de columnas ajustados

    // Función para dibujar celda con borde
    const drawCell = (
      x: number,
      y: number,
      width: number,
      height: number,
      text: string,
      bgColor: string = "#ffffff",
      textColor: string = "#000000",
      bold: boolean = false,
      fontSize: number = 14
    ) => {
      // Fondo de celda
      ctx.fillStyle = bgColor;
      ctx.fillRect(x, y, width, height);

      // Borde
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);

      // Texto
      ctx.fillStyle = textColor;
      ctx.font = bold ? `bold ${fontSize}px Arial` : `${fontSize}px Arial`;
      ctx.textAlign = "center";

      // Centrar texto en la celda
      const textX = x + width / 2;
      const textY = y + height / 2 + fontSize / 3;
      ctx.fillText(text, textX, textY);
    };

    // Encabezado principal (igual que en la tabla HTML)
    let currentX = margin;

    // Primera fila de encabezados
    drawCell(
      currentX,
      y,
      colWidths[0],
      cellHeight,
      employee.employeeName,
      "#f3f4f6",
      "#000000",
      true,
      16
    );
    currentX += colWidths[0];
    drawCell(
      currentX,
      y,
      colWidths[1],
      cellHeight,
      "MES:",
      "#f3f4f6",
      "#000000",
      true
    );
    currentX += colWidths[1];
    drawCell(
      currentX,
      y,
      colWidths[2],
      cellHeight,
      new Date().toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
      }),
      "#f3f4f6",
      "#000000",
      true
    );
    currentX += colWidths[2];
    drawCell(
      currentX,
      y,
      colWidths[3],
      cellHeight,
      "Quincena:",
      "#f3f4f6",
      "#000000",
      true
    );
    currentX += colWidths[3];
    drawCell(
      currentX,
      y,
      colWidths[4],
      cellHeight,
      periodDates,
      "#f3f4f6",
      "#000000",
      true
    );
    currentX += colWidths[4];
    drawCell(
      currentX,
      y,
      colWidths[5] + colWidths[6],
      cellHeight,
      "",
      "#f3f4f6",
      "#000000",
      true
    );

    y += cellHeight;
    currentX = margin;

    // Segunda fila de encabezados
    drawCell(
      currentX,
      y,
      colWidths[0],
      cellHeight,
      "",
      "#f9fafb",
      "#000000",
      false,
      12
    );
    currentX += colWidths[0];
    drawCell(
      currentX,
      y,
      colWidths[1],
      cellHeight,
      "DiasLaborados",
      "#f9fafb",
      "#000000",
      false,
      12
    );
    currentX += colWidths[1];
    drawCell(
      currentX,
      y,
      colWidths[2],
      cellHeight,
      "H/D",
      "#f9fafb",
      "#000000",
      false,
      12
    );
    currentX += colWidths[2];
    drawCell(
      currentX,
      y,
      colWidths[3],
      cellHeight,
      "H/T",
      "#f9fafb",
      "#000000",
      false,
      12
    );
    currentX += colWidths[3];
    drawCell(
      currentX,
      y,
      colWidths[4],
      cellHeight,
      "S/H",
      "#f9fafb",
      "#000000",
      false,
      12
    );
    currentX += colWidths[4];
    drawCell(
      currentX,
      y,
      colWidths[5],
      cellHeight,
      "T/S",
      "#f9fafb",
      "#000000",
      false,
      12
    );

    y += cellHeight;

    // Obtener datos calculados - usar el mismo locationValue que se usa en los inputs
    const deductions = getEmployeeDeductions(
      locationName,
      employee.employeeName
    );
    const regularTotal = employee.regularSalary * employee.totalHours;
    const finalExtraAmount =
      deductions.extraAmount > 0
        ? deductions.extraAmount
        : employee.extraAmount;
    const totalIncome = regularTotal + finalExtraAmount;

    // Obtener configuración CCSS para esta empresa
    const location = locations.find((loc) => loc.value === locationName);
    const empresaName = location?.label || locationName;
    const ccssConfig = getCcssConfigForEmpresa(empresaName);
    const ccssAmount =
      employee.ccssType === "TC" ? ccssConfig.tc : ccssConfig.mt;

    const totalDeductions =
      ccssAmount + deductions.compras + deductions.adelanto + deductions.otros;
    const finalNetSalary = totalIncome - totalDeductions;

    // Fila de Horas Ordinarias (fondo azul claro)
    currentX = margin;
    drawCell(
      currentX,
      y,
      colWidths[0],
      cellHeight,
      "HorasOrdinarias",
      "#dbeafe",
      "#000000",
      true
    );
    currentX += colWidths[0];
    drawCell(
      currentX,
      y,
      colWidths[1],
      cellHeight,
      employee.totalWorkDays.toString(),
      "#dbeafe"
    );
    currentX += colWidths[1];
    drawCell(
      currentX,
      y,
      colWidths[2],
      cellHeight,
      employee.hoursPerDay.toString(),
      "#dbeafe"
    );
    currentX += colWidths[2];
    drawCell(
      currentX,
      y,
      colWidths[3],
      cellHeight,
      employee.totalHours.toString(),
      "#dbeafe"
    );
    currentX += colWidths[3];
    drawCell(
      currentX,
      y,
      colWidths[4],
      cellHeight,
      employee.regularSalary.toLocaleString("es-CR", {
        minimumFractionDigits: 2,
      }),
      "#dbeafe"
    );
    currentX += colWidths[4];
    drawCell(
      currentX,
      y,
      colWidths[5],
      cellHeight,
      regularTotal.toLocaleString("es-CR", { minimumFractionDigits: 2 }),
      "#dbeafe",
      "#000000",
      true
    );

    y += cellHeight;

    // Fila de Horas Extras (fondo naranja claro)
    currentX = margin;
    drawCell(
      currentX,
      y,
      colWidths[0],
      cellHeight,
      "HorasExtras",
      "#fed7aa",
      "#000000",
      true
    );
    currentX += colWidths[0];
    drawCell(currentX, y, colWidths[1], cellHeight, "", "#fed7aa");
    currentX += colWidths[1];
    drawCell(currentX, y, colWidths[2], cellHeight, "", "#fed7aa");
    currentX += colWidths[2];
    drawCell(currentX, y, colWidths[3], cellHeight, "", "#fed7aa");
    currentX += colWidths[3];
    drawCell(
      currentX,
      y,
      colWidths[4],
      cellHeight,
      employee.overtimeSalary.toLocaleString("es-CR", {
        minimumFractionDigits: 2,
      }),
      "#fed7aa"
    );
    currentX += colWidths[4];
    drawCell(
      currentX,
      y,
      colWidths[5],
      cellHeight,
      "",
      "#fed7aa",
      "#000000",
      true
    );

    y += cellHeight;

    // Fila de Monto Extra (fondo verde claro)
    currentX = margin;
    drawCell(
      currentX,
      y,
      colWidths[0],
      cellHeight,
      "Monto Extra",
      "#dcfce7",
      "#000000",
      true
    );
    currentX += colWidths[0];
    drawCell(currentX, y, colWidths[1], cellHeight, "", "#dcfce7");
    currentX += colWidths[1];
    drawCell(currentX, y, colWidths[2], cellHeight, "", "#dcfce7");
    currentX += colWidths[2];
    drawCell(currentX, y, colWidths[3], cellHeight, "", "#dcfce7");
    currentX += colWidths[3];
    drawCell(currentX, y, colWidths[4], cellHeight, "", "#dcfce7");
    currentX += colWidths[4];
    drawCell(
      currentX,
      y,
      colWidths[5],
      cellHeight,
      finalExtraAmount.toLocaleString("es-CR", { minimumFractionDigits: 2 }),
      "#dcfce7",
      "#000000",
      true
    );

    y += cellHeight;

    // Fila separadora
    currentX = margin;
    for (let i = 0; i < 4; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, "", "#ffffff");
      currentX += colWidths[i];
    }
    drawCell(
      currentX,
      y,
      colWidths[4],
      cellHeight,
      "IngresosTotales",
      "#ffffff",
      "#000000",
      true
    );
    currentX += colWidths[4];
    drawCell(
      currentX,
      y,
      colWidths[5],
      cellHeight,
      totalIncome.toLocaleString("es-CR", { minimumFractionDigits: 2 }),
      "#ffffff",
      "#000000",
      true
    );

    y += cellHeight;

    // Fila separadora vacía
    currentX = margin;
    for (let i = 0; i < colWidths.length - 1; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, "", "#ffffff");
      currentX += colWidths[i];
    }

    y += cellHeight;

    // CCSS
    currentX = margin;
    for (let i = 0; i < 4; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, "", "#ffffff");
      currentX += colWidths[i];
    }
    drawCell(
      currentX,
      y,
      colWidths[4],
      cellHeight,
      "CCSS",
      "#ffffff",
      "#000000",
      true
    );
    currentX += colWidths[4];
    drawCell(
      currentX,
      y,
      colWidths[5],
      cellHeight,
      `₡${ccssAmount.toLocaleString("es-CR", { minimumFractionDigits: 2 })} (${
        employee.ccssType
      })`,
      "#ffffff"
    );

    y += cellHeight;

    // COMPRAS
    currentX = margin;
    for (let i = 0; i < 4; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, "", "#ffffff");
      currentX += colWidths[i];
    }
    drawCell(
      currentX,
      y,
      colWidths[4],
      cellHeight,
      "COMPRAS",
      "#ffffff",
      "#000000",
      true
    );
    currentX += colWidths[4];
    drawCell(
      currentX,
      y,
      colWidths[5],
      cellHeight,
      deductions.compras.toLocaleString("es-CR", { minimumFractionDigits: 2 }),
      "#ffffff"
    );

    y += cellHeight;

    // ADELANTO
    currentX = margin;
    for (let i = 0; i < 4; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, "", "#ffffff");
      currentX += colWidths[i];
    }
    drawCell(
      currentX,
      y,
      colWidths[4],
      cellHeight,
      "ADELANTO",
      "#ffffff",
      "#000000",
      true
    );
    currentX += colWidths[4];
    drawCell(
      currentX,
      y,
      colWidths[5],
      cellHeight,
      deductions.adelanto.toLocaleString("es-CR", { minimumFractionDigits: 2 }),
      "#ffffff"
    );

    y += cellHeight;

    // OTROS
    currentX = margin;
    for (let i = 0; i < 4; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, "", "#ffffff");
      currentX += colWidths[i];
    }
    drawCell(
      currentX,
      y,
      colWidths[4],
      cellHeight,
      "OTROS",
      "#ffffff",
      "#000000",
      true
    );
    currentX += colWidths[4];
    drawCell(
      currentX,
      y,
      colWidths[5],
      cellHeight,
      deductions.otros.toLocaleString("es-CR", { minimumFractionDigits: 2 }),
      "#ffffff"
    );

    y += cellHeight;

    // DEDUCCIONESTOTALES (fondo rojo claro)
    currentX = margin;
    for (let i = 0; i < 4; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, "", "#fecaca");
      currentX += colWidths[i];
    }
    drawCell(
      currentX,
      y,
      colWidths[4],
      cellHeight,
      "DEDUCCIONESTOTALES",
      "#fecaca",
      "#000000",
      true
    );
    currentX += colWidths[4];
    drawCell(
      currentX,
      y,
      colWidths[5],
      cellHeight,
      `₡${totalDeductions.toLocaleString("es-CR", {
        minimumFractionDigits: 2,
      })}`,
      "#fecaca",
      "#000000",
      true
    );

    y += cellHeight;

    // SALARIO NETO (fondo amarillo)
    currentX = margin;
    for (let i = 0; i < 4; i++) {
      drawCell(currentX, y, colWidths[i], cellHeight, "", "#fef3c7");
      currentX += colWidths[i];
    }
    drawCell(
      currentX,
      y,
      colWidths[4],
      cellHeight,
      "SALARIO NETO",
      "#fef3c7",
      "#000000",
      true,
      16
    );
    currentX += colWidths[4];
    drawCell(
      currentX,
      y,
      colWidths[5],
      cellHeight,
      `₡${finalNetSalary.toLocaleString("es-CR", {
        minimumFractionDigits: 2,
      })}`,
      "#fef3c7",
      "#000000",
      true,
      16
    );

    // Descargar la imagen
    try {
      const dataURL = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataURL;
      link.download = `planilla-${employee.employeeName.replace(
        /\s+/g,
        "_"
      )}-${periodDates}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error generating image:", error);
      throw error;
    }
  };

  // Función para exportar un empleado individual
  const exportIndividualEmployee = async (
    employee: EnhancedEmployeePayrollData,
    locationName: string
  ) => {
    if (!currentPeriod) {
      showToast("No hay período seleccionado", "error");
      return;
    }

    const periodDates = `${currentPeriod.start.getDate()}-${currentPeriod.end.getDate()}`;

    showToast(`📊 Generando imagen de ${employee.employeeName}...`, "success");

    try {
      await generateEmployeeImage(employee, locationName, periodDates);
      showToast(
        `✅ Imagen de ${employee.employeeName} descargada exitosamente`,
        "success"
      );
    } catch (error) {
      console.error("Error generating individual employee image:", error);
      showToast(
        `❌ Error generando imagen de ${employee.employeeName}`,
        "error"
      );
    }
  };

  // Función para guardar registro de planilla
  const savePayrollRecord = async (
    employee: EnhancedEmployeePayrollData,
    locationValue: string
  ) => {
    if (!currentPeriod) {
      showToast("No hay período seleccionado", "error");
      return;
    }

    try {
      showToast(
        `💾 Guardando registro de ${employee.employeeName}...`,
        "success"
      );

      await PayrollRecordsService.saveRecord(
        locationValue,
        employee.employeeName,
        currentPeriod.year,
        currentPeriod.month,
        currentPeriod.period,
        employee.totalWorkDays,
        employee.hoursPerDay,
        employee.totalHours
      );

      showToast(
        `✅ Registro de ${employee.employeeName} guardado exitosamente`,
        "success"
      );
    } catch (error) {
      console.error("Error saving payroll record:", error);
      showToast(
        `❌ Error guardando registro de ${employee.employeeName}`,
        "error"
      );
    }
  };

  // Función para guardar todos los registros de una ubicación/empresa
  const savePayrollRecordsForLocation = async (
    locationValue: string,
    employees: EnhancedEmployeePayrollData[]
  ) => {
    // Abrir modal de confirmación antes de guardar en lote
    if (!currentPeriod) {
      showToast("No hay período seleccionado", "error");
      return;
    }

    if (!employees || employees.length === 0) {
      showToast("No hay empleados para guardar en esta empresa", "error");
      return;
    }

    const year = currentPeriod.year;
    const month = currentPeriod.month;
    const period = currentPeriod.period;

    const doSaveAll = async () => {
      let success = 0;
      let errors = 0;

      showToast(`💾 Guardando ${employees.length} registros...`, "success");

      for (const emp of employees) {
        try {
          await PayrollRecordsService.saveRecord(
            locationValue,
            emp.employeeName,
            year,
            month,
            period,
            emp.totalWorkDays,
            emp.hoursPerDay,
            emp.totalHours
          );
          success++;
        } catch (err) {
          console.error(
            "Error saving payroll record for",
            emp.employeeName,
            err
          );
          errors++;
        }
      }

      if (errors === 0) {
        showToast(
          `✅ ${success} registros guardados para la empresa`,
          "success"
        );
      } else {
        showToast(`⚠️ ${success} guardados, ${errors} errores`, "error");
      }
    };

    openConfirmModal(
      "Guardar Registros",
      `¿Deseas guardar ${employees.length} registro(s) para ${locationValue}?`,
      doSaveAll
    );
  };

  // Estado para modal de confirmación
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
    loading: boolean;
    singleButton?: boolean;
    singleButtonText?: string;
  }>({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
    loading: false,
    singleButton: false,
    singleButtonText: undefined,
  });

  const openConfirmModal = (
    title: string,
    message: string,
    onConfirm: () => void,
    opts?: { singleButton?: boolean; singleButtonText?: string }
  ) => {
    setConfirmModal({
      open: true,
      title,
      message,
      onConfirm,
      loading: false,
      singleButton: opts?.singleButton,
      singleButtonText: opts?.singleButtonText,
    });
  };

  const closeConfirmModal = () => {
    setConfirmModal({
      open: false,
      title: "",
      message: "",
      onConfirm: null,
      loading: false,
      singleButton: false,
      singleButtonText: undefined,
    });
  };

  const handleConfirm = async () => {
    if (confirmModal.onConfirm) {
      try {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        await Promise.resolve(confirmModal.onConfirm());
      } catch (error: unknown) {
        console.error("Error in confirm action:", error);
        const msg =
          error instanceof Error ? error.message : String(error || "Error");
        showToast(
          msg.includes("Forbidden")
            ? "No tienes permisos para realizar esta acción"
            : "Error al ejecutar la acción",
          "error"
        );
      } finally {
        closeConfirmModal();
      }
    }
  };

  const exportPayroll = async () => {
    if (!currentPeriod || memoizedPayrollCalculations.length === 0) {
      showToast("No hay datos para exportar", "error");
      return;
    }

    const periodDates = `${currentPeriod.start.getDate()}-${currentPeriod.end.getDate()}`;
    let totalEmployees = 0;

    // Contar total de empleados para mostrar progreso
    memoizedPayrollCalculations.forEach((locationData) => {
      totalEmployees += locationData.employees.length;
    });

    let processedEmployees = 0;
    let successCount = 0;
    let errorCount = 0;

    showToast(
      `📊 Iniciando exportación de ${totalEmployees} planillas...`,
      "success"
    );

    for (const locationData of memoizedPayrollCalculations) {
      for (const employee of locationData.employees) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 200)); // Pausa entre imágenes
          await generateEmployeeImage(
            employee,
            locationData.location.value,
            periodDates
          );
          successCount++;
          processedEmployees++;

          // Actualizar notificación de progreso
          showToast(
            `📊 Procesando... ${processedEmployees}/${totalEmployees} (${successCount} exitosas)`,
            "success"
          );
        } catch (error) {
          console.error(`Error exporting ${employee.employeeName}:`, error);
          errorCount++;
          processedEmployees++;
        }
      }
    }

    if (errorCount === 0) {
      showToast(
        `✅ ${successCount} imágenes descargadas exitosamente`,
        "success"
      );
    } else {
      showToast(`⚠️ ${successCount} exitosas, ${errorCount} errores`, "error");
    }
  };

  if (loading) {
    return (
      <div className="max-w-full mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4 sm:p-6">
        <div className="text-center py-8 sm:py-12">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-green-600 mx-auto mb-3 sm:mb-4"></div>
          <div className="text-base sm:text-lg text-[var(--foreground)]">
            Cargando planilla de pago...
          </div>
          <div className="text-sm text-[var(--tab-text)] mt-2">
            Calculando salarios y deducciones
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto bg-[var(--card-bg)] rounded-lg shadow p-3 sm:p-6">
      {/* notifications are rendered globally by ToastProvider */}

      {/* Header con controles */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col gap-4">
          {/* Título y descripción */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <Calculator className="w-6 h-6 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="text-lg sm:text-xl font-semibold">
                  Planilla de Pago
                </h3>
                <p className="text-sm text-[var(--tab-text)]">
                  Cálculo de salarios por quincena
                </p>
              </div>
            </div>
          </div>

          {/* Controles - diseño unificado con la pestaña de horarios */}
          <div className="bg-gray-50/80 dark:bg-gray-900/30 border border-[var(--input-border)] rounded-2xl p-4 sm:p-5 space-y-4 transition-colors">
            <div className="flex flex-col xl:flex-row gap-3 xl:gap-4 items-stretch">
              <div className="flex items-center gap-3 flex-1 w-full bg-white/80 dark:bg-gray-900/60 border border-[var(--input-border)] rounded-xl px-3 py-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                  <MapPin className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tab-text)]">
                    Empresa
                  </p>
                  <select
                    value={selectedLocation}
                    onChange={(e) => onLocationChange?.(e.target.value)}
                    disabled={!onLocationChange}
                    className="w-full bg-transparent text-sm font-medium text-[var(--foreground)] focus:outline-none disabled:text-gray-400 appearance-none"
                    title={
                      onLocationChange
                        ? "Seleccionar empresa para la planilla"
                        : "Selector controlado desde la pestaña principal"
                    }
                    style={{ backgroundColor: "transparent" }}
                  >
                    <option value="all" style={optionStyle}>
                      Todas las empresas
                    </option>
                    {locations
                      .filter((location) => location.value !== "DELIFOOD")
                      .map((location) => (
                        <option
                          key={location.value}
                          value={location.value}
                          style={optionStyle}
                        >
                          {location.label}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full xl:w-auto">
                <div className="flex items-center justify-between bg-white dark:bg-gray-900/60 border border-[var(--input-border)] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--tab-text)]">
                      Empresas activas
                    </p>
                    <p className="text-lg font-semibold text-[var(--foreground)]">
                      {totalCompanies}
                    </p>
                    <p className="text-[11px] text-[var(--tab-text)]">
                      Con datos en la quincena
                    </p>
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-200">
                    <Building2 className="w-4 h-4" />
                  </span>
                </div>
                <div className="flex items-center justify-between bg-white dark:bg-gray-900/60 border border-[var(--input-border)] rounded-xl px-4 py-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide font-semibold text-[var(--tab-text)]">
                      Colaboradores
                    </p>
                    <p className="text-lg font-semibold text-[var(--foreground)]">
                      {totalEmployees}
                    </p>
                    <p className="text-[11px] text-[var(--tab-text)]">
                      Listos para exportar
                    </p>
                  </div>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-100">
                    <Users className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-3 xl:gap-4 items-stretch">
              <div className="flex items-center gap-3 flex-1 w-full bg-white/80 dark:bg-gray-900/60 border border-[var(--input-border)] rounded-xl px-3 py-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                  <Calendar className="w-5 h-5" />
                </span>
                <div className="flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tab-text)]">
                    Seleccionar quincena
                  </p>
                  <select
                    value={
                      currentPeriod
                        ? `${currentPeriod.year}-${currentPeriod.month}-${currentPeriod.period}`
                        : ""
                    }
                    onChange={(e) => {
                      if (e.target.value && onPeriodChange) {
                        const [year, month, period] = e.target.value.split("-");
                        const selectedPeriod = availablePeriods.find(
                          (p) =>
                            p.year === parseInt(year) &&
                            p.month === parseInt(month) &&
                            p.period === period
                        );
                        if (selectedPeriod) {
                          onPeriodChange(selectedPeriod);
                        }
                      }
                    }}
                    className="w-full bg-transparent text-sm font-medium text-[var(--foreground)] focus:outline-none disabled:text-gray-400 appearance-none"
                    disabled={!onPeriodChange || availablePeriods.length === 0}
                    title={
                      onPeriodChange
                        ? "Seleccionar quincena para la planilla"
                        : "Período controlado desde la pestaña Horarios"
                    }
                    style={{ backgroundColor: "transparent" }}
                  >
                    {availablePeriods.length === 0 ? (
                      <option value="" style={optionStyle}>
                        Cargando quincenas...
                      </option>
                    ) : (
                      availablePeriods.map((period) => (
                        <option
                          key={`${period.year}-${period.month}-${period.period}`}
                          value={`${period.year}-${period.month}-${period.period}`}
                          style={optionStyle}
                        >
                          {period.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white dark:bg-gray-900/70 border border-[var(--input-border)] rounded-xl px-4 py-3 w-full xl:w-auto">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-100">
                  <Filter className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tab-text)]">
                    Resumen del filtro
                  </p>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {selectedLocation === "all"
                      ? "Mostrando todas las empresas"
                      : selectedLocationLabel}
                  </p>
                  <p className="text-xs text-[var(--tab-text)]">
                    {currentPeriod?.label
                      ? `Período ${currentPeriod.label}`
                      : "Selecciona una quincena para ver datos"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch">
              <div className="flex flex-wrap justify-end gap-2 w-full lg:w-auto">
                <button
                  onClick={exportPayroll}
                  disabled={memoizedPayrollCalculations.length === 0}
                  className="flex-1 sm:flex-none px-4 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 transition-all shadow-sm flex items-center justify-center gap-2 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
                  title="Exportar planillas como imágenes"
                >
                  <Image className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar Imágenes</span>
                  <span className="sm:hidden">Exportar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido de planilla */}
      <div className="space-y-4 sm:space-y-6">
        {memoizedPayrollCalculations.map((locationData, locationIndex) => (
          <div
            key={locationIndex}
            className="border border-[var(--input-border)] rounded-lg overflow-hidden"
          >
            <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 sm:px-6 sm:py-4 border-b border-[var(--input-border)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                <h4 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  <span className="truncate">
                    {locationData.location.label}
                  </span>
                </h4>
                <div className="flex flex-col xs:flex-row xs:items-center gap-2 xs:gap-4">
                  <span className="text-sm text-[var(--tab-text)]">
                    {locationData.employees.length} empleado
                    {locationData.employees.length !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() =>
                      savePayrollRecordsForLocation(
                        locationData.location.value,
                        locationData.employees as EnhancedEmployeePayrollData[]
                      )
                    }
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                    title={`Guardar todos los registros de ${locationData.location.label}`}
                  >
                    <Save className="w-4 h-4" />
                    <span className="hidden sm:inline">Guardar Registros</span>
                    <span className="sm:hidden">Guardar</span>
                  </button>
                </div>
              </div>
            </div>

            {locationData.employees.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-[var(--tab-text)]">
                <Calculator className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm sm:text-base">
                  No hay datos de planilla para este período
                </p>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
                {locationData.employees.map((employee, empIndex) => {
                  // Usar los valores precalculados
                  const {
                    regularTotal,
                    overtimeTotal,
                    totalIncome,
                    ccssAmount,
                    totalDeductions,
                    finalNetSalary,
                  } = employee;

                  return (
                    <div
                      key={empIndex}
                      className="border border-[var(--input-border)] rounded-lg overflow-hidden"
                    >
                      {/* Header del empleado */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-3 border-b border-[var(--input-border)]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                          <h5 className="text-base sm:text-lg font-semibold text-blue-900 dark:text-blue-200">
                            {employee.employeeName}
                          </h5>
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                savePayrollRecord(
                                  employee,
                                  locationData.location.value
                                )
                              }
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md flex items-center gap-2 transition-colors"
                              title={`Guardar registro de ${employee.employeeName}`}
                            >
                              <Save className="w-4 h-4" />
                              <span className="hidden sm:inline">Guardar</span>
                            </button>
                            <button
                              onClick={() =>
                                exportIndividualEmployee(
                                  employee,
                                  locationData.location.value
                                )
                              }
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md flex items-center gap-2 transition-colors"
                              title={`Exportar planilla de ${employee.employeeName}`}
                            >
                              <Image className="w-4 h-4" />
                              <span className="hidden sm:inline">Exportar</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Tabla de planilla */}
                      <div className="overflow-x-auto">
                        <div className="min-w-full">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr>
                                <th className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-semibold text-left bg-gray-50 dark:bg-gray-800/50 min-w-[140px]">
                                  Concepto
                                </th>
                                <th className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-semibold text-center bg-gray-50 dark:bg-gray-800/50 min-w-[80px]">
                                  Días
                                </th>
                                <th className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-semibold text-center bg-gray-50 dark:bg-gray-800/50 min-w-[60px]">
                                  H/D
                                </th>
                                <th className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-semibold text-center bg-gray-50 dark:bg-gray-800/50 min-w-[60px]">
                                  H/T
                                </th>
                                <th className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-semibold text-center bg-gray-50 dark:bg-gray-800/50 min-w-[80px]">
                                  S/H
                                </th>
                                <th className="border-b border-[var(--input-border)] p-2 sm:p-3 font-semibold text-center bg-gray-50 dark:bg-gray-800/50 min-w-[100px]">
                                  Total
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {/* Fila de Horas Ordinarias */}
                              <tr className="bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-medium text-sm sm:text-base">
                                  Horas Ordinarias
                                </td>
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 text-center text-sm sm:text-base">
                                  {employee.totalWorkDays}
                                </td>
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 text-center text-sm sm:text-base">
                                  {employee.hoursPerDay}
                                </td>
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 text-center text-sm sm:text-base">
                                  {employee.totalHours}
                                </td>
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 text-center text-sm sm:text-base">
                                  ₡
                                  {employee.regularSalary.toLocaleString(
                                    "es-CR",
                                    { minimumFractionDigits: 2 }
                                  )}
                                </td>
                                <td className="border-b border-[var(--input-border)] p-2 sm:p-3 text-center font-semibold text-sm sm:text-base">
                                  ₡
                                  {regularTotal.toLocaleString("es-CR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>

                              {/* Fila de Horas Extras */}
                              <tr className="bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30">
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-medium text-sm sm:text-base">
                                  Horas Extras
                                </td>
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 text-center text-sm sm:text-base">
                                  -
                                </td>
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 text-center text-sm sm:text-base">
                                  -
                                </td>
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 text-center text-sm sm:text-base">
                                  {employee.overtimeHours}
                                </td>
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 text-center text-sm sm:text-base">
                                  ₡
                                  {(
                                    employee.regularSalary * 1.5
                                  ).toLocaleString("es-CR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="border-b border-[var(--input-border)] p-2 sm:p-3 text-center font-semibold text-sm sm:text-base">
                                  ₡
                                  {overtimeTotal.toLocaleString("es-CR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>

                              {/* Fila de Monto Extra */}
                              <tr className="bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30">
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-medium text-sm sm:text-base">
                                  Monto Extra
                                </td>
                                <td
                                  className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 text-center text-sm sm:text-base"
                                  colSpan={4}
                                >
                                  -
                                </td>
                                <td className="border-b border-[var(--input-border)] p-2 sm:p-3 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={
                                      getTempInputValue(
                                        locationData.location.value,
                                        employee.employeeName,
                                        "extraAmount"
                                      ) || employee.finalExtraAmount.toString()
                                    }
                                    onChange={(e) =>
                                      updateDeduction(
                                        locationData.location.value,
                                        employee.employeeName,
                                        "extraAmount",
                                        e.target.value
                                      )
                                    }
                                    className="w-full text-center border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 font-semibold text-sm sm:text-base"
                                    style={{
                                      background: "var(--input-bg)",
                                      color: "var(--foreground)",
                                    }}
                                    placeholder="0.00"
                                  />
                                </td>
                              </tr>

                              {/* Fila de INGRESOS TOTALES */}
                              <tr className="bg-green-100 dark:bg-green-900/30 border-t-2 border-green-600">
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-bold text-green-800 dark:text-green-200 text-sm sm:text-base">
                                  INGRESOS TOTALES
                                </td>
                                <td
                                  className="border-b border-r border-[var(--input-border)] p-2 sm:p-3"
                                  colSpan={4}
                                ></td>
                                <td className="border-b border-[var(--input-border)] p-2 sm:p-3 text-center font-bold text-green-800 dark:text-green-200 text-base sm:text-lg">
                                  ₡
                                  {totalIncome.toLocaleString("es-CR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>

                              {/* Fila de CCSS */}
                              <tr className="bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30">
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-medium text-sm sm:text-base">
                                  CCSS
                                </td>
                                <td
                                  className="border-b border-r border-[var(--input-border)] p-2 sm:p-3"
                                  colSpan={4}
                                ></td>
                                <td className="border-b border-[var(--input-border)] p-2 sm:p-3 text-center font-semibold text-sm sm:text-base">
                                  ₡
                                  {ccssAmount.toLocaleString("es-CR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>

                              {/* COMPRAS - Editable */}
                              <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-medium text-sm sm:text-base">
                                  COMPRAS
                                </td>
                                <td
                                  className="border-b border-r border-[var(--input-border)] p-2 sm:p-3"
                                  colSpan={4}
                                ></td>
                                <td className="border-b border-[var(--input-border)] p-2 sm:p-3 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={getTempInputValue(
                                      locationData.location.value,
                                      employee.employeeName,
                                      "compras"
                                    )}
                                    onChange={(e) =>
                                      updateDeduction(
                                        locationData.location.value,
                                        employee.employeeName,
                                        "compras",
                                        e.target.value
                                      )
                                    }
                                    className="w-full text-center border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 font-semibold text-sm sm:text-base"
                                    style={{
                                      background: "var(--input-bg)",
                                      color: "var(--foreground)",
                                    }}
                                    placeholder="0.00"
                                  />
                                </td>
                              </tr>

                              {/* ADELANTO - Editable */}
                              <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-medium text-sm sm:text-base">
                                  ADELANTO
                                </td>
                                <td
                                  className="border-b border-r border-[var(--input-border)] p-2 sm:p-3"
                                  colSpan={4}
                                ></td>
                                <td className="border-b border-[var(--input-border)] p-2 sm:p-3 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={getTempInputValue(
                                      locationData.location.value,
                                      employee.employeeName,
                                      "adelanto"
                                    )}
                                    onChange={(e) =>
                                      updateDeduction(
                                        locationData.location.value,
                                        employee.employeeName,
                                        "adelanto",
                                        e.target.value
                                      )
                                    }
                                    className="w-full text-center border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 font-semibold text-sm sm:text-base"
                                    style={{
                                      background: "var(--input-bg)",
                                      color: "var(--foreground)",
                                    }}
                                    placeholder="0.00"
                                  />
                                </td>
                              </tr>

                              {/* OTROS deducciones - Editable */}
                              <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-medium text-sm sm:text-base">
                                  OTROS
                                </td>
                                <td
                                  className="border-b border-r border-[var(--input-border)] p-2 sm:p-3"
                                  colSpan={4}
                                ></td>
                                <td className="border-b border-[var(--input-border)] p-2 sm:p-3 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={getTempInputValue(
                                      locationData.location.value,
                                      employee.employeeName,
                                      "otros"
                                    )}
                                    onChange={(e) =>
                                      updateDeduction(
                                        locationData.location.value,
                                        employee.employeeName,
                                        "otros",
                                        e.target.value
                                      )
                                    }
                                    className="w-full text-center border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 font-semibold text-sm sm:text-base"
                                    style={{
                                      background: "var(--input-bg)",
                                      color: "var(--foreground)",
                                    }}
                                    placeholder="0.00"
                                  />
                                </td>
                              </tr>

                              {/* Fila de DEDUCCIONES TOTALES */}
                              <tr className="bg-red-100 dark:bg-red-900/30 border-t-2 border-red-600">
                                <td className="border-b border-r border-[var(--input-border)] p-2 sm:p-3 font-bold text-red-800 dark:text-red-200 text-sm sm:text-base">
                                  DEDUCCIONES TOTALES
                                </td>
                                <td
                                  className="border-b border-r border-[var(--input-border)] p-2 sm:p-3"
                                  colSpan={4}
                                ></td>
                                <td className="border-b border-[var(--input-border)] p-2 sm:p-3 text-center font-bold text-red-800 dark:text-red-200 text-base sm:text-lg">
                                  ₡
                                  {totalDeductions.toLocaleString("es-CR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>

                              {/* Fila de SALARIO NETO */}
                              <tr className="bg-yellow-100 dark:bg-yellow-900/30 border-t-4 border-yellow-600">
                                <td className="border-b border-r border-[var(--input-border)] p-3 font-bold text-yellow-800 dark:text-yellow-200 text-base sm:text-lg">
                                  SALARIO NETO
                                </td>
                                <td
                                  className="border-b border-r border-[var(--input-border)] p-3"
                                  colSpan={4}
                                ></td>
                                <td className="border-b border-[var(--input-border)] p-3 text-center font-bold text-yellow-800 dark:text-yellow-200 text-lg sm:text-xl">
                                  ₡
                                  {finalNetSalary.toLocaleString("es-CR", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Canvas oculto para exportación */}
      <canvas
        ref={canvasRef}
        width={900}
        height={540}
        style={{ display: "none" }}
      />
      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Guardar"
        cancelText="Cancelar"
        singleButton={confirmModal.singleButton}
        singleButtonText={confirmModal.singleButtonText}
        loading={confirmModal.loading}
        onConfirm={handleConfirm}
        onCancel={closeConfirmModal}
        actionType="assign"
      />
    </div>
  );
}
