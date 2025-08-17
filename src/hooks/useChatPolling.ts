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
    
    try {
      const response = await fetch('/api/chat-polling', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'join',
          data: {
            name: user.name,
            location: user.location,
            displayName: user.displayName
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserId(data.userId);
        setIsConnected(true);
        return data.userId;
      }
    } catch (error) {
      console.error('Error uniéndose al chat:', error);
      setIsConnected(false);
    }
  }, [user]);

  // Función para salir del chat
  const leaveChat = useCallback(async () => {
    if (!userId) return;
    
    try {
      await fetch('/api/chat-polling', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'leave',
          data: { userId }
        })
      });
    } catch (error) {
      console.error('Error saliendo del chat:', error);
    }
  }, [userId]);

  // Inicializar polling cuando hay usuario
  useEffect(() => {
    if (user && !userId) {
      joinChat();
    }
  }, [user, userId, joinChat]);

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
      leaveChat();
      isPollingActive.current = false;
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [leaveChat]);

  const disconnect = useCallback(() => {
    leaveChat();
    setIsConnected(false);
    setMessages([]);
    setConnectedUsers([]);
    setUnreadCount(0);
    setUserId(null);
    isPollingActive.current = false;
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
  }, [leaveChat]);

  return {
    messages,
    connectedUsers,
    isConnected,
    unreadCount,
    sendMessage,
    markAsRead,
    disconnect,
    userId
  };
}
