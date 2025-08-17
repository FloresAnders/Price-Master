// API alternativa para chat que funciona en Vercel
// Usa long polling para optimizar recursos

let messages = [];
let connectedUsers = new Map();
let subscribers = []; // Cola de requests esperando respuesta

// Función helper para obtener usuarios conectados con nombres válidos
function getValidConnectedUsers() {
  return Array.from(connectedUsers.values()).map(user => ({
    ...user,
    displayName: user.displayName || user.name || 'Usuario'
  }));
}

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
          connectedUsers: getValidConnectedUsers(),
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
            connectedUsers: getValidConnectedUsers(),
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
            connectedUsers: getValidConnectedUsers(),
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
    // Manejar tanto requests normales como sendBeacon
    let data;
    
    try {
      // Intentar parsear como JSON normal
      if (req.body && typeof req.body === 'object') {
        data = req.body;
      } else if (typeof req.body === 'string') {
        data = JSON.parse(req.body);
      } else {
        throw new Error('No body data');
      }
    } catch (error) {
      console.error('Error parsing request body:', error);
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }
    
    const { action, data: actionData } = data;
    
    try {
      if (action === 'join') {
        // Usuario se une al chat
        const userId = actionData.userId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Asegurar que siempre hay un displayName válido
        const userData = {
          ...actionData,
          userId,
          displayName: actionData.displayName || actionData.name || 'Usuario',
          lastSeen: Date.now()
        };
        
        connectedUsers.set(userId, userData);
        
        console.log(`👤 Usuario conectado: ${userData.displayName} (${userId})`);
        
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
          text: actionData.text.trim(),
          user: actionData.user,
          userId: actionData.userId,
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
        const user = connectedUsers.get(actionData.userId);
        if (user) {
          console.log(`📤 ${user.displayName || 'Usuario'} sale temporalmente`);
          // Marcar como desconectado pero no eliminar completamente
          connectedUsers.set(actionData.userId, {
            ...user,
            lastSeen: Date.now() - 120000 // Marcar como inactivo
          });
        }
        
        res.status(200).json({ success: true });
      }
      
      else if (action === 'logout') {
        // Usuario sale del chat permanentemente (mostrar mensaje)
        const user = connectedUsers.get(actionData.userId);
        if (user) {
          console.log(`👋 ${user.displayName} está haciendo logout`);
          
          connectedUsers.delete(actionData.userId);
          
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
