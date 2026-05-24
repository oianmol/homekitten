import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Kitchen, Item, MealWindow, Order } from '../model/types';

export interface Settings {
  id: 'self';
  onboardedAt?: string;
  installPromptDismissedAt?: string;
}

export interface HKSchema extends DBSchema {
  kitchen: {
    key: 'self';
    value: Kitchen & { id: 'self' };
  };
  items: {
    key: string;
    value: Item;
    indexes: { 'by-updatedAt': string };
  };
  mealWindows: {
    key: string;
    value: MealWindow;
    indexes: { 'by-date': string };
  };
  orders: {
    key: string;
    value: Order;
    indexes: { 'by-placedAt': string; 'by-status': string };
  };
  settings: {
    key: string;
    value: Settings;
  };
  blobs: {
    key: string;            // e.g. `payment-proof:<orderId>`
    value: Blob;
  };
}

const DB_NAME = 'homekitten';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<HKSchema>> | null = null;

export function getDb(): Promise<IDBPDatabase<HKSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<HKSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('kitchen', { keyPath: 'id' });
          const items = db.createObjectStore('items', { keyPath: 'id' });
          items.createIndex('by-updatedAt', 'updatedAt');
          const meals = db.createObjectStore('mealWindows', { keyPath: 'id' });
          meals.createIndex('by-date', 'date');
          const orders = db.createObjectStore('orders', { keyPath: 'id' });
          orders.createIndex('by-placedAt', 'placedAt');
          orders.createIndex('by-status', 'status');
          db.createObjectStore('settings', { keyPath: 'id' });
          db.createObjectStore('blobs');
        }
      }
    });
  }
  return dbPromise;
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
