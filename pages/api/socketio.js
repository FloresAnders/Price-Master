import { Server } from "socket.io";

let io;

export default function handler(req, res) {
  if (!res.socket.server.io) {
    console.log("🚀 Iniciando servidor Socket.IO...");
    
    // Configuración más robusta para producción
    const corsOptions = {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.NEXTAUTH_URL || false
        : ["http://localhost:3000", "http://127.0.0.1:3000"],
      methods: ["GET", "POST"],
      credentials: true
    };
    
    io = new Server(res.socket.server, {
      path: "/api/socketio",
      addTrailingSlash: false,
      cors: corsOptions,
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      allowEIO3: true
    });

    res.socket.server.io = io;

    // Almacenar usuarios conectados
    const connectedUsers = new Map();

    io.on("connection", (socket) => {
      console.log("🔌 Usuario conectado:", socket.id);

      // Manejar errores de socket
      socket.on('error', (error) => {
        console.error('❌ Error de socket:', socket.id, error);
      });

      // Cuando un usuario se une al chat
      socket.on("join", (userData) => {
        try {
          connectedUsers.set(socket.id, userData);
          console.log(`👤 ${userData.displayName} (${userData.location}) se unió al chat`);
          
          // Notificar a todos que un usuario se conectó
          socket.broadcast.emit("userJoined", {
            id: socket.id,
            name: userData.displayName,
            timestamp: new Date().toISOString()
          });

          // Enviar lista de usuarios conectados al nuevo usuario
          const usersList = Array.from(connectedUsers.values());
          socket.emit("connectedUsers", usersList);
        } catch (error) {
          console.error('❌ Error en join:', error);
          socket.emit('error', { message: 'Error al unirse al chat' });
        }
      });

      // Escuchar mensajes
      socket.on("message", (messageData) => {
        try {
          const user = connectedUsers.get(socket.id);
          if (user && messageData.text && messageData.text.trim()) {
            const fullMessage = {
              id: Date.now(),
              text: messageData.text.trim(),
              user: user.displayName,
              userId: socket.id,
              timestamp: new Date().toISOString()
            };
            
            console.log(`💬 Mensaje de ${user.displayName}: ${messageData.text}`);
            
            // Enviar mensaje a todos los usuarios conectados
            io.emit("message", fullMessage);
          }
        } catch (error) {
          console.error('❌ Error en message:', error);
          socket.emit('error', { message: 'Error al enviar mensaje' });
        }
      });

      // Cuando el usuario se desconecta
      socket.on("disconnect", () => {
        try {
          const user = connectedUsers.get(socket.id);
          if (user) {
            console.log("❌ Usuario desconectado:", user.displayName);
            connectedUsers.delete(socket.id);
            
            // Notificar a todos que el usuario se desconectó
            socket.broadcast.emit("userLeft", {
              id: socket.id,
              name: user.displayName,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('❌ Error en disconnect:', error);
        }
      });

      // Evento para indicar que el usuario está escribiendo
      socket.on("typing", (isTyping) => {
        try {
          const user = connectedUsers.get(socket.id);
          if (user) {
            socket.broadcast.emit("userTyping", {
              userId: socket.id,
              userName: user.displayName,
              isTyping
            });
          }
        } catch (error) {
          console.error('❌ Error en typing:', error);
        }
      });
    });
  }
  
  res.status(200).json({ success: true, message: "Socket.IO initialized" });
}
