import { Server } from "socket.io";

let io;

export default function handler(req, res) {
  if (!res.socket.server.io) {
    console.log("🚀 Iniciando servidor Socket.IO...");
    
    io = new Server(res.socket.server, {
      path: "/api/socketio",
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    res.socket.server.io = io;

    // Almacenar usuarios conectados
    const connectedUsers = new Map();

    io.on("connection", (socket) => {
      console.log("🔌 Usuario conectado:", socket.id);

      // Cuando un usuario se une al chat
      socket.on("join", (userData) => {
        connectedUsers.set(socket.id, userData);
        console.log(`👤 ${userData.name} se unió al chat`);
        
        // Notificar a todos que un usuario se conectó
        socket.broadcast.emit("userJoined", {
          id: socket.id,
          name: userData.name,
          timestamp: new Date().toISOString()
        });

        // Enviar lista de usuarios conectados al nuevo usuario
        const usersList = Array.from(connectedUsers.values());
        socket.emit("connectedUsers", usersList);
      });

      // Escuchar mensajes
      socket.on("message", (messageData) => {
        const user = connectedUsers.get(socket.id);
        if (user) {
          const fullMessage = {
            id: Date.now(),
            text: messageData.text,
            user: user.name,
            userId: socket.id,
            timestamp: new Date().toISOString()
          };
          
          console.log("📩 Mensaje de", user.name, ":", messageData.text);
          
          // Reenviar mensaje a todos los usuarios conectados
          io.emit("message", fullMessage);
        }
      });

      // Cuando el usuario se desconecta
      socket.on("disconnect", () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
          console.log("❌ Usuario desconectado:", user.name);
          connectedUsers.delete(socket.id);
          
          // Notificar a todos que el usuario se desconectó
          socket.broadcast.emit("userLeft", {
            id: socket.id,
            name: user.name,
            timestamp: new Date().toISOString()
          });
        }
      });

      // Evento para indicar que el usuario está escribiendo
      socket.on("typing", (isTyping) => {
        const user = connectedUsers.get(socket.id);
        if (user) {
          socket.broadcast.emit("userTyping", {
            userId: socket.id,
            userName: user.name,
            isTyping
          });
        }
      });
    });
  }
  
  res.end();
}
