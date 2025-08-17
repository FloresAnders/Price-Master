"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface Message {
  id: number;
  text: string;
  user: string;
  userId: string;
  timestamp: string;
}

interface ChatUser {
  name: string;
  location: string;
  displayName: string;
  userId?: string;
}

export function useChatPolling(user: ChatUser | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<ChatUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  
  const lastMessageId = useRef<number>(0);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const isPollingActive = useRef(false);

  // Función para obtener o crear userId persistente
  const getUserId = useCallback(() => {
    if (!user) return null;
    
    const storageKey = `chat_userId_${user.name}_${user.location}`;
    let storedUserId = localStorage.getItem(storageKey);
    
    if (!storedUserId) {
      storedUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem(storageKey, storedUserId);
    }
    
    return storedUserId;
  }, [user]);

  const markAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Función para hacer polling
  const pollMessages = useCallback(async () => {
    if (!userId || !isPollingActive.current) return;
    
    try {
      const response = await fetch(`/api/chat-polling?lastMessageId=${lastMessageId.current}&userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
          setMessages(prev => {
            const newMessages = data.messages.filter(
              (msg: Message) => !prev.some(existingMsg => existingMsg.id === msg.id)
            );
            
            // DEBUG: Log para verificar identificación de mensajes
            newMessages.forEach((msg: Message) => {
              console.log(`🔍 Mensaje ${msg.id}: de userId "${msg.userId}", mi userId "${userId}", es mío: ${msg.userId === userId}`);
            });
            
            // Incrementar contador de no leídos
            const unreadMessages = newMessages.filter((msg: Message) => msg.userId !== userId);
            if (unreadMessages.length > 0) {
              setUnreadCount(prev => prev + unreadMessages.length);
            }
            
            const updated = [...prev, ...newMessages].sort((a, b) => a.id - b.id);
            
            // Actualizar último ID de mensaje
            if (updated.length > 0) {
              lastMessageId.current = Math.max(...updated.map(m => m.id));
            }
            
            return updated;
          });
        }
        
        if (data.connectedUsers) {
          setConnectedUsers(data.connectedUsers);
        }
        
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error('Error en polling:', error);
      setIsConnected(false);
    }
  }, [userId]);

  // Función para enviar mensaje
  const sendMessage = useCallback(async (text: string) => {
    if (!userId || !text.trim()) return false;
    
    try {
      const response = await fetch('/api/chat-polling', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'message',
          data: {
            text: text.trim(),
            user: user?.displayName || 'Usuario',
            userId: userId
          }
        })
      });
      
      if (response.ok) {
        // Hacer polling inmediato para obtener el mensaje
        setTimeout(pollMessages, 100);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      return false;
    }
  }, [userId, user, pollMessages]);

  // Función para unirse al chat
  const joinChat = useCallback(async () => {
    if (!user) return;
    
    // Obtener userId persistente
    const persistentUserId = getUserId();
    if (!persistentUserId) return;
    
    try {
      const response = await fetch('/api/chat-polling', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'join',
          data: {
            userId: persistentUserId, // Enviar el userId persistente
            name: user.name,
            location: user.location,
            displayName: user.displayName
          }
        })
      });
      
      if (response.ok) {
        // Respuesta exitosa, usar el userId persistente
        setUserId(persistentUserId);
        setIsConnected(true);
        return persistentUserId;
      }
    } catch (error) {
      console.error('Error uniéndose al chat:', error);
      setIsConnected(false);
    }
  }, [user, getUserId]);

  // Establecer userId persistente cuando hay usuario
  useEffect(() => {
    if (user && !userId) {
      const persistentUserId = getUserId();
      console.log('🔍 Chat - Estableciendo userId persistente:', persistentUserId);
      if (persistentUserId) {
        setUserId(persistentUserId);
      }
    }
  }, [user, userId, getUserId]);

  // Inicializar polling cuando hay usuario
  useEffect(() => {
    if (user && userId && !isConnected) {
      joinChat();
    }
  }, [user, userId, isConnected, joinChat]);

  // Configurar polling
  useEffect(() => {
    if (userId && isConnected) {
      isPollingActive.current = true;
      
      // Polling cada 2 segundos
      pollingInterval.current = setInterval(pollMessages, 2000);
      
      // Polling inicial
      pollMessages();
      
      return () => {
        isPollingActive.current = false;
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
        }
      };
    }
  }, [userId, isConnected, pollMessages]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      // Solo limpiar polling, no enviar mensaje de salida
      isPollingActive.current = false;
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    // Solo desconectar localmente, sin enviar mensaje al servidor
    setIsConnected(false);
    setMessages([]);
    setConnectedUsers([]);
    setUnreadCount(0);
    // No limpiar el userId aquí para mantener la persistencia
    isPollingActive.current = false;
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
  }, []);

  // Función para limpiar completamente el usuario (logout real)
  const clearUserData = useCallback(async () => {
    if (user && userId) {
      console.log('🔍 Iniciando logout para:', user.displayName);
      
      // Agregar mensaje de logout inmediatamente al estado local
      const logoutMessage = {
        id: Date.now(),
        text: `${user.displayName} salió del chat`,
        user: "Sistema",
        userId: "system",
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, logoutMessage]);
      
      // Enviar mensaje de logout al servidor (para otros usuarios)
      try {
        const response = await fetch('/api/chat-polling', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'logout',
            data: { userId }
          })
        });
        
        console.log('🔍 Logout enviado, respuesta:', response.ok);
        
      } catch (error) {
        console.error('Error en logout:', error);
      }
      
      // Esperar un poco para que se vea el mensaje antes de limpiar
      setTimeout(() => {
        console.log('🔍 Limpiando datos del usuario');
        // Limpiar localStorage
        const storageKey = `chat_userId_${user.name}_${user.location}`;
        localStorage.removeItem(storageKey);
        setUserId(null);
        disconnect();
      }, 2000); // Esperar 2 segundos antes de desconectar
      
    } else {
      disconnect();
    }
  }, [user, userId, disconnect]);

  return {
    messages,
    connectedUsers,
    isConnected,
    unreadCount,
    sendMessage,
    markAsRead,
    disconnect,
    clearUserData,
    userId
  };
}
