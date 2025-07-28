# 🔐 Sistema de Sesión con Contador Flotante - Backdoor

## 📝 Descripción

Se ha implementado un sistema de sesión con expiración automática de **5 horas** y un **contador flotante interactivo** para el área de backdoor de la aplicación Price Master.

## ✨ Características Implementadas

### ⏰ **Contador Flotante Interactivo**
- **Posición:** Flotante, draggable y personalizable
- **Estados visuales:** Normal (azul), Advertencia (amarillo), Crítico (rojo)
- **Animaciones:** Pulsos y efectos hover suaves
- **Persistencia:** Recuerda posición y estado minimizado

### 🎨 **Estados Visuales**
- **🟦 Normal (>30min):** Azul, estado tranquilo
- **🟨 Advertencia (≤30min):** Amarillo, pulso suave de alerta
- **🟥 Crítico (≤5min):** Rojo, pulso intenso y mensaje urgente

### �️ **Interacciones**
- **Arrastreable:** Clic y arrastra para mover
- **Minimizable:** Botón para colapsar a ícono
- **Ocultable:** Botón X para ocultar completamente
- **Restaurable:** Botón flotante para volver a mostrar

### 💾 **Persistencia Local**
- Posición guardada en localStorage
- Estado minimizado recordado
- Configuración persistente entre sesiones

## 🛠️ Archivos Nuevos/Modificados

### 📁 **Nuevos Archivos**
- `src/components/SessionCounter.tsx` - Contador flotante interactivo
- `src/utils/session.ts` - Utilidades centralizadas para manejo de sesión

### 📁 **Archivos Modificados**
- `src/app/login/page.tsx` - Implementación de sesión con expiración
- `src/app/backdoor/page.tsx` - Integración del contador flotante

## 🎯 **Características del Contador**

### 📊 **Información Mostrada**
```
┌─────────────────────────────┐
│ ✓ Sesión activa        [-][×]│
│ 4h 30m 15s                  │
│ 5h máximo                   │
└─────────────────────────────┘
```

### 🔴 **Estado Crítico**
```
┌─────────────────────────────┐
│ ! SESIÓN CRÍTICA       [-][×]│
│ 3m 25s                      │
│ Guarda tu trabajo           │
└─────────────────────────────┘
```

### 📏 **Estado Minimizado**
```
┌───┐
│ 🕐 │
└───┘
```

## ⚙️ **Funcionalidades Técnicas**

### 🔧 **Props del Componente**
```typescript
interface SessionCounterProps {
  onExpired?: () => void;    // Callback cuando expira
  onHide?: () => void;       // Callback cuando se oculta
}
```

### 📍 **Control de Posición**
- Drag & Drop con offset calculation
- Boundaries de pantalla respetados
- Posición guardada en localStorage

### 🎨 **Sistema de Estilos**
- Gradientes dinámicos según estado
- Backdrop blur y transparencias
- Animaciones CSS optimizadas
- Responsive y accesible

## 🚀 **Comportamiento en Tiempo Real**

1. **Inicio de sesión:**
   - Contador aparece automáticamente
   - Posición por defecto: esquina superior derecha
   - Estado: Normal (azul)

2. **Durante la sesión:**
   - Actualización cada segundo
   - Cambio de color automático según tiempo restante
   - Animaciones de pulso en estados de alerta

3. **Estados de alerta:**
   - **30min restantes:** Cambia a amarillo con pulso suave
   - **5min restantes:** Cambia a rojo con pulso intenso
   - **Mensajes contextuales:** "Considera renovar", "Guarda tu trabajo"

4. **Al expirar:**
   - Desaparece automáticamente
   - Limpieza de localStorage
   - Redirección a login

## 🎮 **Controles de Usuario**

### �️ **Interacciones Disponibles**
- **Arrastrar:** Clic y mantener para mover
- **Minimizar:** Botón [-] para colapsar
- **Ocultar:** Botón [×] para cerrar
- **Restaurar:** Botón flotante 🕐 en esquina inferior derecha

### ⌨️ **Accesibilidad**
- Tooltips informativos
- Contraste alto en estado crítico
- Tamaños de botón accesibles
- Estados de hover claros

## 🔒 **Seguridad y Performance**

### 🛡️ **Seguridad**
- Verificación continua cada segundo
- Limpieza automática al expirar
- No almacena datos sensibles
- Manejo seguro de callbacks

### ⚡ **Performance**
- Actualizaciones optimizadas con useEffect
- CSS animations en GPU
- Debounce en drag operations
- Cleanup automático de eventos

---

✅ **Estado:** Implementado y funcionando  
🎨 **UI/UX:** Contador flotante interactivo  
⏰ **Tiempo real:** Actualización cada segundo  
💾 **Persistencia:** Posición y estado guardados  
🎯 **Estados:** Normal, Advertencia, Crítico  
�️ **Interactivo:** Draggable, minimizable, ocultable
