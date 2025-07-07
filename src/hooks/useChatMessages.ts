import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  where
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ChatMessage } from '../types/chat';

interface SendMessageData {
  senderId: string;
  senderName: string;
  content: string;
  type: 'global' | 'private';
  recipientId?: string;
  recipientName?: string;
}

export function useChatMessages(chatType: 'global' | string, currentUserId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let q;
    
    if (chatType === 'global') {
      // Mensajes globales
      q = query(
        collection(db, 'chat_messages'),
        where('type', '==', 'global'),
        orderBy('timestamp', 'asc')
      );
    } else if (chatType && currentUserId) {
      // Mensajes privados - obtenemos todos los mensajes privados y los filtramos en el cliente
      q = query(
        collection(db, 'chat_messages'),
        where('type', '==', 'private'),
        orderBy('timestamp', 'asc')
      );
    } else {
      setMessages([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const message: ChatMessage = {
          id: doc.id,
          senderId: data.senderId,
          senderName: data.senderName,
          content: data.content,
          timestamp: data.timestamp?.toDate() || new Date(),
          type: data.type,
          recipientId: data.recipientId,
          recipientName: data.recipientName,
        };

        // Para mensajes privados, filtrar por conversación específica
        if (chatType === 'global') {
          messagesData.push(message);
        } else if (chatType && currentUserId && message.type === 'private') {
          // Mostrar mensajes donde el usuario actual es sender o recipient
          // y el otro participante es chatType (ID del usuario seleccionado)
          if ((message.senderId === currentUserId && message.recipientId === chatType) ||
              (message.senderId === chatType && message.recipientId === currentUserId)) {
            messagesData.push(message);
          }
        }
      });
      setMessages(messagesData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching messages:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [chatType, currentUserId]);

  const sendMessage = useCallback(async (messageData: SendMessageData) => {
    try {
      await addDoc(collection(db, 'chat_messages'), {
        ...messageData,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }, []);

  return {
    messages,
    sendMessage,
    loading,
  };
}
