"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Inicializar socket solo una vez
    if (!socketRef.current) {
      socketRef.current = io({
        path: "/api/socketio",
      });
    }

    return () => {
      // Limpiar socket al desmontar
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return socketRef.current;
}
