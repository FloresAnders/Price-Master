// Tipos específicos para el sistema de chat
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: Date;
  type: 'global' | 'private';
  recipientId?: string;
  recipientName?: string;
}

export interface ChatUser {
  id: string;
  name: string;
  isOnline: boolean;
  lastSeen: Date;
  role?: 'admin' | 'user' | 'superadmin';
}

export interface SendMessageData {
  senderId: string;
  senderName: string;
  content: string;
  type: 'global' | 'private';
  recipientId?: string;
  recipientName?: string;
}
