# 📊 Guía de Acceso a Registros de Planilla

## 🎯 ¿Dónde se accede al Visualizador de Registros?

El **Visualizador de Registros de Planilla** se ha integrado como una tercera pestaña en el módulo de **Control Horario**.

### 📍 Ruta de Acceso:

1. **Desde la página principal** de Price Master
2. Hacer clic en **"Control Horario"** (ícono de reloj ⏰)
3. Una vez en el Control Horario, verás **3 pestañas** en la parte superior:
   - 🗂️ **Horarios** (azul) - Visualización de horarios de trabajo
   - 🧮 **Planilla de Pago** (verde) - Cálculo y exportación de planillas
   - 👁️ **Registros Guardados** (morado) - Visualizador de registros guardados

## 🔧 Funcionalidades del Visualizador

### ✅ **Ver Registros**
- Lista todos los empleados que tienen registros guardados
- Muestra información organizada por año, mes y quincena
- Filtra por ubicación (igual que las otras pestañas)

### 📊 **Información Mostrada**
Para cada empleado se muestra:
- **Nombre del empleado**
- **Ubicación de trabajo**
- **Historial por mes/año**:
  - Primera Quincena (días laborados, horas por día, total horas)
  - Segunda Quincena (días laborados, horas por día, total horas)
- **Fechas de creación y actualización**

### 🗑️ **Eliminar Registros**
- Botón rojo "Eliminar" para cada empleado
- Confirmación antes de eliminar
- Elimina completamente el historial del empleado

## 🚀 Flujo de Uso Completo

### 1. **Guardar Registros** (Pestaña Planilla de Pago)
```
Control Horario → Planilla de Pago → [Botón Verde] "Guardar Registro"
```

### 2. **Ver Registros Guardados** (Pestaña Registros)
```
Control Horario → Registros Guardados → Ver historial completo
```

### 3. **Eliminar Registros** (Si es necesario)
```
Control Horario → Registros Guardados → [Botón Rojo] "Eliminar"
```

## 🎨 Interfaz Visual

- **Pestaña Morada** con ícono de ojo 👁️
- **Tarjetas organizadas** por empleado
- **Colores diferenciados**:
  - Azul claro: Primera quincena
  - Verde claro: Segunda quincena
- **Notificaciones** de confirmación para todas las acciones

## 📱 Compatibilidad

- ✅ **Responsive**: Funciona en desktop, tablet y móvil
- ✅ **Tema oscuro/claro**: Se adapta al tema de la aplicación
- ✅ **Filtros**: Compatible con el selector de ubicación

---

## 🔧 Datos Técnicos

### Estructura de Datos Guardados:
```typescript
{
  employeeName: "Juan Pérez",
  locationValue: "LOCATION_1", 
  records: {
    2025: {
      7: { // Julio
        NumeroQuincena1: {
          DiasLaborados: 12,
          hoursPerDay: 8,
          totalHours: 96
        },
        NumeroQuincena2: {
          DiasLaborados: 11, 
          hoursPerDay: 8,
          totalHours: 88
        }
      }
    }
  }
}
```

### Ubicación en Firebase:
- **Colección**: `payroll-records`
- **Documento ID**: `{locationValue}-{employeeName}`
- **Actualización automática**: Cuando se guarda un nuevo registro
