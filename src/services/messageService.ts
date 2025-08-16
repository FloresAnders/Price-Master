// src/services/messageService.ts
export interface Message {
  id: string;
  text: string;
  sender: string;
  senderUserId?: string;
  timestamp: number;
  time: string;
  read: boolean;
}

export interface MessageNotification {
  count: number;
  lastMessage?: Message;
}

const MESSAGES_STORAGE_KEY = 'pricemaster_messages';

class MessageService {
  private listeners: Set<(messages: Message[]) => void> = new Set();
  private notificationListeners: Set<(notification: MessageNotification) => void> = new Set();

  /**
   * Obtiene todos los mensajes del localStorage
   */
  getMessages(): Message[] {
    try {
      const messages = localStorage.getItem(MESSAGES_STORAGE_KEY);
      return messages ? JSON.parse(messages) : [];
    } catch (error) {
      console.error('Error obteniendo mensajes:', error);
      return [];
    }
  }

  /**
   * Guarda los mensajes en localStorage
   */
  private saveMessages(messages: Message[]): void {
    try {
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
      this.notifyListeners(messages);
      this.notifyNotificationListeners();
    } catch (error) {
      console.error('Error guardando mensajes:', error);
    }
  }

  /**
   * Envía un nuevo mensaje
   */
  sendMessage(text: string, sender: string, senderUserId?: string): Message {
    const newMessage: Message = {
      id: this.generateMessageId(),
      text: text.trim(),
      sender,
      senderUserId,
      timestamp: Date.now(),
      time: new Date().toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      read: false
    };

    const messages = this.getMessages();
    messages.push(newMessage);
    this.saveMessages(messages);

    // Simular notificación a otros usuarios
    this.simulateStorageEvent();

    return newMessage;
  }

  /**
   * Marca un mensaje como leído
   */
  markMessageAsRead(messageId: string): void {
    const messages = this.getMessages();
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    
    if (messageIndex !== -1) {
      messages[messageIndex].read = true;
      this.saveMessages(messages);
    }
  }

  /**
   * Marca todos los mensajes como leídos
   */
  markAllAsRead(): void {
    const messages = this.getMessages();
    const updatedMessages = messages.map(msg => ({ ...msg, read: true }));
    this.saveMessages(updatedMessages);
  }

  /**
   * Obtiene el número de mensajes no leídos
   */
  getUnreadCount(): number {
    const messages = this.getMessages();
    return messages.filter(msg => !msg.read).length;
  }

  /**
   * Obtiene información de notificaciones
   */
  getNotificationInfo(): MessageNotification {
    const messages = this.getMessages();
    const unreadMessages = messages.filter(msg => !msg.read);
    
    return {
      count: unreadMessages.length,
      lastMessage: unreadMessages[unreadMessages.length - 1]
    };
  }

  /**
   * Suscribe un listener para cambios en mensajes
   */
  onMessagesChange(listener: (messages: Message[]) => void): () => void {
    this.listeners.add(listener);
    
    // Ejecutar inmediatamente con los mensajes actuales
    listener(this.getMessages());

    // Retornar función de limpieza
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Suscribe un listener para notificaciones
   */
  onNotificationChange(listener: (notification: MessageNotification) => void): () => void {
    this.notificationListeners.add(listener);
    
    // Ejecutar inmediatamente con la notificación actual
    listener(this.getNotificationInfo());

    // Retornar función de limpieza
    return () => {
      this.notificationListeners.delete(listener);
    };
  }

  /**
   * Notifica a todos los listeners sobre cambios en mensajes
   */
  private notifyListeners(messages: Message[]): void {
    this.listeners.forEach(listener => {
      try {
        listener(messages);
      } catch (error) {
        console.error('Error en listener de mensajes:', error);
      }
    });
  }

  /**
   * Notifica a todos los listeners sobre cambios en notificaciones
   */
  private notifyNotificationListeners(): void {
    const notification = this.getNotificationInfo();
    this.notificationListeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        console.error('Error en listener de notificaciones:', error);
      }
    });
  }

  /**
   * Simula un evento de storage para notificar a otras pestañas/ventanas
   */
  private simulateStorageEvent(): void {
    // Simular cambio en localStorage para notificar a otras instancias
    setTimeout(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: MESSAGES_STORAGE_KEY,
        newValue: localStorage.getItem(MESSAGES_STORAGE_KEY),
        storageArea: localStorage
      }));
    }, 10);
  }

  /**
   * Genera un ID único para el mensaje
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Limpia todos los mensajes (útil para desarrollo)
   */
  clearAllMessages(): void {
    localStorage.removeItem(MESSAGES_STORAGE_KEY);
    this.notifyListeners([]);
    this.notifyNotificationListeners();
  }

  /**
   * Inicializa el servicio y configura listeners de storage
   */
  init(): void {
    // Escuchar cambios en localStorage desde otras pestañas/ventanas
    window.addEventListener('storage', (event) => {
      if (event.key === MESSAGES_STORAGE_KEY) {
        const messages = this.getMessages();
        this.notifyListeners(messages);
        this.notifyNotificationListeners();
      }
    });
  }
}

// Crear una instancia singleton
const messageService = new MessageService();

// Inicializar el servicio
if (typeof window !== 'undefined') {
  messageService.init();
}

export default messageService;
