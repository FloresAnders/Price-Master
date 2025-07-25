# Feature: Agregado au## 🎯 Funcionalidad

### Flujo automático:
1. **Usuario asigna un turno** a un empleado en una fecha específica
2. **Sistema verifica** si el turno es "D" (Diurno) o "N" (Nocturno)
3. **Solo para turnos D o N**: 
   - **Sistema busca** la configuración del empleado en la base de datos de ubicaciones
   - **Sistema obtiene** el valor `hoursPerShift` del empleado (ejemplo: 8 horas)
   - **Sistema guarda** tanto el turno como las horas en el documento
4. **Para turno "L" (Libre)**: Solo se guarda el turno, sin `horasPorDia`

### Ejemplos de comportamiento:

#### ✅ Turno "D" o "N" - SE AGREGAN HORAS:
```json
{
  "locationValue": "PALMARES",
  "employeeName": "VIVIANA", 
  "year": 2025,
  "month": 5,
  "day": 29,
  "shift": "D",
  "horasPorDia": 8,  // ← AGREGADO: Solo para turnos D/N
  "createdAt": "2025-06-29T13:11:26Z",
  "updatedAt": "2025-06-29T13:11:26Z"
}
```

#### ✅ Turno "L" - NO SE AGREGAN HORAS:
```json
{
  "locationValue": "PALMARES",
  "employeeName": "VIVIANA", 
  "year": 2025,
  "month": 5,
  "day": 29,
  "shift": "L",
  // horasPorDia: NO se incluye para turnos L
  "createdAt": "2025-06-29T13:11:26Z",
  "updatedAt": "2025-06-29T13:11:26Z"
}
```Dia basado en hoursPerShift

## 📋 Descripción

Se ha implementado una funcionalidad que automáticamente agrega el campo `horasPorDia` a cada registro de horario basándose en el `hoursPerShift` configurado para cada empleado en la base de datos.

## 🔧 Cambios Implementados

### Archivo modificado: `src/services/schedules.ts`

#### 1. Función `updateScheduleShift()`
- **Antes**: Solo guardaba el turno (`shift`) sin agregar horas.
- **Ahora**: 
  - Busca automáticamente la configuración del empleado en la ubicación correspondiente
  - Obtiene el valor `hoursPerShift` del empleado
  - Agrega el campo `horasPorDia` con el valor obtenido (por defecto 8 horas si no está configurado)
  - Incluye logging para verificar que se esté agregando correctamente

#### 2. Función `updateScheduleHours()`
- **Mejora**: Se cambió `shift: ''` por `shift: 'L'` para DELIFOOD para mantener consistencia
- **Consistencia**: Mantiene el comportamiento existente pero con mejor documentación

## 🎯 Funcionalidad

### Flujo automático:
1. **Usuario asigna un turno** (N, D, L) a un empleado en una fecha específica
2. **Sistema busca** la configuración del empleado en la base de datos de ubicaciones
3. **Sistema obtiene** el valor `hoursPerShift` del empleado (ejemplo: 8 horas)
4. **Sistema guarda** tanto el turno como las horas en el documento:
   ```json
   {
     "locationValue": "PALMARES",
     "employeeName": "VIVIANA", 
     "year": 2025,
     "month": 5,
     "day": 29,
     "shift": "L",
     "horasPorDia": 8,  // ← NUEVO: Agregado automáticamente
     "createdAt": "2025-06-29T13:11:26Z",
     "updatedAt": "2025-06-29T13:11:26Z"
   }
   ```

### Casos especiales:
- **Turnos "D" y "N"**: Se agrega automáticamente `horasPorDia` basado en `hoursPerShift`
- **Turno "L" (Libre)**: Solo se guarda el turno, NO se agrega `horasPorDia`
- **Si no existe configuración del empleado**: Se usa 8 horas como valor predeterminado (solo para D/N)
- **Si hay error al obtener datos**: Se usa 8 horas como fallback y se registra warning en consola (solo para D/N)
- **Para ubicaciones DELIFOOD**: Se mantiene el comportamiento existente con `shift: 'L'` y horas específicas

## 🔍 Estructura de datos requerida

### Configuración de empleados en ubicaciones:
```typescript
interface Location {
  id?: string;
  label: string;
  value: string;
  names: string[];
  employees?: Employee[]; 
}

interface Employee {
  name: string;
  ccssType: 'TC' | 'MT';
  extraAmount?: number;
  hoursPerShift?: number; // ← Este campo se usa para horasPorDia
}
```

## 📊 Beneficios

1. **Consistencia de datos**: Todos los registros tendrán información de horas trabajadas
2. **Cálculos precisos**: Los reportes y exportaciones pueden usar datos reales de horas
3. **Flexibilidad**: Cada empleado puede tener diferentes horas por turno
4. **Compatibilidad**: No afecta registros existentes, solo mejora los nuevos
5. **Automatización**: No requiere intervención manual del usuario

## 🧪 Testing

### Escenarios de prueba:
1. ✅ **Turno "D" con hoursPerShift configurado**: Se usa el valor configurado en `horasPorDia`
2. ✅ **Turno "N" sin hoursPerShift**: Se usa valor predeterminado (8 horas) en `horasPorDia`
3. ✅ **Turno "L" (Libre)**: Solo se guarda el turno, NO se agrega `horasPorDia`
4. ✅ **Empleado no encontrado en employees[] (turnos D/N)**: Se usa valor predeterminado (8 horas)
5. ✅ **Error al consultar ubicación (turnos D/N)**: Se usa valor predeterminado (8 horas)
6. ✅ **Ubicación DELIFOOD**: Se mantiene comportamiento existente

### Logs de verificación:
```console
🔄 Adding horasPorDia for VIVIANA (D): 8 hours
🔄 Adding horasPorDia for JUAN (N): 6 hours
ℹ️ Shift "L" for MARIA: no horasPorDia added
Documento eliminado exitosamente: abc123
Error getting employee hoursPerShift, using default 8: [Error details]
```

## 🔄 Compatibilidad

- **✅ Registros existentes**: No se modifican, continúan funcionando normalmente
- **✅ Interfaz de usuario**: No requiere cambios
- **✅ DELIFOOD**: Funcionalidad específica se mantiene intacta
- **✅ Exportaciones**: Pueden usar el nuevo campo `horasPorDia` si está disponible

## 📝 Notas técnicas

- El import dinámico `await import('./locations')` previene dependencias circulares
- Se mantiene retrocompatibilidad con registros que no tengan `horasPorDia`
- Los logs ayudan a debuggear y verificar el funcionamiento correcto
- El campo es opcional en la interfaz `ScheduleEntry` para mantener compatibilidad

## 🚀 Próximos pasos sugeridos

1. **Verificar configuración**: Asegurar que todos los empleados tengan `hoursPerShift` configurado
2. **Actualizar reportes**: Modificar exportaciones para usar `horasPorDia` cuando esté disponible
3. **Migración opcional**: Considerar script para agregar `horasPorDia` a registros existentes
4. **Monitoreo**: Revisar logs para confirmar que se está aplicando correctamente
