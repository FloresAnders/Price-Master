# Navegación con Teclado en Selección de Sorteos

## Nueva Funcionalidad Implementada

Se ha agregado navegación completa con teclado para la selección de sorteos en el modal de códigos, permitiendo una experiencia más fluida y accesible.

## Características de la Navegación

### Controles de Teclado
- **Flecha Arriba (↑)**: Mueve hacia arriba en la misma columna
- **Flecha Abajo (↓)**: Mueve hacia abajo en la misma columna  
- **Flecha Izquierda (←)**: Mueve hacia el sorteo anterior
- **Flecha Derecha (→)**: Mueve hacia el sorteo siguiente
- **Enter**: Selecciona el sorteo resaltado y enfoca el input de monto

### Indicadores Visuales

#### Estados de Sorteo
1. **Normal**: Fondo gris claro, texto normal
2. **Seleccionado**: Fondo azul (`#3b82f6`), texto blanco, borde azul
3. **Navegación con Teclado**: Fondo amarillo (`#fbbf24`), texto blanco, borde amarillo

#### Ayuda Visual
- **Tooltip informativo**: Muestra "💡 Usa las flechas ↑↓←→ para navegar y Enter para seleccionar"
- **Posición**: Centrado debajo del título del código

## Comportamiento del Sistema

### Lógica de Navegación en Grid
- **Columnas**: 2 en pantallas pequeñas, 3 en pantallas grandes (lg+)
- **Navegación vertical**: Salta en incrementos del número de columnas
- **Navegación horizontal**: Se mueve de uno en uno
- **Límites**: Respeta los bordes del grid, no permite salirse

### Estados y Reseteo
- **Al abrir modal**: `selectedSorteoIndex` se resetea a `-1`
- **Al navegar**: Se actualiza tanto el índice como `selectedSorteo`
- **Al hacer clic**: Se sincroniza el índice con la selección manual

## Flujo de Usuario

### Navegación por Teclado
1. Usuario abre modal de código (ej: digita "NNN")
2. Ve la cuadrícula de sorteos NICA disponibles
3. Usa flechas para navegar entre opciones
4. Ve resaltado amarillo en el sorteo actual
5. Presiona Enter para seleccionar
6. Se enfoca automáticamente el input de monto
7. Continúa con el flujo normal

### Navegación por Mouse (sin cambios)
1. Usuario hace clic en sorteo deseado
2. Se actualiza la navegación por teclado al elemento clickeado
3. Se enfoca el input de monto
4. Continúa con el flujo normal

## Implementación Técnica

### Estados Agregados
```tsx
const [selectedSorteoIndex, setSelectedSorteoIndex] = useState(-1);
```

### Eventos de Teclado
```tsx
useEffect(() => {
    if (!showCodeModal) return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
        // Lógica de navegación con switch/case
        // Manejo de ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Enter
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
}, [showCodeModal, selectedSorteoIndex]);
```

### Cálculo de Posición en Grid
- **Arriba**: `currentIndex - numCols` (si >= numCols)
- **Abajo**: `currentIndex + numCols` (si < total - numCols)
- **Izquierda**: `currentIndex - 1` (si > 0)
- **Derecha**: `currentIndex + 1` (si < total - 1)

### Renderizado con Estados Visuales
```tsx
{getFilteredSorteos().map((sorteo, index) => {
    const isSelected = selectedSorteo === sorteo.name;
    const isKeyboardFocused = selectedSorteoIndex === index;
    
    return (
        <button
            className={/* clases dinámicas según estado */}
            style={/* estilos dinámicos según estado */}
            onClick={/* actualiza ambos estados */}
        >
            {sorteo.name}
        </button>
    );
})}
```

## Beneficios de Usabilidad

### Accesibilidad
- ✅ **Navegación sin mouse**: Completamente operacional con teclado
- ✅ **Indicadores visuales claros**: Distinción entre seleccionado y enfocado
- ✅ **Feedback inmediato**: Cambios visuales instantáneos
- ✅ **Instrucciones claras**: Tooltip con controles

### Eficiencia
- ✅ **Navegación rápida**: Flechas más rápidas que clicks múltiples
- ✅ **Flujo continuo**: Enter para seleccionar y continuar
- ✅ **Menos movimiento de mouse**: Ideal para uso intensivo
- ✅ **Consistencia**: Comportamiento estándar de navegación

### Experiencia de Usuario
- ✅ **Intuitivo**: Flechas funcionan como se espera
- ✅ **Visual**: Resaltado amarillo distintivo
- ✅ **Forgiving**: Navegación respeta límites
- ✅ **Híbrido**: Mouse y teclado funcionan juntos

## Casos de Uso Optimizados

### Usuario Power (Teclado)
1. Digita código rápidamente
2. Navega con flechas sin levantar manos del teclado
3. Enter para seleccionar
4. Digita monto inmediatamente
5. Enter para agregar ticket

### Usuario Casual (Mouse)
1. Digita código o usa input móvil
2. Hace clic en sorteo deseado
3. Digita monto
4. Clic en "Agregar"

### Usuario Mixto
1. Navega con flechas para explorar opciones
2. Hace clic en la opción final
3. Continúa con teclado o mouse según preferencia

## Compatibilidad

- ✅ **Responsive**: Funciona en 2 y 3 columnas
- ✅ **Navegadores**: Todos los navegadores modernos
- ✅ **Dispositivos**: PC, laptop con teclado
- ✅ **Accesibilidad**: Compatible con lectores de pantalla
- ✅ **Performance**: No impacto en rendimiento

La navegación con teclado mejora significativamente la experiencia de usuario para operadores que necesitan trabajar rápidamente con múltiples sorteos.
