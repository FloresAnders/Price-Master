"use client";

import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

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
}

let globalSocket: Socket | null = null;

export function useChatSocket(user: ChatUser | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectedUsers, setConnectedUsers] = useState<ChatUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const markAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const sendMessage = useCallback((text: string) => {
    if (globalSocket && isConnected && text.trim()) {
      globalSocket.emit("message", { text: text.trim() });
      return true;
    }
    return false;
  }, [isConnected]);

  useEffect(() => {
    console.log("🔍 useChatSocket - user:", user);
    console.log("🔍 useChatSocket - globalSocket:", globalSocket);
    
    if (user && !globalSocket) {
      console.log("🔍 useChatSocket - Iniciando conexión...");
      // Primero inicializar el endpoint HTTP
      fetch('/api/socketio')
        .then(() => {
          console.log("🔍 useChatSocket - Fetch exitoso, creando socket...");
          // Ahora conectar con Socket.IO
          globalSocket = io({
            path: "/api/socketio",
          });

          globalSocket.on("connect", () => {
            setIsConnected(true);
            globalSocket?.emit("join", user);
          });

          globalSocket.on("disconnect", () => {
            setIsConnected(false);
          });

          globalSocket.on("message", (message: Message) => {
            setMessages((prev) => [...prev, message]);
            
            // Incrementar contador de no leídos si no es nuestro mensaje
            if (message.userId !== globalSocket?.id) {
              setUnreadCount((prev) => prev + 1);
            }
          });

          globalSocket.on("connectedUsers", (users: ChatUser[]) => {
            setConnectedUsers(users);
          });

          globalSocket.on("userJoined", (userData: { name: string; timestamp: string }) => {
            setMessages((prev) => [...prev, {
              id: Date.now(),
              text: `${userData.name} se unió al chat`,
              user: "Sistema",
              userId: "system",
              timestamp: userData.timestamp
            }]);
          });

          globalSocket.on("userLeft", (userData: { name: string; timestamp: string }) => {
            setMessages((prev) => [...prev, {
              id: Date.now(),
              text: `${userData.name} salió del chat`,
              user: "Sistema",
              userId: "system",
              timestamp: userData.timestamp
            }]);
          });
        })
        .catch((error) => {
          console.error("Error al inicializar Socket.IO:", error);
        });
    }

    return () => {
      // Solo limpiar listeners, no desconectar socket
      if (globalSocket) {
        globalSocket.off("message");
        globalSocket.off("connectedUsers");
        globalSocket.off("userJoined");
        globalSocket.off("userLeft");
      }
    };
  }, [user]);

  const disconnect = useCallback(() => {
    if (globalSocket) {
      globalSocket.disconnect();
      globalSocket = null;
      setIsConnected(false);
      setMessages([]);
      setConnectedUsers([]);
      setUnreadCount(0);
    }
  }, []);

  return {
    messages,
    connectedUsers,
    isConnected,
    unreadCount,
    sendMessage,
    markAsRead,
    disconnect,
    socketId: globalSocket?.id
  };
}
