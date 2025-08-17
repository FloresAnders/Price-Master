// API alternativa para chat que funciona en Vercel
// Usa long polling para optimizar recursos

let messages = [];
let connectedUsers = new Map();
let subscribers = []; // Cola de requests esperando respuesta

export default function handler(req, res) {
  const { method } = req;
  
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (method === 'GET') {
    // Long polling - obtener mensajes
    const { lastMessageId, userId } = req.query;
    
    try {
      const lastId = parseInt(lastMessageId) || 0;
      
      // Buscar mensajes nuevos
      const newMessages = messages.filter(msg => msg.id > lastId);
      
      // Actualizar última actividad del usuario
      if (userId) {
        connectedUsers.set(userId, {
          ...connectedUsers.get(userId),
          lastSeen: Date.now()
        });
      }
      
      // Limpiar usuarios inactivos (más de 2 minutos)
      const now = Date.now();
      for (const [id, user] of connectedUsers.entries()) {
        if (now - user.lastSeen > 120000) {
          connectedUsers.delete(id);
        }
      }
      
      // Si hay mensajes nuevos, responder inmediatamente
      if (newMessages.length > 0) {
        res.status(200).json({
          messages: newMessages,
          connectedUsers: Array.from(connectedUsers.values()),
          timestamp: Date.now()
        });
        return;
      }
      
      // Si no hay mensajes nuevos, hacer long polling
      // Timeout de 25 segundos (Vercel tiene límite de 30s)
      const timer = setTimeout(() => {
        // Remover de suscriptores y responder vacío
        subscribers = subscribers.filter(sub => sub.res !== res);
        if (!res.headersSent) {
          res.status(200).json({
            messages: [],
            connectedUsers: Array.from(connectedUsers.values()),
            timestamp: Date.now()
          });
        }
      }, 25000);
      
      // Función para enviar respuesta cuando llegue un mensaje
      const sendResponse = (newMsg) => {
        clearTimeout(timer);
        if (!res.headersSent) {
          res.status(200).json({
            messages: [newMsg],
            connectedUsers: Array.from(connectedUsers.values()),
            timestamp: Date.now()
          });
        }
      };
      
      // Agregar a la cola de suscriptores
      subscribers.push({ res, sendResponse, lastId });
      
      // Manejar desconexión del cliente
      req.on('close', () => {
        clearTimeout(timer);
        subscribers = subscribers.filter(sub => sub.res !== res);
      });
      
    } catch (error) {
      console.error('Error en GET:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  else if (method === 'POST') {
    const { action, data } = req.body;
    
    try {
      if (action === 'join') {
        // Usuario se une al chat
        const userId = data.userId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        connectedUsers.set(userId, {
          ...data,
          userId,
          lastSeen: Date.now()
        });
        
        res.status(200).json({ 
          success: true, 
          userId,
          message: 'Usuario conectado'
        });
      }
      
      else if (action === 'message') {
        // Nuevo mensaje
        const newMessage = {
          id: Date.now(),
          text: data.text.trim(),
          user: data.user,
          userId: data.userId,
          timestamp: new Date().toISOString()
        };
        
        messages.push(newMessage);
        
        // Mantener solo los últimos 100 mensajes
        if (messages.length > 100) {
          messages = messages.slice(-100);
        }
        
        // Notificar a todos los suscriptores esperando (long polling)
        subscribers.forEach(sub => {
          if (newMessage.id > sub.lastId && !sub.res.headersSent) {
            sub.sendResponse(newMessage);
          }
        });
        
        // Limpiar suscriptores que ya recibieron respuesta
        subscribers = subscribers.filter(sub => !sub.res.headersSent);
        
        res.status(200).json({ 
          success: true, 
          message: newMessage 
        });
      }
      
      else if (action === 'leave') {
        // Usuario sale del chat temporalmente (no mostrar mensaje)
        const user = connectedUsers.get(data.userId);
        if (user) {
          // Solo actualizar lastSeen, no eliminar ni mostrar mensaje
          connectedUsers.set(data.userId, {
            ...user,
            lastSeen: Date.now()
          });
        }
        
        res.status(200).json({ success: true });
      }
      
      else if (action === 'logout') {
        // Usuario sale del chat permanentemente (mostrar mensaje)
        const user = connectedUsers.get(data.userId);
        if (user) {
          console.log(`👋 ${user.displayName} está haciendo logout`);
          
          connectedUsers.delete(data.userId);
          
          const leaveMessage = {
            id: Date.now(),
            text: `${user.displayName} salió del chat`,
            user: "Sistema",
            userId: "system",
            timestamp: new Date().toISOString()
          };
          messages.push(leaveMessage);
          
          // Notificar a todos los suscriptores esperando
          subscribers.forEach(sub => {
            if (leaveMessage.id > sub.lastId && !sub.res.headersSent) {
              sub.sendResponse(leaveMessage);
            }
          });
          
          // Limpiar suscriptores que ya recibieron respuesta
          subscribers = subscribers.filter(sub => !sub.res.headersSent);
          
          console.log(`📩 Mensaje de salida agregado para ${user.displayName}`);
        }
        
        res.status(200).json({ success: true });
      }
      
      else {
        res.status(400).json({ error: 'Acción no válida' });
      }
    } catch (error) {
      console.error('Error en POST:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  
  else {
    res.status(405).json({ error: 'Método no permitido' });
  }
}
