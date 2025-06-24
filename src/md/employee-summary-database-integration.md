# EmployeeSummaryCalculator - Base de Datos Integrada

## Resumen de Cambios

El componente `EmployeeSummaryCalculator` ha sido completamente actualizado para obtener datos directamente desde la base de datos Firebase/Firestore en lugar de usar valores hardcodeados.

## Nuevas Funcionalidades

### 1. Integración con Base de Datos

**Datos obtenidos automáticamente:**
- ✅ **Horarios del empleado**: Desde la colección `schedules`
- ✅ **Configuración CCSS**: Desde la colección `ccss-config` (MT/TC)
- ✅ **Información del empleado**: Desde la colección `locations` (tipo CCSS, horas por turno, monto extra)
- ✅ **Cálculos dinámicos**: Basados en datos reales

### 2. Hooks Disponibles

#### `useEmployeeData`
Obtiene horarios y configuración CCSS:
```tsx
const { 
  scheduleData, 
  ccssConfig, 
  loading, 
  error, 
  calculateEmployeeSummary,
  hourlyRate 
} = useEmployeeData(employeeName, locationValue, year, month, daysToShow, employee);
```

#### `useEmployeeInfo`
Obtiene información del empleado desde la ubicación:
```tsx
const { employee, loading, error } = useEmployeeInfo(employeeName, locationValue);
```

### 3. Nuevas Props del Componente

```tsx
interface EmployeeSummaryCalculatorProps {
  employeeName: string;        // Nombre del empleado
  locationValue: string;       // Valor de la ubicación
  year: number;               // Año a consultar
  month: number;              // Mes a consultar
  daysToShow: number[];       // Días del mes a incluir
  className?: string;         // Clases CSS adicionales
  showFullDetails?: boolean;  // Mostrar detalles completos
}
```

### 4. Función Utilitaria Actualizada

```tsx
const summary = await calculateEmployeeSummaryFromDB(
  employeeName,
  locationValue,
  year,
  month,
  daysToShow,
  employee
);
```

## Estructura de Datos

### Employee (desde locations)
```tsx
interface Employee {
  name: string;
  ccssType: 'TC' | 'MT';          // Tiempo Completo o Medio Tiempo
  extraAmount?: number;           // Monto extra (default: 0)
  hoursPerShift?: number;         // Horas por turno (default: 8)
}
```

### CcssConfig
```tsx
interface CcssConfig {
  mt: number;    // Valor para Medio Tiempo
  tc: number;    // Valor para Tiempo Completo
  updatedAt: Date;
}
```

### ScheduleEntry
```tsx
interface ScheduleEntry {
  locationValue: string;
  employeeName: string;
  year: number;
  month: number;
  day: number;
  shift: string;  // 'N', 'D', 'L', or ''
}
```

## Cálculos Realizados

### 1. Tarifa por Hora
```typescript
const ccssAmount = ccssType === 'TC' ? ccssConfig.tc : ccssConfig.mt;
const totalColones = ccssAmount + extraAmount;
const hourlyRate = totalColones / (22 * hoursPerShift); // 22 días laborales promedio
```

### 2. Salario Bruto
```typescript
const workedDays = shifts.filter(s => s === 'N' || s === 'D').length;
const hours = workedDays * hoursPerShift;
const colones = hours * hourlyRate;
```

### 3. Salario Neto
```typescript
const neto = colones - ccssAmount;
```

## Estados de Carga y Errores

El componente maneja automáticamente:
- **Loading states**: Mientras carga datos de empleado y horarios
- **Error handling**: Errores de conexión o datos faltantes
- **Fallbacks**: Valores por defecto cuando no hay información

## Ejemplo de Uso Completo

```tsx
import EmployeeSummaryCalculator from '../components/EmployeeSummaryCalculator';

function PayrollReport() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <EmployeeSummaryCalculator
      employeeName="Juan Pérez"
      locationValue="sucursal-centro"
      year={currentYear}
      month={currentMonth}
      daysToShow={daysInMonth}
      showFullDetails={true}
    />
  );
}
```

## Ventajas de la Nueva Implementación

1. **Datos en tiempo real**: Siempre muestra información actualizada desde la base de datos
2. **Configuración centralizada**: Los valores de CCSS se actualizan desde un solo lugar
3. **Flexibilidad**: Soporta diferentes tipos de empleados y configuraciones
4. **Performance**: Carga datos solo cuando es necesario
5. **Error handling**: Manejo robusto de errores y estados de carga
6. **Escalabilidad**: Fácil de extender para nuevos campos o cálculos

## Servicios Utilizados

- `CcssConfigService`: Gestión de configuración CCSS
- `SchedulesService`: Gestión de horarios de empleados
- `LocationsService`: Gestión de ubicaciones y empleados
- `FirestoreService`: Capa base para operaciones de base de datos

## Migración desde Versión Anterior

**Antes:**
```tsx
<EmployeeSummaryCalculator
  employeeName="Juan"
  scheduleData={manualData}
  daysToShow={[1,2,3]}
  hourlyRate={1529.62}
  ccssAmount={3672.42}
/>
```

**Ahora:**
```tsx
<EmployeeSummaryCalculator
  employeeName="Juan"
  locationValue="sucursal-centro"
  year={2024}
  month={6}
  daysToShow={[1,2,3]}
/>
```

La nueva versión es más simple de usar y siempre está sincronizada con la base de datos.
