import { useEffect, useRef, useState } from 'react';
import { db, type EmergencyReport } from '@/lib/db';

const MAX_SYNC_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 750;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useSync = () => {
  const [isOnline, setIsOnline] = useState(false);
  const isSyncingRef = useRef(false);

  const syncSingleReport = async (report: EmergencyReport) => {
    let lastError = 'Unknown sync error';

    for (let attempt = 1; attempt <= MAX_SYNC_RETRIES; attempt++) {
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(report),
        });

        let syncResponse: unknown = null;
        try {
          syncResponse = await response.json();
        } catch {
          syncResponse = null;
        }

        if (!response.ok) {
          const errorBody =
            syncResponse && typeof syncResponse === 'object'
              ? JSON.stringify(syncResponse)
              : 'Unknown server error';
          throw new Error(`Sync failed with status ${response.status}: ${errorBody}`);
        }

        if (
          syncResponse &&
          typeof syncResponse === 'object' &&
          'emailAlert' in syncResponse
        ) {
          const alert = (syncResponse as { emailAlert?: { reason?: string; sent?: boolean } }).emailAlert;
          if (alert) {
            console.log('Email alert status:', alert.sent ? 'sent' : 'not sent', alert.reason ?? '');
          }
        }

        await db.reports.update(report.id!, {
          status: 'synced',
          attempts: attempt,
          lastError: '',
        });
        console.log('Synced report', report.id, 'in attempt', attempt);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown sync error';

        await db.reports.update(report.id!, {
          status: 'failed',
          attempts: attempt,
          lastError,
        });

        if (attempt < MAX_SYNC_RETRIES) {
          const backoffDelay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await delay(backoffDelay);
          continue;
        }
      }
    }

    console.error('Sync failed for report', report.id, lastError);
  };

  const syncPendingReports = async () => {
    if (isSyncingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return;
    }

    isSyncingRef.current = true;

    try {
      // Give the browser a moment to stabilize the network stack after reconnect.
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setIsOnline(false);
        return;
      }

      const pending = await db.reports.where('status').anyOf('pending', 'failed').toArray();
      if (pending.length === 0) {
        return;
      }

      console.log(`Attempting to sync ${pending.length} reports...`);

      for (const report of pending) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setIsOnline(false);
          break;
        }

        await syncSingleReport(report);
      }
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    // Keep the online/offline indicator current and sync as soon as connectivity returns.
    const handleStatusChange = () => {
      const online = navigator.onLine;
      setIsOnline(online);

      if (online) {
        console.log('Internet is back! Starting Auto-Sync...');
        void syncPendingReports();
      }
    };

    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    // Sync initial network status immediately on mount.
    handleStatusChange();

    if (navigator.onLine) {
      void syncPendingReports();
    }

    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  return { isOnline, syncPendingReports };
};
