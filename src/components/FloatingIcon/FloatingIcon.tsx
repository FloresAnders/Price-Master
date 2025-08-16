'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useChatSocket } from '@/hooks/useChatSocket';
import CompactChat from '@/components/CompactChat';

const FloatingIcon = () => {
    const [isHovered, setIsHovered] = useState(false);
    const [showMessages, setShowMessages] = useState(false);
    const { user, isAuthenticated } = useAuth();
    
    // DEBUG: Logs temporales
    console.log("🔍 FloatingIcon - user:", user);
    console.log("🔍 FloatingIcon - isAuthenticated:", isAuthenticated);
    
    // Usar el hook de chat solo si el usuario está autenticado
    const chatUser = user ? {
        name: user.name,
        location: user.location || user.name, // Usar ubicación o nombre como fallback
        displayName: user.location || user.name // Lo que se mostrará en el chat
    } : null;
    
    console.log("🔍 FloatingIcon - chatUser:", chatUser);
    
    const { unreadCount, markAsRead } = useChatSocket(chatUser);

    const handleClick = () => {
        // Solo permitir chat si el usuario está autenticado
        if (isAuthenticated && chatUser) {
            setShowMessages(!showMessages);
            // Resetear contador de no leídos al abrir
            if (!showMessages) {
                markAsRead();
            }
        }
    };

    const closeMessages = () => {
        setShowMessages(false);
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
            {showMessages && isAuthenticated && chatUser && (
                <div className="fixed bottom-20 right-4 z-40 w-80 h-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col animate-in slide-in-from-bottom-5 duration-300">
                    <CompactChat 
                        user={chatUser} 
                        onClose={closeMessages}
                    />
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
            relative w-12 h-12 rounded-full shadow-lg 
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

                    {/* Badge de mensajes no leídos */}
                    {unreadCount > 0 && !showMessages && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </div>
                    )}

                    {/* Indicador de usuario logueado */}
                    {isAuthenticated && chatUser && (
                        <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full w-3 h-3 border-2 border-white dark:border-gray-800"></div>
                    )}
                   
                </div>

                {/* Tooltip */}
                {isHovered && !showMessages && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 text-xs rounded whitespace-nowrap">
                        {isAuthenticated && chatUser ? `Chat (${chatUser.displayName})` : 'Chat - Inicia sesión'}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800 dark:border-t-gray-200"></div>
                    </div>
                )}
            </div>
        </>
    );
};

export default FloatingIcon;
