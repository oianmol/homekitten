import { create } from 'zustand';
import type { Kitchen, Item, MealWindow, Order } from '../model/types';
import * as stores from '../storage/stores';

// Sign: -1 to decrement (new order), +1 to restore (cancellation).
async function adjustMealQty(order: Order, sign: -1 | 1): Promise<void> {
  const meal = (await stores.listMeals()).find((m) => m.id === order.mealWindowId);
  if (!meal) return;
  let changed = false;
  const items = meal.items.map((mi) => {
    if (mi.availableQty == null) return mi;
    const line = order.items.find((l) => l.itemId === mi.itemId);
    if (!line) return mi;
    changed = true;
    return { ...mi, availableQty: Math.max(0, mi.availableQty + sign * line.qty) };
  });
  if (changed) await stores.putMeal({ ...meal, items });
}

interface AdminState {
  hydrated: boolean;
  kitchen: Kitchen | null;
  items: Item[];
  meals: MealWindow[];
  orders: Order[];

  hydrate: () => Promise<void>;

  saveKitchen: (k: Kitchen) => Promise<void>;
  saveItem: (item: Item) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  saveMeal: (m: MealWindow) => Promise<void>;
  deleteMeal: (id: string) => Promise<void>;
  upsertOrder: (o: Order) => Promise<{ added: boolean }>;
  updateOrderStatus: (id: string, status: Order['status']) => Promise<void>;
  updateOrderPayment: (id: string, paymentStatus: Order['paymentStatus']) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  hydrated: false,
  kitchen: null,
  items: [],
  meals: [],
  orders: [],

  hydrate: async () => {
    if (get().hydrated) return;
    const [kitchen, items, meals, orders] = await Promise.all([
      stores.getKitchen(),
      stores.listItems(),
      stores.listMeals(),
      stores.listOrders()
    ]);
    set({ hydrated: true, kitchen: kitchen ?? null, items, meals, orders });
  },

  saveKitchen: async (k) => {
    await stores.putKitchen(k);
    set({ kitchen: k });
  },

  saveItem: async (item) => {
    await stores.putItem(item);
    const items = await stores.listItems();
    set({ items });
  },

  deleteItem: async (id) => {
    await stores.deleteItem(id);
    set({ items: get().items.filter((i) => i.id !== id) });
  },

  saveMeal: async (m) => {
    await stores.putMeal(m);
    const meals = await stores.listMeals();
    set({ meals });
  },

  deleteMeal: async (id) => {
    await stores.deleteMeal(id);
    set({ meals: get().meals.filter((m) => m.id !== id) });
  },

  upsertOrder: async (o) => {
    const existing = await stores.getOrder(o.id);
    await stores.putOrder(o);
    // First time we see this order and it's active → decrement meal qty.
    if (!existing && o.status !== 'cancelled') {
      await adjustMealQty(o, -1);
    }
    const [orders, meals] = await Promise.all([stores.listOrders(), stores.listMeals()]);
    set({ orders, meals });
    return { added: !existing };
  },

  updateOrderStatus: async (id, status) => {
    const o = await stores.getOrder(id);
    if (!o) return;
    const wasActive = o.status !== 'cancelled';
    const willBeActive = status !== 'cancelled';
    const updated = { ...o, status };
    await stores.putOrder(updated);
    if (wasActive && !willBeActive) await adjustMealQty(o, +1);       // cancel → restore
    else if (!wasActive && willBeActive) await adjustMealQty(o, -1);  // un-cancel → decrement
    const meals = await stores.listMeals();
    set({ orders: get().orders.map((x) => (x.id === id ? updated : x)), meals });
  },

  updateOrderPayment: async (id, paymentStatus) => {
    const o = await stores.getOrder(id);
    if (!o) return;
    const updated = { ...o, paymentStatus };
    await stores.putOrder(updated);
    set({ orders: get().orders.map((x) => (x.id === id ? updated : x)) });
  }
}));
