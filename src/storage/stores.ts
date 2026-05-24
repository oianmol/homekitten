import { getDb } from './db';
import type { Kitchen, Item, MealWindow, Order } from '../model/types';

// ---------- kitchen (singleton) ----------

export async function getKitchen(): Promise<Kitchen | undefined> {
  const db = await getDb();
  const row = await db.get('kitchen', 'self');
  if (!row) return undefined;
  // Strip the 'self' key, expose the real id from the original payload.
  const { id: _ignored, ...rest } = row;
  void _ignored;
  // The Kitchen.id was stored under the original UUID before we rewrote it to 'self'.
  // We keep the original id in (row as any).origId for retrieval.
  const origId = (row as unknown as { origId?: string }).origId;
  return { ...(rest as unknown as Omit<Kitchen, 'id'>), id: origId ?? 'self' };
}

export async function putKitchen(k: Kitchen): Promise<void> {
  const db = await getDb();
  await db.put('kitchen', { ...k, id: 'self', origId: k.id } as unknown as Kitchen & { id: 'self' });
}

// ---------- items ----------

export async function listItems(): Promise<Item[]> {
  const db = await getDb();
  return (await db.getAll('items')).sort((a, b) => a.name.localeCompare(b.name));
}

export async function putItem(item: Item): Promise<void> {
  const db = await getDb();
  await db.put('items', item);
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('items', id);
}

// ---------- meal windows ----------

export async function listMeals(): Promise<MealWindow[]> {
  const db = await getDb();
  return (await db.getAll('mealWindows')).sort((a, b) => b.date.localeCompare(a.date));
}

export async function listMealsForDate(date: string): Promise<MealWindow[]> {
  const db = await getDb();
  return db.getAllFromIndex('mealWindows', 'by-date', date);
}

export async function putMeal(m: MealWindow): Promise<void> {
  const db = await getDb();
  await db.put('mealWindows', m);
}

export async function deleteMeal(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('mealWindows', id);
}

// ---------- orders ----------

export async function listOrders(): Promise<Order[]> {
  const db = await getDb();
  return (await db.getAll('orders')).sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

export async function getOrder(id: string): Promise<Order | undefined> {
  const db = await getDb();
  return db.get('orders', id);
}

export async function putOrder(o: Order): Promise<void> {
  const db = await getDb();
  await db.put('orders', o);
}

export async function deleteOrder(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('orders', id);
}

// ---------- payment-proof blobs ----------

export async function putBlob(key: string, blob: Blob): Promise<void> {
  const db = await getDb();
  await db.put('blobs', blob, key);
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  const db = await getDb();
  return db.get('blobs', key);
}

// ---------- export / import ----------

export interface BackupBundle {
  v: 1;
  exportedAt: string;
  kitchen: Kitchen | null;
  items: Item[];
  mealWindows: MealWindow[];
  orders: Order[];
}

export async function exportAll(): Promise<BackupBundle> {
  const [kitchen, items, mealWindows, orders] = await Promise.all([
    getKitchen(),
    listItems(),
    listMeals(),
    listOrders()
  ]);
  return {
    v: 1,
    exportedAt: new Date().toISOString(),
    kitchen: kitchen ?? null,
    items,
    mealWindows,
    orders
  };
}

export async function importAll(bundle: BackupBundle, mode: 'merge' | 'replace' = 'merge'): Promise<void> {
  if (bundle.v !== 1) throw new Error(`Unsupported backup version: ${bundle.v}`);
  const db = await getDb();
  const tx = db.transaction(['kitchen', 'items', 'mealWindows', 'orders'], 'readwrite');
  if (mode === 'replace') {
    await Promise.all([
      tx.objectStore('kitchen').clear(),
      tx.objectStore('items').clear(),
      tx.objectStore('mealWindows').clear(),
      tx.objectStore('orders').clear()
    ]);
  }
  if (bundle.kitchen) {
    await tx.objectStore('kitchen').put({ ...bundle.kitchen, id: 'self', origId: bundle.kitchen.id } as unknown as Kitchen & { id: 'self' });
  }
  for (const i of bundle.items) await tx.objectStore('items').put(i);
  for (const m of bundle.mealWindows) await tx.objectStore('mealWindows').put(m);
  for (const o of bundle.orders) await tx.objectStore('orders').put(o);
  await tx.done;
}
