# EmployeeSummaryCalculator - Documentación

## Descripción

El componente `EmployeeSummaryCalculator` es un sistema reutilizable para calcular y mostrar resúmenes de días y horas trabajadas por empleados en el sistema de control de horarios.

## Características

- **Cálculo automático**: Calcula automáticamente días trabajados, horas, salario bruto, deducciones CCSS y salario neto
- **Componente visual**: Proporciona una interfaz visual atractiva con iconos y colores
- **Hook personalizado**: Incluye un hook `useEmployeeSummaryCalculator` para uso programático
- **Función utilitaria**: Función `calculateEmployeeSummary` para cálculos directos
- **Configurable**: Tarifas por hora y montos CCSS configurables
- **Responsive**: Soporte para vista completa y compacta

## Archivos

- `src/components/EmployeeSummaryCalculator.tsx` - Componente principal
- Actualizado: `src/components/ControlHorario.tsx`
- Actualizado: `src/components/ControlHorario_responsive.tsx`

## Uso

### 1. Hook personalizado

```tsx
import { useEmployeeSummaryCalculator } from './EmployeeSummaryCalculator';

function MyComponent() {
  const scheduleData = { /* datos de horarios */ };
  const { calculateEmployeeSummary } = useEmployeeSummaryCalculator(scheduleData);
  
  const summary = calculateEmployeeSummary(employeeName, daysToShow);
  // summary contiene: { workedDays, hours, colones, ccss, neto }
}
```

### 2. Componente visual completo

```tsx
import EmployeeSummaryCalculator from './EmployeeSummaryCalculator';

<EmployeeSummaryCalculator
  employeeName="Juan Pérez"
  scheduleData={scheduleData}
  daysToShow={[1, 2, 3, 4, 5]}
  showFullDetails={true}
  hourlyRate={1529.62}  // Opcional, valor por defecto
  ccssAmount={3672.42}  // Opcional, valor por defecto
/>
```

### 3. Componente visual compacto

```tsx
<EmployeeSummaryCalculator
  employeeName="Juan Pérez"
  scheduleData={scheduleData}
  daysToShow={[1, 2, 3, 4, 5]}
  showFullDetails={false}  // Vista compacta
  className="my-custom-class"
/>
```

### 4. Función utilitaria directa

```tsx
import { calculateEmployeeSummary } from './EmployeeSummaryCalculator';

const summary = calculateEmployeeSummary(
  "Juan Pérez",
  scheduleData,
  daysToShow,
  1529.62,  // hourlyRate opcional
  3672.42   // ccssAmount opcional
);
```

## Props del Componente

| Prop | Tipo | Descripción | Requerido | Valor por defecto |
|------|------|-------------|-----------|-------------------|
| `employeeName` | `string` | Nombre del empleado | Sí | - |
| `scheduleData` | `ScheduleData` | Datos de horarios | Sí | - |
| `daysToShow` | `number[]` | Array de días a considerar | Sí | - |
| `hourlyRate` | `number` | Tarifa por hora | No | 1529.62 |
| `ccssAmount` | `number` | Monto fijo CCSS | No | 3672.42 |
| `className` | `string` | Clases CSS adicionales | No | '' |
| `showFullDetails` | `boolean` | Mostrar vista completa o compacta | No | true |

## Interface EmployeeSummary

```tsx
interface EmployeeSummary {
  workedDays: number;    // Días trabajados (turnos 'N' o 'D')
  hours: number;         // Horas trabajadas (días * 8)
  colones: number;       // Salario bruto (horas * tarifa)
  ccss: number;          // Deducción CCSS
  neto: number;          // Salario neto (bruto - ccss)
}
```

## Interface ScheduleData

```tsx
interface ScheduleData {
  [employeeName: string]: {
    [day: string]: string;  // 'N', 'D', 'L', o ''
  };
}
```

## Migración desde el sistema anterior

Los archivos `ControlHorario.tsx` y `ControlHorario_responsive.tsx` han sido actualizados para usar el nuevo sistema:

### Antes:
```tsx
function getEmployeeSummary(name: string) {
  const days = daysToShow;
  const shifts = days.map((day: number) => scheduleData[name]?.[day.toString()] || '');
  const workedDays = shifts.filter((s: string) => s === 'N' || s === 'D').length;
  const hours = workedDays * 8;
  const colones = hours * 1529.62;
  const ccss = 3672.42;
  const neto = colones - ccss;
  return { workedDays, hours, colones, ccss, neto };
}
```

### Ahora:
```tsx
const { calculateEmployeeSummary } = useEmployeeSummaryCalculator(scheduleData);
const summary = calculateEmployeeSummary(name, daysToShow);
```

## Beneficios

1. **Reutilización**: Un solo sistema para todos los cálculos de horarios
2. **Mantenimiento**: Un lugar central para modificar lógica de cálculos
3. **Consistencia**: Mismo cálculo en toda la aplicación
4. **Flexibilidad**: Múltiples formas de usar (hook, componente, función)
5. **UI mejorada**: Componente visual atractivo con iconos y colores
6. **Configurabilidad**: Tarifas y montos CCSS configurables

## Consideraciones

- Los turnos válidos para días trabajados son 'N' (Nocturno) y 'D' (Diurno)
- El turno 'L' (Libre) no cuenta como día trabajado
- Cada día trabajado equivale a 8 horas
- La tarifa por defecto es ₡1,529.62 por hora
- El monto CCSS por defecto es ₡3,672.42
- El componente soporta temas oscuros automáticamente

## Ejemplo de Integración

```tsx
// En un modal o página de resumen
{showEmployeeSummary && (
  <div className="modal">
    <div className="modal-content">
      <h3>Resumen de Empleado</h3>
      <EmployeeSummaryCalculator
        employeeName={selectedEmployee}
        scheduleData={scheduleData}
        daysToShow={daysToShow}
        showFullDetails={true}
      />
    </div>
  </div>
)}
```
