# Control de Horas DELIFOOD

Este es un nuevo componente especializado para el control de horarios específico para ubicaciones DELIFOOD.

## Características principales:

### 🕒 Control de Horas por Día
- Cada empleado puede registrar las horas trabajadas específicas por día
- No se usan turnos fijos (N, D, L), sino que se registra la cantidad exacta de horas
- Todas las entradas tienen shift = "L" y se almacena la cantidad de horas en `horasPorDia`

### 📊 Interfaz Especializada
- **Tablero Visual**: Muestra cada día del mes con las horas trabajadas
- **Modal de Entrada**: Ventana emergente para ingresar/modificar horas
- **Botones Rápidos**: Acceso directo a valores comunes (0h, 4h, 6h, 8h)
- **Total por Empleado**: Suma automática de horas por empleado en el período seleccionado

### 💾 Base de Datos
La estructura en Firestore se ha ampliado para incluir:

```typescript
interface ScheduleEntry {
  locationValue: string;
  employeeName: string;
  year: number;
  month: number;
  day: number;
  shift: string; // Siempre "L" para DELIFOOD
  horasPorDia?: number; // Nuevo campo específico para DELIFOOD
  createdAt: Date;
  updatedAt: Date;
}
```

### 🔐 Acceso Restringido
- Solo funciona para ubicaciones que contengan "DELIFOOD" en su valor o etiqueta
- Requiere autenticación de usuario
- Los administradores pueden cambiar entre ubicaciones DELIFOOD

## Cómo usar:

1. **Acceder**: 
   - **Automático**: Si tu usuario tiene ubicación DELIFOOD asignada, serás redirigido automáticamente
   - **Manual**: Ir directamente a `/delifood-schedule` 
   - **Desde Control Horario**: Al seleccionar una ubicación DELIFOOD serás redirigido automáticamente

2. **Autenticarse**: Iniciar sesión con credenciales válidas
3. **Seleccionar Período**: Elegir entre primera quincena (1-15), segunda quincena (16-fin) o mes completo
4. **Registrar Horas**: 
   - Hacer clic en cualquier celda del día que deseas editar
   - Se abrirá un modal para ingresar las horas
   - Usar los botones rápidos o escribir el número exacto
   - Guardar los cambios

## Navegación:

### Redirección Automática:
- **Usuario DELIFOOD**: Si inicias sesión con un usuario que tiene `location: "DELIFOOD"`, serás redirigido automáticamente desde Control Horario
- **Selección de Ubicación**: Si en Control Horario seleccionas una ubicación que contiene "DELIFOOD", serás redirigido automáticamente

### Acceso Directo:
- **URL directa**: `/delifood-schedule`

### Filtros Disponibles:
- **Por Empleado**: Ver todos los empleados o filtrar por uno específico
- **Por Período**: Primera quincena, segunda quincena o mes completo
- **Por Mes**: Navegar entre diferentes meses usando las flechas

## 🔄 Redirección Automática:

El sistema incluye **redirección automática inteligente**:

### Desde Control Horario:
- **Usuario DELIFOOD**: Si tu usuario tiene `location: "DELIFOOD"` asignada, serás redirigido automáticamente al acceder a Control Horario
- **Selección Manual**: Si seleccionas una ubicación que contenga "DELIFOOD" en el selector, serás redirigido automáticamente
- **Detección**: El sistema detecta tanto "DELIFOOD" exacto como cualquier ubicación que contenga "delifood" (case-insensitive)

### Flujo de Usuario:
1. Usuario va a Control Horario (`#controlhorario`)
2. **SI** `user.location === "DELIFOOD"` **O** selecciona ubicación DELIFOOD
3. **ENTONCES** `window.location.href = '/delifood-schedule'` (redirección automática)
4. Usuario ve la interfaz especializada de DELIFOOD

### Código de Redirección:
```typescript
// En ControlHorario.tsx
useEffect(() => {
  const isDelifoodLocation = (locationValue: string) => {
    return locationValue === 'DELIFOOD' || locationValue.toLowerCase().includes('delifood');
  };

  // Redirigir si el usuario autenticado tiene ubicación DELIFOOD
  if (isAuthenticated && user?.location && isDelifoodLocation(user.location)) {
    window.location.href = '/delifood-schedule';
    return;
  }

  // Redirigir si se selecciona una ubicación DELIFOOD
  if (location && isDelifoodLocation(location)) {
    window.location.href = '/delifood-schedule';
    return;
  }
}, [isAuthenticated, user, location]);
```

## Funcionalidades Técnicas:

### Servicios Nuevos:
- `SchedulesService.updateScheduleHours()`: Método específico para actualizar horas trabajadas
- Campo `horasPorDia` opcional en la interfaz `ScheduleEntry`

### Componentes Nuevos:
- `DelifoodScheduleControl`: Componente principal del control de horarios
- `DelifoodHoursModal`: Modal para editar horas trabajadas
- Página: `/delifood-schedule`

### Características de UX:
- **Indicadores Visuales**: 
  - Verde: Días con horas registradas
  - Gris: Días sin horas registradas
  - Hoy: Resaltado con borde verde
- **Responsivo**: Funciona en desktop y móvil
- **Accesibilidad**: Navegación por teclado (Enter para guardar, Escape para cancelar)
- **Validación**: No permite valores negativos o superiores a 24 horas

## Base de Datos - Ejemplo de Registro:

```json
{
  "locationValue": "DELIFOOD",
  "employeeName": "FABIAN",
  "year": 2025,
  "month": 5,
  "day": 17,
  "shift": "L",
  "horasPorDia": 8,
  "createdAt": "2025-06-16T18:26:31Z",
  "updatedAt": "2025-06-16T18:26:31Z"
}
```

## Diferencias con Control Horario Regular:

| Característica | Control Horario Regular | DELIFOOD Horarios |
|---|---|---|
| **Turnos** | N, D, L con horarios fijos | Solo "L" con horas variables |
| **Registro** | Tipo de turno | Cantidad exacta de horas |
| **Ubicaciones** | Todas las ubicaciones | Solo DELIFOOD |
| **Flexibilidad** | Turnos predefinidos | Horas personalizadas (0-24) |
| **Cálculos** | Basado en turnos estándar | Basado en horas reales trabajadas |

Esta implementación proporciona máxima flexibilidad para DELIFOOD manteniendo la compatibilidad con el sistema existente.
