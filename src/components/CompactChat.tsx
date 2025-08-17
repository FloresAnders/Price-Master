"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  
  // Estados para el redimensionamiento
  const [chatSize, setChatSize] = useState({ width: 320, height: 500 }); // Tamaño inicial
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  
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

  // Funciones para el redimensionamiento
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: chatSize.width,
      height: chatSize.height
    });
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const deltaX = resizeStart.x - e.clientX; // Invertido para esquina superior izquierda
    const deltaY = resizeStart.y - e.clientY; // Invertido para esquina superior izquierda
    
    const newWidth = Math.max(280, Math.min(600, resizeStart.width + deltaX)); // Min: 280px, Max: 600px
    const newHeight = Math.max(400, Math.min(800, resizeStart.height + deltaY)); // Min: 400px, Max: 800px
    
    setChatSize({ width: newWidth, height: newHeight });
  }, [isResizing, resizeStart.x, resizeStart.y, resizeStart.width, resizeStart.height]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Event listeners para el redimensionamiento
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'nw-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

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
    <div 
      className="flex flex-col h-full relative"
      style={{ 
        width: `${chatSize.width}px`, 
        height: `${chatSize.height}px`,
        transition: isResizing ? 'none' : 'all 0.2s ease'
      }}
    >
      {/* Control de redimensionamiento */}
      <div
        className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-10 group"
        onMouseDown={handleResizeStart}
      >
        <div className="absolute top-1 left-1 w-3 h-3 opacity-30 group-hover:opacity-60 transition-opacity">
          <svg viewBox="0 0 12 12" className="w-full h-full text-gray-600 dark:text-gray-400">
            <path
              d="M11 1L11 11L1 11"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
            <path
              d="M7 1L11 1L11 5"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
            <path
              d="M3 5L7 5L7 9L3 9Z"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </svg>
        </div>
      </div>
      {/* Header del chat */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
              Sala General
            </h3>
          </div>
          <div className="flex items-center space-x-1">
            {/* Botones de redimensionamiento rápido */}
            <div className="flex items-center space-x-1 mr-2">
              <button
                onClick={() => setChatSize({ width: 320, height: 500 })}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1 text-xs"
                title="Tamaño pequeño"
              >
                S
              </button>
              <button
                onClick={() => setChatSize({ width: 400, height: 600 })}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1 text-xs"
                title="Tamaño mediano"
              >
                M
              </button>
              <button
                onClick={() => setChatSize({ width: 500, height: 700 })}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 p-1 text-xs"
                title="Tamaño grande"
              >
                L
              </button>
            </div>
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
        
        {/* Sección expandida de usuarios en línea */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Usuarios conectados ({connectedUsers.length})
            </span>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
          
          {connectedUsers.length > 0 ? (
            <div className="grid grid-cols-1 gap-1 max-h-20 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
              {connectedUsers.map((connectedUser, index) => (
                <div key={index} className="flex items-center space-x-2 text-xs">
                  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                    {connectedUser.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 font-medium flex-1 truncate">
                    {connectedUser.displayName || 'Usuario'}
                  </span>
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-2">
              <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                No hay usuarios conectados
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Lista de mensajes */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm mt-8">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mx-4">
              <p className="mb-2">💬</p>
              <p>¡Sé el primero en escribir!</p>
              <p className="text-xs mt-1 opacity-75">Los mensajes aparecerán aquí</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex ${message.userId === userId ? 'justify-end' : 'justify-start'} mb-3 ${
                message.userId === userId ? 'pr-1' : 'pl-1'
              }`}
            >
              {/* Indicador visual para mensajes propios */}
              {message.userId === userId && (
                <div className="flex items-end mr-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full opacity-60"></div>
                </div>
              )}
              
              {/* Indicador visual para mensajes de otros */}
              {message.userId !== userId && message.userId !== "system" && (
                <div className="flex items-end mr-2">
                  <div className="w-6 h-6 bg-gray-400 dark:bg-gray-600 rounded-full flex items-center justify-center text-xs text-white font-bold">
                    {message.user?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                </div>
              )}
              <div className={`max-w-[75%] px-3 py-2 rounded-lg text-sm shadow-sm ${
                message.userId === "system" 
                  ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 text-center italic mx-auto border border-yellow-200 dark:border-yellow-700'
                  : message.userId === userId 
                    ? 'bg-blue-500 hover:bg-blue-600 text-white rounded-br-sm shadow-md' // Mis mensajes: azul con hover
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm border border-gray-300 dark:border-gray-600' // Otros: gris con borde
              }`}>
                {/* Mostrar nombre del usuario solo para mensajes de otros (no sistema, no míos) */}
                {message.userId !== "system" && message.userId !== userId && (
                  <p className="text-xs opacity-75 mb-1 font-medium text-gray-600 dark:text-gray-300">{message.user}</p>
                )}
                <p className="break-words leading-relaxed">{message.text}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className={`text-xs opacity-75 ${
                    message.userId === userId 
                      ? 'text-blue-100' 
                      : message.userId === "system"
                        ? 'text-yellow-600 dark:text-yellow-300'
                        : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {formatTime(message.timestamp)}
                  </p>
                  {/* Indicador de mensaje enviado para mensajes propios */}
                  {message.userId === userId && (
                    <span className="text-blue-100 text-xs ml-2">✓</span>
                  )}
                </div>
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
