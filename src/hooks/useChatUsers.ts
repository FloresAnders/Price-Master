import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  doc,
  setDoc,
  query, 
  onSnapshot, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ChatUser } from '../types/chat';

export function useChatUsers() {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchar cambios en los usuarios en línea
    const q = query(
      collection(db, 'chat_users'),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: ChatUser[] = [];
      const now = new Date();
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const lastSeen = data.lastSeen?.toDate() || new Date(0);
        
        // Considerar usuario online si su última actividad fue hace menos de 2 minutos
        const isOnline = (now.getTime() - lastSeen.getTime()) < 2 * 60 * 1000;
        
        usersData.push({
          id: doc.id,
          name: data.name || 'Usuario',
          isOnline,
          lastSeen,
          role: data.role,
        });
      });
      
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching users:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateUserPresence = useCallback(async (userId: string, name: string, role?: string) => {
    try {
      await setDoc(doc(db, 'chat_users', userId), {
        name,
        role: role || 'user',
        lastSeen: serverTimestamp(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      console.error('Error updating user presence:', error);
    }
  }, []);

  return {
    users,
    updateUserPresence,
    loading,
  };
}
