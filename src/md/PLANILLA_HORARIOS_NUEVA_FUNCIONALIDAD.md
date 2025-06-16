# Planilla de Horarios - Nueva Funcionalidad

## Descripción
Se ha agregado un nuevo tab "Planilla" en la sección de edición que permite visualizar el control de horarios de cada ubicación por quincenas.

## Características Implementadas

### 1. Tab de Planilla
- **Ubicación**: Nuevo tab en `src/edit/DataEditor.tsx`
- **Icono**: Reloj (Clock)
- **Funcionalidad**: Muestra planilla de horarios

### 2. Componente ScheduleReportTab
- **Archivo**: `src/components/ScheduleReportTab.tsx`
- **Funcionalidades**:
  - Visualización de horarios por ubicación
  - Navegación entre quincenas (actual y anteriores)
  - Filtro por ubicación específica o todas las ubicaciones
  - Exportación de datos en formato JSON

### 3. Funciones Principales

#### Navegación de Períodos
- **Período Actual**: Muestra la quincena actual por defecto
- **Períodos Anteriores**: Navega solo a quincenas donde hay días laborados
- **Controles**: Botones de navegación (anterior/siguiente)

#### Visualización de Datos
- **Tabla de Horarios**: Muestra empleados y sus turnos por día
- **Códigos de Turno**:
  - `D` = Día (amarillo)
  - `N` = Noche (azul)
  - `L` = Libre (gris)
- **Totales**: Contador de días laborados por empleado y ubicación

#### Filtros y Opciones
- **Selector de Ubicación**: 
  - "Todas las ubicaciones" (por defecto)
  - Ubicaciones individuales
- **Exportación**: Descarga datos en formato JSON

### 4. Estados y Lógica

#### Períodos de Quincena
```typescript
interface BiweeklyPeriod {
  start: Date;
  end: Date;
  label: string;
  year: number;
  month: number;
  period: 'first' | 'second';
}
```

#### Datos de Horarios
```typescript
interface LocationSchedule {
  location: Location;
  employees: EmployeeSchedule[];
  totalWorkDays: number;
}
```

### 5. Servicios Utilizados
- **SchedulesService**: Para obtener datos de horarios
- **LocationsService**: Para obtener ubicaciones
- **FirestoreService**: Base de datos

### 6. Características de UX

#### Estados de Carga
- Indicador de carga mientras se obtienen datos
- Mensaje cuando no hay datos disponibles

#### Responsive Design
- Tabla con scroll horizontal en pantallas pequeñas
- Layout adaptable para móviles

#### Temas
- Soporte para tema claro y oscuro
- Variables CSS para consistencia visual

### 7. Navegación de Períodos

La navegación solo permite moverse a períodos donde existen días laborados:
1. Se obtienen todos los horarios de la base de datos
2. Se identifican períodos con días trabajados (shift no vacío)
3. Se ordenan por fecha (más reciente primero)
4. Se permite navegación solo entre estos períodos

### 8. Exportación de Datos

El botón de exportar genera un archivo JSON con:
- Información del período
- Datos por ubicación
- Horarios por empleado
- Totales de días trabajados

## Uso

1. **Acceder**: Ir a la sección "Edit" y seleccionar el tab "Planilla"
2. **Filtrar**: Seleccionar ubicación específica o todas
3. **Navegar**: Usar botones para cambiar entre quincenas
4. **Exportar**: Usar botón "Exportar" para descargar datos
5. **Visualizar**: Ver horarios en formato tabla con códigos de color

## Archivos Modificados

- `src/edit/DataEditor.tsx`: Agregado nuevo tab y import
- `src/components/ScheduleReportTab.tsx`: Nuevo componente (creado)

## Archivos Relacionados

- `src/services/schedules.ts`: Servicio de horarios existente
- `src/services/locations.ts`: Servicio de ubicaciones existente
- `src/types/firestore.ts`: Tipos TypeScript existentes
