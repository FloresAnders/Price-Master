# Sistema de Chat Integrado

## 📝 Descripción

Se ha agregado un sistema de chat global y privado al proyecto Price Master. El chat incluye:

- **Chat Global**: Todos los usuarios autenticados pueden participar
- **Chat Privado**: Conversaciones uno a uno entre usuarios
- **Botón flotante**: Acceso rápido desde cualquier parte de la aplicación
- **Indicadores de presencia**: Muestra usuarios en línea/fuera de línea
- **Interfaz responsiva**: Funciona tanto en móvil como en escritorio

## 🚀 Características Implementadas

### ✅ Funcionalidades Activas

- **Botón flotante global** posicionado a mitad de altura en el lado derecho
- **Pulsación inteligente**: Solo cuando hay mensajes no leídos
- **Disponible globalmente** en todas las páginas de la aplicación
- **Chat Global** - todos los usuarios pueden participar
- **Chat Privado** - conversaciones uno a uno
- **Ventana minimizable/maximizable**
- **Lista de usuarios en línea** con indicadores de estado
- **Auto-scroll** a mensajes nuevos
- **Envío con Enter** y botón de envío
- **Formato de hora** en mensajes
- **Contador de mensajes no leídos** con animación de rebote
- **Detección automática** de mensajes nuevos cuando el chat está cerrado
- **Marcado automático** como leído al abrir el chat
- **Diseño completamente responsive**
- **Efectos visuales y hover mejorados**

### 🎯 Sistema de Notificaciones

#### Comportamiento del Botón:
- **Sin mensajes nuevos**: Botón azul normal sin animaciones
- **Con mensajes nuevos**: 
  - Pulsación suave (`animate-pulse`) del botón completo
  - Indicador rojo con número de mensajes no leídos
  - Animación de rebote (`animate-bounce`) en el contador
  - Efecto de ping (`animate-ping`) en el fondo del botón

#### Detección de Mensajes No Leídos:
- Se consideran "nuevos" los mensajes recibidos después de la última vez que se abrió el chat
- Solo cuenta mensajes de otros usuarios (no los propios)
- Se resetea automáticamente al abrir el chat
- Funciona tanto para chat global como privado

### 🔧 Datos Mock Actuales
El sistema actualmente usa datos simulados para demostración:
- 3 usuarios de ejemplo
- Mensajes almacenados en estado local
- Simulación de usuarios en línea/fuera de línea

## 🏗️ Arquitectura

### Componentes Creados
```
src/
├── components/
│   └── ChatSystem.tsx          # Componente principal del chat
├── hooks/
│   ├── useChatMessages.ts      # Hook para gestión de mensajes
│   ├── useChatUsers.ts         # Hook para gestión de usuarios
│   └── index.ts                # Exportaciones centralizadas
└── types/
    └── chat.ts                 # Tipos TypeScript para el chat
```

### Integración
- El chat se agregó al componente `CashCounterTabs.tsx`
- Posicionamiento fixed para estar disponible globalmente
- Z-index alto para estar sobre otros elementos

## 🔮 Integración con Firebase (Siguiente Paso)

### Colecciones Firestore Necesarias

#### 1. `chat_messages`
```typescript
{
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Timestamp;
  type: 'global' | 'private';
  recipientId?: string;
  recipientName?: string;
  createdAt: string;
}
```

#### 2. `chat_users`
```typescript
{
  id: string; // Mismo ID que en users collection
  name: string;
  role: 'admin' | 'user' | 'superadmin';
  lastSeen: Timestamp;
  updatedAt: string;
}
```

### Reglas de Seguridad Firebase
```javascript
// Reglas para chat_messages
match /chat_messages/{messageId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null 
    && request.auth.uid == resource.data.senderId;
  allow update, delete: if false; // Los mensajes no se editan
}

// Reglas para chat_users
match /chat_users/{userId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null 
    && request.auth.uid == userId;
}
```

### Pasos para Activar Firebase

1. **Actualizar ChatSystem.tsx**:
   ```typescript
   // Reemplazar:
   const { messages, users, sendMessage } = useMockChatData();
   
   // Con:
   const { user, isAuthenticated } = useAuth();
   const { messages, sendMessage } = useChatMessages(
     activeTab === 'global' ? 'global' : selectedUser?.id || '', 
     user?.id
   );
   const { users, updateUserPresence } = useChatUsers();
   ```

2. **Configurar hooks de Firebase** (ya están creados):
   - `useChatMessages.ts` - Listo para Firebase
   - `useChatUsers.ts` - Listo para Firebase

3. **Agregar índices en Firestore**:
   ```
   Colección: chat_messages
   Campos: type (Ascending), timestamp (Ascending)
   
   Colección: chat_users  
   Campos: name (Ascending)
   ```

## 🎨 Personalización de Estilos

El chat utiliza variables CSS para temas:
- `--card-bg`: Fondo de la ventana del chat
- `--input-bg`: Fondo de inputs y mensajes
- `--foreground`: Color de texto principal
- `--button-hover`: Color de hover para botones

## 📱 Uso

1. **Abrir Chat**: Click en el botón flotante azul (💬)
2. **Chat Global**: Tab "Global" - todos los usuarios ven los mensajes
3. **Chat Privado**: Tab "Privado" → Seleccionar usuario → Enviar mensaje
4. **Enviar Mensaje**: Escribir y presionar Enter o click en 📤
5. **Minimizar**: Click en el ícono ⬇️
6. **Cerrar**: Click en la X

## 🚧 Próximas Mejoras

### Funcionalidades Pendientes
- [ ] Notificaciones push
- [ ] Emoji picker
- [ ] Compartir archivos/imágenes
- [ ] Mensajes de voz
- [ ] Grupos de chat
- [ ] Búsqueda en historial
- [ ] Cifrado end-to-end
- [ ] Estados de lectura (leído/no leído)

### Optimizaciones
- [ ] Paginación de mensajes antiguos
- [ ] Caché local con IndexedDB
- [ ] Compresión de imágenes
- [ ] Rate limiting
- [ ] Moderación automática

## 🔒 Consideraciones de Seguridad

- Los mensajes se almacenan en Firestore con reglas de seguridad
- Solo usuarios autenticados pueden enviar/leer mensajes
- Los mensajes privados solo son visibles para sender/recipient
- Validación de contenido en el cliente y servidor
- Rate limiting para prevenir spam

## 📊 Monitoreo

Para producción, considerar agregar:
- Analytics de uso del chat
- Métricas de mensajes por usuario
- Detección de contenido inapropiado
- Logs de moderación
- Backup automático de conversaciones

---

**Nota**: El sistema actual funciona completamente con datos mock. Para activar Firebase, seguir los pasos de integración mencionados arriba.
