export interface HistoryLine {
  itemId: string;
  name: string;
  unit?: string;
  qty: number;
  unitPricePaise: number;
}

export interface HistoryEntry {
  id: string;             // order id
  kitchenId: string;
  kitchenName: string;
  mealId: string;
  mealLabel: string;      // e.g. "Lunch · 2026-05-24"
  placedAt: string;
  totalPaise: number;
  lines: HistoryLine[];
}

const MAX_PER_KITCHEN = 20;

function key(kitchenId: string): string {
  return `hk-history:${kitchenId}`;
}

export function readHistory(kitchenId: string): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(key(kitchenId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function appendHistory(entry: HistoryEntry): void {
  try {
    const existing = readHistory(entry.kitchenId).filter((e) => e.id !== entry.id);
    const next = [entry, ...existing].slice(0, MAX_PER_KITCHEN);
    localStorage.setItem(key(entry.kitchenId), JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
}

export function removeHistory(kitchenId: string, orderId: string): void {
  try {
    const next = readHistory(kitchenId).filter((e) => e.id !== orderId);
    localStorage.setItem(key(kitchenId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

const PREFIX = 'hk-history:';

export function readAllHistory(): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) out.push(...arr);
      } catch { /* skip malformed */ }
    }
  } catch { /* ignore */ }
  out.sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  return out;
}

export interface KitchenContact {
  kitchenId: string;
  kitchenName: string;
  whatsappPhone?: string;
  lastMenuUrl?: string;
  lastSeenAt: string;
}

const CONTACTS_KEY = 'hk-customer-kitchens';

export function rememberKitchen(c: KitchenContact): void {
  try {
    const existing = readKitchenContacts().filter((x) => x.kitchenId !== c.kitchenId);
    const next = [c, ...existing].slice(0, 50);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}

export function readKitchenContacts(): KitchenContact[] {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function findKitchenContact(kitchenId: string): KitchenContact | undefined {
  return readKitchenContacts().find((c) => c.kitchenId === kitchenId);
}
