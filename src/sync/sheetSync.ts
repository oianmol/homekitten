import { findOrCreateSpreadsheet, batchUpsertRows, readSheet } from './google/sheets';
import * as stores from '../storage/stores';
import type { Kitchen, Item, MealWindow, Order } from '../model/types';

const SHEET_ID_KEY = 'hk-sheet-id';
const LAST_SYNC_KEY = 'hk-last-sync';

export function getSheetId(): string | null {
  return localStorage.getItem(SHEET_ID_KEY);
}

function setSheetId(id: string) {
  localStorage.setItem(SHEET_ID_KEY, id);
}

export function getLastSync(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

function markSynced() {
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

export async function ensureSpreadsheet(kitchenName: string): Promise<string> {
  const existing = getSheetId();
  if (existing) return existing;
  const sheet = await findOrCreateSpreadsheet(`HomeKitten — ${kitchenName}`);
  setSheetId(sheet.id);
  return sheet.id;
}

export interface SyncResult {
  pulled: { items: number; meals: number; orders: number; kitchen: boolean };
  pushed: { items: number; meals: number; orders: number; kitchen: boolean };
}

export async function fullSync(kitchenName: string): Promise<SyncResult> {
  const sheetId = await ensureSpreadsheet(kitchenName);

  const [localKitchen, localItems, localMeals, localOrders] = await Promise.all([
    stores.getKitchen(),
    stores.listItems(),
    stores.listMeals(),
    stores.listOrders()
  ]);

  const [rKitchen, rItems, rMeals, rOrders] = await Promise.all([
    readSheet(sheetId, 'kitchen'),
    readSheet(sheetId, 'items'),
    readSheet(sheetId, 'meals'),
    readSheet(sheetId, 'orders')
  ]);

  const result: SyncResult = {
    pulled: { items: 0, meals: 0, orders: 0, kitchen: false },
    pushed: { items: 0, meals: 0, orders: 0, kitchen: false }
  };

  // Kitchen (singleton)
  const remoteKitchen = rKitchen.find((r) => r.id === 'self');
  if (localKitchen) {
    if (!remoteKitchen || (localKitchen.createdAt ?? '') >= remoteKitchen.updatedAt) {
      await batchUpsertRows(sheetId, 'kitchen', [{ id: 'self', updatedAt: new Date().toISOString(), data: localKitchen }]);
      result.pushed.kitchen = true;
    } else {
      const remote = JSON.parse(remoteKitchen.data) as Kitchen;
      await stores.putKitchen(remote);
      result.pulled.kitchen = true;
    }
  } else if (remoteKitchen) {
    const remote = JSON.parse(remoteKitchen.data) as Kitchen;
    await stores.putKitchen(remote);
    result.pulled.kitchen = true;
  }

  // Items
  await reconcile<Item>(
    sheetId, 'items',
    localItems, rItems,
    (i) => i.id, (i) => i.updatedAt,
    async (toPull) => { for (const i of toPull) await stores.putItem(i); result.pulled.items = toPull.length; },
    (rows) => { result.pushed.items = rows.length; }
  );

  // Meals (use date as updatedAt proxy + id)
  await reconcile<MealWindow>(
    sheetId, 'meals',
    localMeals, rMeals,
    (m) => m.id, (m) => m.date + 'T' + (m.orderCutoffAt ?? ''),
    async (toPull) => { for (const m of toPull) await stores.putMeal(m); result.pulled.meals = toPull.length; },
    (rows) => { result.pushed.meals = rows.length; }
  );

  // Orders
  await reconcile<Order>(
    sheetId, 'orders',
    localOrders, rOrders,
    (o) => o.id, (o) => o.importedAt ?? o.placedAt,
    async (toPull) => { for (const o of toPull) await stores.putOrder(o); result.pulled.orders = toPull.length; },
    (rows) => { result.pushed.orders = rows.length; }
  );

  markSynced();
  return result;
}

async function reconcile<T>(
  sheetId: string,
  tab: string,
  local: T[],
  remoteRows: Array<{ id: string; updatedAt: string; data: string }>,
  idOf: (t: T) => string,
  updatedAtOf: (t: T) => string,
  applyPull: (toPull: T[]) => Promise<void>,
  notePushed: (rows: Array<{ id: string; updatedAt: string; data: T }>) => void
): Promise<void> {
  const remoteMap = new Map(remoteRows.map((r) => [r.id, r]));
  const toPush: Array<{ id: string; updatedAt: string; data: T }> = [];
  const toPull: T[] = [];
  const seenLocal = new Set<string>();

  for (const t of local) {
    const id = idOf(t);
    seenLocal.add(id);
    const u = updatedAtOf(t);
    const r = remoteMap.get(id);
    if (!r || u > r.updatedAt) {
      toPush.push({ id, updatedAt: u, data: t });
    } else if (r.updatedAt > u) {
      try { toPull.push(JSON.parse(r.data) as T); } catch { /* skip malformed */ }
    }
  }
  for (const r of remoteRows) {
    if (seenLocal.has(r.id)) continue;
    try { toPull.push(JSON.parse(r.data) as T); } catch { /* skip */ }
  }

  if (toPush.length) await batchUpsertRows(sheetId, tab, toPush);
  if (toPull.length) await applyPull(toPull);
  notePushed(toPush);
}
