# Input Móvil para Códigos de Tiempo

## Nueva Funcionalidad Implementada

Se ha agregado una nueva funcionalidad que detecta automáticamente si el usuario está en un dispositivo móvil y le proporciona un input específico para digitar códigos de tiempo.

## Características de la Funcionalidad

### Detección Automática de Dispositivos
- **Detección por User Agent**: Identifica dispositivos Android, iPhone, iPad, iPod, BlackBerry, IE Mobile, Opera Mini
- **Detección por Tamaño de Pantalla**: Considera móvil si el ancho de pantalla es ≤ 768px
- **Responsivo**: Se actualiza automáticamente al redimensionar la pantalla

### Input Móvil
- **Ubicación**: Aparece debajo del campo "Nombre de la persona"
- **Campo de texto**: 
  - Máximo 3 caracteres
  - Convierte automáticamente a mayúsculas
  - Placeholder con códigos válidos
  - Focus ring azul para accesibilidad

- **Botón "OK"**: 
  - Se habilita solo cuando hay texto
  - Estilo azul consistente con el tema
  - Procesa el código ingresado

### Validación de Códigos
- **Códigos Válidos**: T11, T10, NNN, TTT
- **Validación**: Verifica que el código sea exactamente uno de los válidos
- **Feedback**: Muestra toast de advertencia si el código es inválido
- **Limpieza**: Limpia el input automáticamente después de éxito

### Indicadores Visuales

#### En Dispositivos Móviles
- **Ícono de smartphone** en el label del input
- **Texto de ayuda** con códigos válidos y sus significados
- **Campo dedicado** para digitar códigos

#### En PC/Desktop
- **Ícono de computadora** con instrucciones para escribir directamente
- **Buffer visual** que muestra las teclas siendo escritas
- **Detección automática** de códigos al escribir

## Comportamiento por Dispositivo

### Móvil (Smartphones/Tablets)
```
Usuario ve:
├── Input "Nombre de la persona"
├── Input "Código de tiempo (móvil)" con ícono 📱
│   ├── Campo de texto (T11, T10, NNN, TTT)
│   ├── Botón "OK"
│   └── Texto de ayuda con códigos válidos
└── Resto de la interfaz
```

### Desktop/PC
```
Usuario ve:
├── Input "Nombre de la persona"
├── Indicador "💻 Modo PC: Escribe códigos directamente"
├── Buffer visual (cuando escribe)
└── Resto de la interfaz
```

## Funciones Implementadas

### `checkIfMobile()`
- Detecta tipo de dispositivo
- Se ejecuta al cargar y al redimensionar
- Actualiza el estado `isMobile`

### `handleMobileCodeSubmit()`
- Valida código ingresado
- Abre modal de sorteos si es válido
- Muestra error si es inválido
- Limpia el input después del proceso

### `handleMobileCodeKeyDown()`
- Maneja la tecla Enter en el input móvil
- Ejecuta la validación cuando se presiona Enter

## Códigos Válidos y Sus Significados

| Código | Significado | Filtro de Sorteos |
|--------|-------------|-------------------|
| T11 | TIEMPOS (COMODIN) | Todos excepto TICA, NICA, ANGUILA |
| T10 | TIEMPOS (ANGUILA) | Solo sorteos con "anguila" |
| NNN | TIEMPOS (NICA) | Solo sorteos con "nica" (no dominicana) |
| TTT | TIEMPOS (TICA) | Solo sorteos con "tica" |

## Experiencia de Usuario

### Flujo en Móvil
1. Usuario abre la aplicación en móvil
2. Ve automáticamente el input para códigos
3. Digita código (ej: "T11")
4. Presiona "OK" o Enter
5. Se abre modal con sorteos filtrados
6. Continúa con el flujo normal

### Flujo en Desktop
1. Usuario abre la aplicación en PC
2. Ve indicador de modo PC
3. Escribe directamente en teclado (ej: "T11")
4. Ve buffer visual mientras escribe
5. Se abre modal automáticamente al completar código
6. Continúa con el flujo normal

## Beneficios

- **Accesibilidad**: Funciona en todos los dispositivos
- **Usabilidad**: Interface optimizada para cada tipo de dispositivo
- **Consistencia**: Misma funcionalidad, diferente interface
- **Feedback**: Indicadores claros en cada modo
- **Eficiencia**: Método más rápido según el dispositivo

## Tecnologías Utilizadas

- **React Hooks**: useState, useEffect para estado y detección
- **CSS Responsive**: Tailwind para diseño adaptativo
- **Detección de Dispositivos**: Navigator API y media queries
- **Validación**: Verificación de códigos en tiempo real
- **Toast Notifications**: Feedback de errores y éxitos

## Compatibilidad

- ✅ **Móviles**: Android, iOS (Safari, Chrome, Firefox)
- ✅ **Tablets**: iPad, Android tablets
- ✅ **Desktop**: Windows, macOS, Linux
- ✅ **Navegadores**: Chrome, Firefox, Safari, Edge
- ✅ **Responsive**: Todas las resoluciones de pantalla
