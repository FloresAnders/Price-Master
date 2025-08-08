'use client';

import { useEffect, useState, useCallback } from 'react';
import type { User } from '../types/firestore';

interface AutoBackupProps {
  user: User;
  isVisible: boolean;
}

export default function AutoBackup({ user, isVisible }: AutoBackupProps) {
  const [hasAutoBackup, setHasAutoBackup] = useState(false);

  const handleAutoBackup = useCallback(async () => {
    if (!user || user.role !== 'superadmin') return;

    try {
      // Call API to generate and send backup using env variables
      const response = await fetch('/api/auto-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userName: user.name,
          userId: user.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en el backup automático');
      }

      // Silent operation - backup sent successfully
    } catch (error) {
      // Silent error handling - log only to console
      console.error('Silent backup error:', error);
    }
  }, [user]);

  // Auto-generate and send backup silently when superadmin logs in
  useEffect(() => {
    if (isVisible && user && user.role === 'superadmin' && !hasAutoBackup) {
      handleAutoBackup();
      setHasAutoBackup(true);
    }
  }, [isVisible, user, hasAutoBackup, handleAutoBackup]);

  // Component renders nothing - completely silent operation
  return null;
}
