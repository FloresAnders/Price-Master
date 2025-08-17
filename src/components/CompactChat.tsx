"use client";

import { useEffect, useRef, useState } from "react";
import { useChatPolling } from "@/hooks/useChatPolling";

interface ChatUser {
  name: string;
  location: string;
  displayName: string;
}

interface CompactChatProps {
  user: ChatUser;
  onClose: () => void;
}

export default function CompactChat({ user, onClose }: CompactChatProps) {
  const { 
    messages, 
    connectedUsers, 
    isConnected, 
    sendMessage, 
    markAsRead,
    userId 
  } = useChatPolling(user);
  
  // DEBUG: Logs temporales
  console.log("🔍 CompactChat - user:", user);
  console.log("🔍 CompactChat - isConnected:", isConnected);
  console.log("🔍 CompactChat - userId:", userId);
  console.log("🔍 CompactChat - connectedUsers:", connectedUsers);
  console.log("🔍 CompactChat - messages:", messages);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Marcar como leído cuando el componente está visible
  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  const handleSendMessage = () => {
    if (input.trim()) {
      sendMessage(input).then(success => {
        if (success) {
          setInput("");
        }
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header del chat */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
          <div>
            <h3 className="font-semibold text-xs text-gray-800 dark:text-gray-200">
              {user.displayName}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {connectedUsers.length} online
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Lista de mensajes */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 text-xs mt-4">
            <p>¡Sé el primero en escribir!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex ${message.userId === userId ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] px-2 py-1 rounded-lg text-xs ${
                message.userId === "system" 
                  ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-center italic'
                  : message.userId === userId 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}>
                {message.userId !== "system" && message.userId !== userId && (
                  <p className="text-xs opacity-75 mb-1">{message.user}</p>
                )}
                <p>{message.text}</p>
                <p className={`text-xs opacity-75 mt-1 ${
                  message.userId === userId ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {formatTime(message.timestamp)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input de mensaje */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-600">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe tu mensaje..."
            className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-200"
            disabled={!isConnected}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || !isConnected}
            className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
