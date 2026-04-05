import Dexie, { Table } from 'dexie';

export type ReportCategory = 'medical' | 'shelter' | 'food' | 'security' | 'other';

export interface EmergencyReport {
  id?: number;
  text: string;
  category: ReportCategory;
  urgency: number;
  latitude?: number;
  longitude?: number;
  locationAccuracyM?: number;
  status: 'pending' | 'synced' | 'failed';
  timestamp: number;
  attempts?: number;
  lastError?: string;
}

export class MyDatabase extends Dexie {
  reports!: Table<EmergencyReport>;

  constructor() {
    super('DisasterDocDB');
    this.version(1).stores({
      reports: '++id, status, timestamp'
    });
    this.version(2).stores({
      reports: '++id, status, category, urgency, timestamp, attempts'
    });
    this.version(3).stores({
      reports: '++id, status, category, urgency, timestamp, attempts, latitude, longitude'
    });
    console.log("IndexedDB Initialized: DisasterDocDB"); // Add this
  }
}

export const db = new MyDatabase();