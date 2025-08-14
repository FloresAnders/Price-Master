import { useState, useEffect, useCallback, useRef } from 'react';
import { ScanningService } from '../services/scanning';
import type { ScanResult } from '../types/firestore';
import { useAuth } from './useAuth';
import { generateShortMobileUrl } from '../utils/shortEncoder';

interface UseScanningOptions {
  autoMarkProcessed?: boolean;
  sessionId?: string;
  enableRealTime?: boolean;
}

export function useScanning(options: UseScanningOptions = {}) {
  const {
    autoMarkProcessed = false,
    sessionId,
    enableRealTime = true
  } = options;

  const [scans, setScans] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newScanCount, setNewScanCount] = useState(0);

  const { user } = useAuth();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const currentSessionId = useRef(sessionId || ScanningService.generateSessionId());

  // Load initial scans
  const loadScans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const scansData = await ScanningService.getUnprocessedScans(sessionId);
      setScans(scansData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading scans');
      console.error('Error loading scans:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Add a new scan (typically called from mobile)
  const addScan = useCallback(async (code: string, source: 'mobile' | 'web' = 'web') => {
    try {
      setError(null);
      const scanId = await ScanningService.addScan({
        code,
        source,
        userId: user?.id,
        userName: user?.name,
        sessionId: currentSessionId.current,
        processed: false
      });

      // If real-time is disabled, reload scans manually
      if (!enableRealTime) {
        await loadScans();
      }

      return scanId;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding scan');
      throw err;
    }
  }, [user, enableRealTime, loadScans]);

  // Mark scan as processed
  const markAsProcessed = useCallback(async (scanId: string) => {
    try {
      setError(null);
      await ScanningService.markAsProcessed(scanId);

      // Update local state
      setScans(prevScans =>
        prevScans.filter(scan => scan.id !== scanId)
      );

      // Decrease new scan count if it was unprocessed
      setNewScanCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error marking scan as processed');
      throw err;
    }
  }, []);

  // Delete a scan
  const deleteScan = useCallback(async (scanId: string) => {
    try {
      setError(null);
      await ScanningService.deleteScan(scanId);

      // Update local state
      setScans(prevScans =>
        prevScans.filter(scan => scan.id !== scanId)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting scan');
      throw err;
    }
  }, []);

  // Clear all scans
  const clearAllScans = useCallback(async () => {
    try {
      setError(null);
      const deletePromises = scans.map(scan =>
        scan.id ? ScanningService.deleteScan(scan.id) : Promise.resolve()
      );
      await Promise.all(deletePromises);
      setScans([]);
      setNewScanCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error clearing scans');
      throw err;
    }
  }, [scans]);

  // Process a scan (mark as processed and optionally trigger callback)
  const processScan = useCallback(async (scan: ScanResult, onProcess?: (code: string) => void) => {
    try {
      if (scan.id) {
        await markAsProcessed(scan.id);
      }

      if (onProcess) {
        onProcess(scan.code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing scan');
      throw err;
    }
  }, [markAsProcessed]);

  // Get session URL for mobile scanning (short URL only)
  const getMobileScanUrl = useCallback((requestProductName?: boolean) => {
    const baseUrl = window.location.origin;
    return generateShortMobileUrl(baseUrl, currentSessionId.current, requestProductName);
  }, []);

  // Setup real-time listener
  useEffect(() => {
    if (!enableRealTime) return;

    const handleScansUpdate = (updatedScans: ScanResult[]) => {
      setScans(prevScans => {
        // Count new scans that weren't in the previous state
        const newScans = updatedScans.filter(newScan =>
          !prevScans.some(oldScan => oldScan.id === newScan.id)
        );

        if (newScans.length > 0) {
          setNewScanCount(prev => prev + newScans.length);

          // Auto-mark as processed if enabled
          if (autoMarkProcessed && newScans.length > 0) {
            newScans.forEach(scan => {
              if (scan.id) {
                ScanningService.markAsProcessed(scan.id);
              }
            });
          }
        }

        return updatedScans;
      });
    };

    const handleError = (err: Error) => {
      setError(err.message);
      console.error('Real-time scan error:', err);
    };

    // Subscribe to real-time updates
    const unsubscribe = ScanningService.subscribeToScans(
      handleScansUpdate,
      handleError,
      sessionId
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [enableRealTime, autoMarkProcessed, sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Load initial data
  useEffect(() => {
    if (!enableRealTime) {
      loadScans();
    }
  }, [loadScans, enableRealTime]);

  // Reset new scan count when user acknowledges
  const resetNewScanCount = useCallback(() => {
    setNewScanCount(0);
  }, []);

  return {
    scans,
    loading,
    error,
    newScanCount,
    sessionId: currentSessionId.current,

    // Actions
    addScan,
    markAsProcessed,
    deleteScan,
    clearAllScans,
    processScan,
    loadScans,
    resetNewScanCount,

    // Utils
    getMobileScanUrl,

    // State helpers
    hasNewScans: newScanCount > 0,
    totalScans: scans.length
  };
}
