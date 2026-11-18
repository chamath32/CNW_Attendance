import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { AttendanceEvent } from '../types';

interface CNWAttendanceDB extends DBSchema {
  offlineEvents: {
    key: string;
    value: AttendanceEvent;
    indexes: { 'by-synced': number };
  };
  cachedState: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'cnw-attendance-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<CNWAttendanceDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CNWAttendanceDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('offlineEvents')) {
          const store = db.createObjectStore('offlineEvents', { keyPath: 'id' });
          store.createIndex('by-synced', 'isOfflineCreated');
        }
        if (!db.objectStoreNames.contains('cachedState')) {
          db.createObjectStore('cachedState');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Queue an attendance event offline in IndexedDB
 */
export async function queueOfflineEvent(event: AttendanceEvent): Promise<void> {
  const db = await getDB();
  await db.put('offlineEvents', event);
}

/**
 * Get all unsynced offline attendance events
 */
export async function getUnsyncedEvents(): Promise<AttendanceEvent[]> {
  const db = await getDB();
  return await db.getAll('offlineEvents');
}

/**
 * Remove an event from the offline queue after successful server sync
 */
export async function removeSyncedEvent(eventId: string): Promise<void> {
  const db = await getDB();
  await db.delete('offlineEvents', eventId);
}

/**
 * Get count of pending offline events
 */
export async function getPendingOfflineCount(): Promise<number> {
  const db = await getDB();
  return await db.count('offlineEvents');
}
