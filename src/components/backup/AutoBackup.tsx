'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { User } from '../../types/firestore';

interface AutoBackupProps {
  user: User;
  isVisible: boolean;
}

export default function AutoBackup({ user, isVisible }: AutoBackupProps) {
  const [hasAutoBackup, setHasAutoBackup] = useState(false);
  const backupInProgress = useRef(false);
  const processedUserIds = useRef(new Set<string>());
  const lastBackupTime = useRef(0);
  const BACKUP_COOLDOWN = 30000; // 30 seconds cooldown between backups

  const handleAutoBackup = useCallback(async () => {
    if (!user || user.role !== 'superadmin') return;

    // Prevent duplicate execution
    if (backupInProgress.current) {
      console.log('Backup already in progress, skipping...');
      return;
    }

    // Check cooldown period
    const now = Date.now();
    if (now - lastBackupTime.current < BACKUP_COOLDOWN) {
      console.log('Backup cooldown active, skipping...');
      return;
    }

    // Check if we already processed this user in this session
    const userKey = `${user.id}_${user.name}`;
    if (processedUserIds.current.has(userKey)) {
      console.log('Backup already sent for this user in this session, skipping...');
      return;
    }

    backupInProgress.current = true;
    lastBackupTime.current = now;
    console.log('Starting auto-backup for user:', user.name);

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

      // Mark this user as processed
      processedUserIds.current.add(userKey);
      console.log('Auto-backup completed successfully for user:', user.name);

      // Silent operation - backup sent successfully
    } catch (error) {
      // Silent error handling - log only to console
      console.error('Silent backup error:', error);
    } finally {
      backupInProgress.current = false;
    }
  }, [user]); // Include full user object as dependency

  // Auto-generate and send backup silently when superadmin logs in
  useEffect(() => {
    // Early return if conditions not met
    if (!isVisible || !user || user.role !== 'superadmin' || hasAutoBackup) {
      return;
    }

    // Additional checks before proceeding
    if (backupInProgress.current) {
      return;
    }

    const userKey = `${user.id}_${user.name}`;
    if (processedUserIds.current.has(userKey)) {
      setHasAutoBackup(true); // Mark as done if already processed
      return;
    }

    // Check cooldown
    const now = Date.now();
    if (now - lastBackupTime.current < BACKUP_COOLDOWN) {
      return;
    }

    console.log('Triggering auto-backup from useEffect for user:', user.name);
    handleAutoBackup();
    setHasAutoBackup(true);
  }, [isVisible, user, hasAutoBackup, handleAutoBackup]); // Include full user object

  // Reset backup status when user changes
  useEffect(() => {
    if (user?.id) {
      const userKey = `${user.id}_${user.name}`;
      if (!processedUserIds.current.has(userKey)) {
        setHasAutoBackup(false);
      }
    }
  }, [user?.id, user?.name]);

  // Component renders nothing - completely silent operation
  return null;
}
