"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

interface Message {
  id: number;
  text: string;
  user: string;
  userId: string;
  timestamp: string;
  room: string;
}

interface User {
  name: string;
  email: string;
}

interface AdvancedChatProps {
  user: User;
  onLogout: () => void;
}

const AVAILABLE_ROOMS = [
  { id: "general", name: "💬 General", description: "Chat general para todos" },
  { id: "support", name: "🛟 Soporte", description: "Canal de ayuda técnica" },
  { id: "announcements", name: "📢 Anuncios", description: "Comunicados importantes" },
  { id: "random", name: "🎲 Random", description: "Conversación casual" },
];

let socket: Socket;

export default function AdvancedChat({ user, onLogout }: AdvancedChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentRoom, setCurrentRoom] = useState("general");
  const [connectedUsers, setConnectedUsers] = useState<{ [room: string]: User[] }>({});
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join-room", { user, room: currentRoom });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Eventos de mensajes por sala
    socket.on("room-message", (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Usuarios conectados por sala
    socket.on("room-users", ({ room, users }: { room: string; users: User[] }) => {
      setConnectedUsers((prev) => ({ ...prev, [room]: users }));
    });

    return () => {
      socket.disconnect();
    };
  }, [user, currentRoom]);

  // Cambiar de sala
  const changeRoom = (newRoom: string) => {
    if (newRoom !== currentRoom) {
      socket.emit("leave-room", { room: currentRoom });
      socket.emit("join-room", { user, room: newRoom });
      setCurrentRoom(newRoom);
      setMessages([]); // Limpiar mensajes de la sala anterior
    }
  };

  const sendMessage = () => {
    if (input.trim() && socket) {
      socket.emit("room-message", { 
        text: input.trim(),
        room: currentRoom
      });
      setInput("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getCurrentRoom = () => AVAILABLE_ROOMS.find(r => r.id === currentRoom);
  const roomUsers = connectedUsers[currentRoom] || [];

  return (
    <div className="h-screen flex">
      {/* Sidebar - Salas y usuarios */}
      <div className="w-80 bg-gray-800 text-white flex flex-col">
        {/* Información del usuario */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center mb-2">
            <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className="text-sm">{isConnected ? 'Conectado' : 'Desconectado'}</span>
          </div>
          <p className="font-medium">{user.name}</p>
          <p className="text-xs text-gray-300">{user.email}</p>
          <button 
            onClick={onLogout}
            className="mt-2 text-xs bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
          >
            Cerrar Sesión
          </button>
        </div>

        {/* Lista de salas */}
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-sm font-semibold mb-3">Salas de Chat</h3>
          <div className="space-y-1">
            {AVAILABLE_ROOMS.map((room) => (
              <button
                key={room.id}
                onClick={() => changeRoom(room.id)}
                className={`w-full text-left p-2 rounded text-sm transition-colors ${
                  currentRoom === room.id 
                    ? 'bg-blue-600 text-white' 
                    : 'hover:bg-gray-700'
                }`}
              >
                <div className="font-medium">{room.name}</div>
                <div className="text-xs text-gray-300">{room.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Usuarios en la sala actual */}
        <div className="flex-1 p-4">
          <h3 className="text-sm font-semibold mb-2">
            En {getCurrentRoom()?.name} ({roomUsers.length})
          </h3>
          <div className="space-y-1">
            {roomUsers.map((roomUser, index) => (
              <div key={index} className="flex items-center text-sm p-2 bg-gray-700 rounded">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                <span>{roomUser.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat principal */}
      <div className="flex-1 flex flex-col">
        {/* Header de la sala */}
        <div className="bg-white border-b p-4">
          <div className="flex items-center">
            <span className="text-2xl mr-3">{getCurrentRoom()?.name.split(' ')[0]}</span>
            <div>
              <h1 className="text-xl font-semibold">{getCurrentRoom()?.name.slice(2)}</h1>
              <p className="text-sm text-gray-600">{getCurrentRoom()?.description}</p>
            </div>
          </div>
        </div>

        {/* Mensajes */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <p>¡Sé el primero en escribir en {getCurrentRoom()?.name}!</p>
              </div>
            ) : (
              messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`flex ${message.userId === socket?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.userId === socket?.id 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white border shadow-sm'
                  }`}>
                    {message.userId !== socket?.id && (
                      <p className="text-xs text-gray-500 mb-1">{message.user}</p>
                    )}
                    <p className="text-sm">{message.text}</p>
                    <p className={`text-xs mt-1 ${
                      message.userId === socket?.id ? 'text-blue-100' : 'text-gray-400'
                    }`}>
                      {new Date(message.timestamp).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>
                </div>
              ))
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
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Escribir en ${getCurrentRoom()?.name}...`}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!isConnected}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !isConnected}
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
