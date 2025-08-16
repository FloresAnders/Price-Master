"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

interface Message {
  id: number;
  text: string;
  user: string;
  userId: string;
  timestamp: string;
}

interface User {
  name: string;
  email: string;
}

interface ChatRoomProps {
  user: User;
  onLogout: () => void;
}

let socket: Socket;

export default function ChatRoom({ user, onLogout }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll al último mensaje
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Inicializar socket
    socket = io({
      path: "/api/socketio",
    });

    // Eventos de conexión
    socket.on("connect", () => {
      console.log("✅ Conectado al servidor");
      setIsConnected(true);
      socket.emit("join", user);
    });

    socket.on("disconnect", () => {
      console.log("❌ Desconectado del servidor");
      setIsConnected(false);
    });

    // Eventos de mensajes
    socket.on("message", (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Eventos de usuarios
    socket.on("connectedUsers", (users: User[]) => {
      setConnectedUsers(users);
    });

    socket.on("userJoined", (userData: { name: string; timestamp: string }) => {
      setMessages((prev) => [...prev, {
        id: Date.now(),
        text: `${userData.name} se unió al chat`,
        user: "Sistema",
        userId: "system",
        timestamp: userData.timestamp
      }]);
    });

    socket.on("userLeft", (userData: { name: string; timestamp: string }) => {
      setMessages((prev) => [...prev, {
        id: Date.now(),
        text: `${userData.name} salió del chat`,
        user: "Sistema",
        userId: "system",
        timestamp: userData.timestamp
      }]);
    });

    // Eventos de typing
    socket.on("userTyping", ({ userName, isTyping: typing }) => {
      if (typing) {
        setTypingUsers((prev) => [...prev.filter(u => u !== userName), userName]);
      } else {
        setTypingUsers((prev) => prev.filter(u => u !== userName));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const sendMessage = () => {
    if (input.trim() && socket) {
      socket.emit("message", { text: input.trim() });
      setInput("");
      handleStopTyping();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing", true);
    }

    // Reiniciar el timeout de typing
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 1000);
  };

  const handleStopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      socket.emit("typing", false);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="h-screen flex">
      {/* Sidebar de usuarios conectados */}
      <div className="w-64 bg-gray-800 text-white p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Chat en Vivo</h2>
          <div className="flex items-center mt-2">
            <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className="text-sm">{isConnected ? 'Conectado' : 'Desconectado'}</span>
          </div>
        </div>

        <div className="mb-4 p-3 bg-gray-700 rounded">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="text-xs text-gray-300">{user.email}</p>
          <button 
            onClick={onLogout}
            className="mt-2 text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
          >
            Cerrar Sesión
          </button>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">
            Usuarios Conectados ({connectedUsers.length})
          </h3>
          <div className="space-y-1">
            {connectedUsers.map((connectedUser, index) => (
              <div key={index} className="text-sm p-2 bg-gray-700 rounded">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                  {connectedUser.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat principal */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b p-4">
          <h1 className="text-xl font-semibold">Mensajería Global</h1>
          <p className="text-sm text-gray-600">Mensajes en tiempo real</p>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div className="space-y-3">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`flex ${message.userId === socket?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                  message.userId === "system" 
                    ? 'bg-yellow-100 text-yellow-800 text-sm italic text-center'
                    : message.userId === socket?.id 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white border'
                }`}>
                  {message.userId !== "system" && message.userId !== socket?.id && (
                    <p className="text-xs text-gray-500 mb-1">{message.user}</p>
                  )}
                  <p className="text-sm">{message.text}</p>
                  <p className={`text-xs mt-1 ${
                    message.userId === socket?.id ? 'text-blue-100' : 'text-gray-400'
                  }`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))}
            
            {/* Indicador de usuarios escribiendo */}
            {typingUsers.length > 0 && (
              <div className="flex justify-start">
                <div className="bg-gray-200 px-3 py-2 rounded-lg">
                  <p className="text-sm text-gray-600 italic">
                    {typingUsers.join(", ")} {typingUsers.length === 1 ? "está" : "están"} escribiendo...
                  </p>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input de mensaje */}
        <div className="bg-white border-t p-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu mensaje..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!isConnected}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !isConnected}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
