'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';

const FloatingIcon = () => {
    const [isHovered, setIsHovered] = useState(false);
    const [showMessages, setShowMessages] = useState(false);
    const [messages, setMessages] = useState<Array<{id: number, text: string, time: string, sender: string}>>([]);
    const [inputMessage, setInputMessage] = useState('');
    const { theme, setTheme } = useTheme();
    const { user } = useAuth();

    const handleClick = () => {
        setShowMessages(!showMessages);
    };

    const closeMessages = () => {
        setShowMessages(false);
        setMessages([]);
    };

    const sendMessage = () => {
        if (inputMessage.trim() === '') return;

        // Obtener el nombre del remitente: primero ubicación, luego nombre del usuario, y finalmente "Usuario"
        const senderName = user?.location || user?.name || 'Usuario';

        const newMessage = {
            id: Date.now(),
            text: inputMessage,
            time: new Date().toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }),
            sender: senderName
        };

        setMessages(prev => [...prev, newMessage]);
        setInputMessage('');

        // TODO: Implementar envío real de mensajes a otros usuarios
        // sendMessageToUsers(newMessage);
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    };

    // Efecto para manejar la tecla ESC
    useEffect(() => {
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && showMessages) {
                closeMessages();
            }
        };

        // Agregar el event listener cuando el componente se monta
        document.addEventListener('keydown', handleEscapeKey);

        // Limpiar el event listener cuando el componente se desmonta
        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [showMessages]); // Dependencia en showMessages para que se actualice

    return (
        <>
            {/* Panel de mensajes flotante */}
            {showMessages && (
                <div className="fixed bottom-20 right-4 z-40 w-80 h-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col animate-in slide-in-from-bottom-5 duration-300">
                    {/* Header del chat */}
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-t-lg">
                        <h3 className="text-white font-semibold flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                            </svg>
                            Mensajes
                        </h3>
                        <button 
                            onClick={closeMessages}
                            className="text-white hover:text-gray-200 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Área de mensajes */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                                <div className="text-center">
                                    <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <p className="text-sm">No hay mensajes</p>
                                    <p className="text-xs mt-1">Envía el primer mensaje</p>
                                </div>
                            </div>
                        ) : (
                            messages.map((message) => (
                                <div key={message.id} className="animate-in slide-in-from-left-5 duration-500">
                                    <div className="flex items-start space-x-2">
                                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="text-white text-xs font-semibold">
                                                {message.sender === 'Soporte' ? 'S' : 
                                                 message.sender === 'Sistema' ? 'Sys' : 
                                                 message.sender.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <div className={`rounded-lg p-3 ${
                                                message.sender !== 'Soporte' && message.sender !== 'Sistema'
                                                    ? 'bg-blue-500 text-white ml-8' 
                                                    : 'bg-gray-100 dark:bg-gray-700'
                                            }`}>
                                                <p className={`text-sm ${
                                                    message.sender !== 'Soporte' && message.sender !== 'Sistema'
                                                        ? 'text-white' 
                                                        : 'text-gray-800 dark:text-gray-200'
                                                }`}>{message.text}</p>
                                            </div>
                                            <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                <span className="font-medium">{message.sender}</span>
                                                <span className="mx-1">•</span>
                                                <span>{message.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Input de respuesta */}
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Escribe tu mensaje..."
                                className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <button 
                                onClick={sendMessage}
                                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-2 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all disabled:opacity-50"
                                disabled={inputMessage.trim() === ''}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Icono flotante */}
            <div
                className="fixed bottom-4 right-4 z-50 cursor-pointer transition-all duration-300 ease-in-out transform hover:scale-110"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={handleClick}
            >
                <div className={`
            w-12 h-12 rounded-full shadow-lg 
            ${showMessages 
                ? 'bg-gradient-to-r from-green-500 to-blue-600 dark:from-green-600 dark:to-blue-700' 
                : 'bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700'
            }
            flex items-center justify-center
            transition-all duration-300 ease-in-out
            ${isHovered ? 'shadow-xl transform scale-105' : ''}
            hover:shadow-2xl
            ${showMessages ? 'animate-pulse' : ''}
          `}>
                    {/* Icono SVG - Mensaje */}
                    <svg
                        className="w-6 h-6 text-white transition-transform duration-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                        />
                    </svg>
                </div>

                {/* Tooltip */}
                {isHovered && !showMessages && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-xs rounded whitespace-nowrap">
                        Mensajes
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800 dark:border-t-gray-200"></div>
                    </div>
                )}
            </div>
        </>
    );
};

export default FloatingIcon;
