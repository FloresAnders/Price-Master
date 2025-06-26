# Exportación de Planillas Individuales en PNG

## Nueva Funcionalidad Implementada

Se ha agregado la capacidad de exportar planillas individuales como imágenes PNG, una por cada empleado.

### Características Principales

1. **Exportación Individual**: Cada empleado obtiene su propia imagen PNG con su planilla completa
2. **Nomenclatura Clara**: Los archivos se nombran como `Planilla-{Ubicacion}-{Empleado}-{Periodo}.png`
3. **Interfaz Mejorada**: Nuevo botón "PNG Individual" junto al botón de exportar CSV
4. **Progreso Visual**: Notificaciones que muestran el progreso de la exportación

### Cambios Implementados

#### Archivo: `src/components/PayrollExporter.tsx`

**Nuevas Dependencias:**
- `html2canvas`: Para generar imágenes PNG de las tablas de planillas
- `ImageIcon` de lucide-react: Para el icono del botón

**Nuevas Funciones:**
- `exportIndividualImages()`: Función principal que genera una imagen PNG por cada empleado

**Interfaz de Usuario:**
- Botón "PNG Individual" con icono de imagen
- Botones reorganizados en un contenedor flex
- Botón CSV renombrado para mayor claridad

### Flujo de Funcionamiento

1. **Usuario hace clic en "PNG Individual"**
2. **Sistema procesa cada empleado:**
   - Localiza la tabla de planilla del empleado
   - Genera imagen PNG usando html2canvas
   - Descarga automáticamente la imagen
   - Pausa 500ms entre descargas para no saturar el navegador
3. **Notificación final** con el número total de planillas exportadas

### Nombres de Archivos

Los archivos PNG se nombran siguiendo el patrón:
```
Planilla-{UbicacionLimpia}-{EmpleadoLimpio}-{PeriodoLimpio}.png
```

Donde:
- `{UbicacionLimpia}`: Nombre de ubicación sin caracteres especiales
- `{EmpleadoLimpio}`: Nombre del empleado sin caracteres especiales  
- `{PeriodoLimpio}`: Etiqueta del período sin caracteres especiales

### Ejemplo de Uso

1. Navegar a la sección de "Planilla de Pago"
2. Seleccionar el período y ubicación deseados
3. Hacer clic en el botón "PNG Individual" (icono de imagen morada)
4. Esperar a que se descarguen todas las imágenes
5. Las imágenes se guardarán en la carpeta de descargas del navegador

### Ventajas de esta Implementación

- **Individualización**: Cada empleado recibe su planilla por separado
- **Formato Visual**: Imágenes PNG fáciles de compartir e imprimir
- **Nomenclatura Organizada**: Archivos fáciles de identificar y organizar
- **Proceso Automatizado**: Un solo clic genera todas las planillas
- **Compatibilidad**: Funciona en todos los navegadores modernos

### Consideraciones Técnicas

- Las imágenes se generan en el lado del cliente usando html2canvas
- Calidad de imagen optimizada para legibilidad
- Gestión de memoria eficiente con limpieza de recursos
- Control de flujo para evitar saturar el navegador

### Requisitos

- html2canvas instalado como dependencia del proyecto
- Navegador moderno con soporte para canvas y descargas automáticas
- JavaScript habilitado
