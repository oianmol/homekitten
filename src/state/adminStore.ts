import { create } from 'zustand';
import type { Kitchen, Item, MealWindow, Order } from '../model/types';
import * as stores from '../storage/stores';

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
    const orders = await stores.listOrders();
    set({ orders });
    return { added: !existing };
  },

  updateOrderStatus: async (id, status) => {
    const o = await stores.getOrder(id);
    if (!o) return;
    const updated = { ...o, status };
    await stores.putOrder(updated);
    set({ orders: get().orders.map((x) => (x.id === id ? updated : x)) });
  },

  updateOrderPayment: async (id, paymentStatus) => {
    const o = await stores.getOrder(id);
    if (!o) return;
    const updated = { ...o, paymentStatus };
    await stores.putOrder(updated);
    set({ orders: get().orders.map((x) => (x.id === id ? updated : x)) });
  }
}));
