'use client';
import { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, 
  Send, 
  Users, 
  User, 
  X, 
  Minimize2,
  Maximize2
} from 'lucide-react';

// Tipos para el chat
interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: 'global' | 'private';
  recipientId?: string;
  recipientName?: string;
}

interface ChatUser {
  id: string;
  name: string;
  isOnline: boolean;
  lastSeen: Date;
  role?: 'admin' | 'user' | 'superadmin';
}

// Hook simple para simular usuarios (reemplazar con Firebase más tarde)
function useMockChatData() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users] = useState<ChatUser[]>([
    {
      id: 'user1',
      name: 'Juan Pérez',
      isOnline: true,
      lastSeen: new Date(),
      role: 'admin'
    },
    {
      id: 'user2', 
      name: 'María González',
      isOnline: true,
      lastSeen: new Date(),
      role: 'user'
    },
    {
      id: 'user3',
      name: 'Carlos Jiménez',
      isOnline: false,
      lastSeen: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
      role: 'user'
    }
  ]);

  const sendMessage = (messageData: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...messageData,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  // Función para simular mensajes de otros usuarios (para testing)
  const simulateIncomingMessage = () => {
    const randomUsers = ['user1', 'user2', 'user3'];
    const randomUser = randomUsers[Math.floor(Math.random() * randomUsers.length)];
    const randomMessages = [
      '¡Hola! ¿Cómo están todos?',
      'Necesito ayuda con algo',
      'Buen día equipo',
      '¿Alguien puede revisar esto?',
      'Gracias por la información'
    ];
    const randomMessage = randomMessages[Math.floor(Math.random() * randomMessages.length)];
    
    sendMessage({
      senderId: randomUser,
      senderName: randomUser === 'user1' ? 'Juan Pérez' : randomUser === 'user2' ? 'María González' : 'Carlos Jiménez',
      content: randomMessage,
      type: 'global'
    });
  };

  // Función para limpiar mensajes
  const clearMessages = () => {
    setMessages([]);
  };

  return { messages, users, sendMessage, simulateIncomingMessage, clearMessages };
}

export default function ChatSystem() {
  // Mock user data - en producción, esto vendría del hook useAuth
  const currentUser = {
    id: 'current_user',
    name: 'Usuario Actual',
    role: 'user' as const
  };

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'private'>('global');
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messageText, setMessageText] = useState('');
  const [showUsersList, setShowUsersList] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadTime, setLastReadTime] = useState(new Date());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, users, sendMessage, simulateIncomingMessage, clearMessages } = useMockChatData();

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Contar mensajes no leídos cuando hay nuevos mensajes
  useEffect(() => {
    if (!isOpen) {
      const newMessages = messages.filter(msg => 
        msg.timestamp > lastReadTime && 
        msg.senderId !== currentUser?.id
      );
      setUnreadCount(newMessages.length);
    }
  }, [messages, lastReadTime, isOpen, currentUser?.id]);

  // Marcar mensajes como leídos cuando se abre el chat
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setLastReadTime(new Date());
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !currentUser) return;

    try {
      sendMessage({
        senderId: currentUser.id,
        senderName: currentUser.name,
        content: messageText.trim(),
        type: activeTab,
        recipientId: activeTab === 'private' ? selectedUser?.id : undefined,
        recipientName: activeTab === 'private' ? selectedUser?.name : undefined,
      });
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const onlineUsers = users.filter((u: ChatUser) => u.isOnline && u.id !== currentUser?.id);
  const filteredMessages = activeTab === 'global' 
    ? messages.filter((m: ChatMessage) => m.type === 'global')
    : messages.filter((m: ChatMessage) => 
        m.type === 'private' && 
        ((m.senderId === currentUser?.id && m.recipientId === selectedUser?.id) ||
         (m.senderId === selectedUser?.id && m.recipientId === currentUser?.id))
      );

  return (
    <>
      {/* Botón flotante para abrir el chat */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed top-1/2 -translate-y-1/2 right-4 sm:right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center shadow-xl transition-all duration-200 hover:scale-110 ${
          isOpen ? 'scale-0' : 'scale-100'
        } ${unreadCount > 0 ? 'animate-pulse' : ''}`}
        aria-label="Abrir chat"
      >
        <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
        {/* Indicador de mensajes nuevos - solo visible cuando hay mensajes no leídos */}
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center animate-bounce">
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
        {/* Indicador de pulso para llamar la atención - solo cuando hay mensajes no leídos */}
        {unreadCount > 0 && (
          <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20"></div>
        )}
      </button>

      {/* Ventana del chat */}
      {isOpen && (
        <div className={`fixed top-1/2 -translate-y-1/2 right-4 sm:right-20 z-50 bg-[var(--card-bg)] rounded-2xl shadow-2xl border border-[var(--input-border)] transition-all duration-200 ${
          isMinimized ? 'w-72 sm:w-80 h-16' : 'w-80 sm:w-96 h-[450px] sm:h-[500px]'
        }`}>
          {/* Header del chat */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--input-border)] bg-[var(--button-bg)] rounded-t-2xl">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-[var(--foreground)]">
                {activeTab === 'global' 
                  ? 'Chat Global' 
                  : selectedUser 
                    ? `Chat con ${selectedUser.name}`
                    : 'Chat Privado'
                }
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-[var(--foreground)] hover:text-gray-500"
                aria-label={isMinimized ? 'Maximizar' : 'Minimizar'}
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[var(--foreground)] hover:text-gray-500"
                aria-label="Cerrar chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Tabs del chat */}
              <div className="flex border-b border-[var(--input-border)]">
                <button
                  onClick={() => {
                    setActiveTab('global');
                    setSelectedUser(null);
                  }}
                  className={`flex-1 px-4 py-2 text-sm font-medium flex items-center justify-center space-x-1 ${
                    activeTab === 'global'
                      ? 'bg-blue-600 text-white'
                      : 'bg-[var(--input-bg)] text-[var(--foreground)] hover:bg-[var(--button-hover)]'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Global</span>
                </button>
                <button
                  onClick={() => setShowUsersList(true)}
                  className={`flex-1 px-4 py-2 text-sm font-medium flex items-center justify-center space-x-1 ${
                    activeTab === 'private'
                      ? 'bg-green-600 text-white'
                      : 'bg-[var(--input-bg)] text-[var(--foreground)] hover:bg-[var(--button-hover)]'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Privado</span>
                  {onlineUsers.length > 0 && (
                    <span className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {onlineUsers.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Lista de usuarios (para chat privado) */}
              {showUsersList && (
                <div className="absolute inset-0 bg-[var(--card-bg)] rounded-2xl z-10">
                  <div className="flex items-center justify-between p-4 border-b border-[var(--input-border)]">
                    <h4 className="font-semibold text-[var(--foreground)]">Usuarios en línea</h4>
                    <button
                      onClick={() => setShowUsersList(false)}
                      className="text-[var(--foreground)] hover:text-gray-500"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                    {onlineUsers.map((chatUser: ChatUser) => (
                      <button
                        key={chatUser.id}
                        onClick={() => {
                          setSelectedUser(chatUser);
                          setActiveTab('private');
                          setShowUsersList(false);
                        }}
                        className="w-full text-left p-3 rounded-lg bg-[var(--input-bg)] hover:bg-[var(--button-hover)] transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <div>
                            <div className="font-medium text-[var(--foreground)]">{chatUser.name}</div>
                            <div className="text-xs text-[var(--foreground)] opacity-60">
                              {chatUser.role && (
                                <span className="capitalize">{chatUser.role}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                    {onlineUsers.length === 0 && (
                      <div className="text-center text-[var(--foreground)] opacity-60 py-8">
                        No hay usuarios en línea
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Área de mensajes */}
              <div className="flex-1 p-4 space-y-3 max-h-80 overflow-y-auto">
                {false ? ( // messagesLoading
                  <div className="text-center text-[var(--foreground)] opacity-60">
                    Cargando mensajes...
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="text-center text-[var(--foreground)] opacity-60">
                    {activeTab === 'global' 
                      ? 'No hay mensajes en el chat global'
                      : selectedUser
                        ? `No hay mensajes con ${selectedUser.name}`
                        : 'Selecciona un usuario para iniciar un chat privado'
                    }
                  </div>
                ) : (
                  filteredMessages.map((message: ChatMessage) => (
                    <div
                      key={message.id}
                      className={`flex ${message.senderId === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.senderId === currentUser?.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-[var(--input-bg)] text-[var(--foreground)]'
                        }`}
                      >
                        {message.senderId !== currentUser?.id && (
                          <div className="text-xs font-medium mb-1 opacity-80">
                            {message.senderName}
                          </div>
                        )}
                        <div className="text-sm">{message.content}</div>
                        <div className="text-xs opacity-70 mt-1">
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input para escribir mensajes */}
              <div className="p-4 border-t border-[var(--input-border)]">
                {/* Botón de prueba para simular mensajes entrantes - SOLO PARA TESTING */}
                <div className="mb-2 text-center flex space-x-2 justify-center">
                  <button
                    onClick={simulateIncomingMessage}
                    className="px-2 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-xs"
                    title="Simular mensaje entrante (solo para pruebas)"
                  >
                    📨 Simular mensaje
                  </button>
                  <button
                    onClick={clearMessages}
                    className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs"
                    title="Limpiar historial de mensajes"
                  >
                    🗑️ Limpiar
                  </button>
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={
                      activeTab === 'global' 
                        ? 'Escribe un mensaje...' 
                        : selectedUser
                          ? `Mensaje para ${selectedUser.name}...`
                          : 'Selecciona un usuario primero...'
                    }
                    disabled={activeTab === 'private' && !selectedUser}
                    className="flex-1 px-3 py-2 border rounded-lg bg-[var(--input-bg)] text-[var(--foreground)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || (activeTab === 'private' && !selectedUser)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Enviar mensaje"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
