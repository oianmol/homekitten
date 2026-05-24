import { create } from 'zustand';
import type { CartLine, MealItem } from '../model/types';

interface CartState {
  lines: CartLine[];
  addOne: (item: MealItem) => void;
  removeOne: (itemId: string) => void;
  setQty: (itemId: string, qty: number) => void;
  clear: () => void;
  subtotalPaise: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],

  addOne: (item) => set((s) => {
    const idx = s.lines.findIndex((l) => l.itemId === item.itemId);
    if (idx >= 0) {
      const next = s.lines.slice();
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      return { lines: next };
    }
    return {
      lines: [...s.lines, { itemId: item.itemId, name: item.name, unit: item.unit, qty: 1, unitPricePaise: item.pricePaise }]
    };
  }),

  removeOne: (itemId) => set((s) => {
    const idx = s.lines.findIndex((l) => l.itemId === itemId);
    if (idx < 0) return {};
    const next = s.lines.slice();
    if (next[idx].qty <= 1) next.splice(idx, 1);
    else next[idx] = { ...next[idx], qty: next[idx].qty - 1 };
    return { lines: next };
  }),

  setQty: (itemId, qty) => set((s) => {
    if (qty <= 0) return { lines: s.lines.filter((l) => l.itemId !== itemId) };
    return { lines: s.lines.map((l) => (l.itemId === itemId ? { ...l, qty } : l)) };
  }),

  clear: () => set({ lines: [] }),

  subtotalPaise: () => get().lines.reduce((sum, l) => sum + l.qty * l.unitPricePaise, 0)
}));
