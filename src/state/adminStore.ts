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

// Apply line-level delta: positive numbers consumed extra stock,
// negative numbers returned stock.
async function applyLineDeltas(mealId: string, deltas: Map<string, number>): Promise<void> {
  if (deltas.size === 0) return;
  const meal = (await stores.listMeals()).find((m) => m.id === mealId);
  if (!meal) return;
  const items = meal.items.map((mi) => {
    if (mi.availableQty == null) return mi;
    const delta = deltas.get(mi.itemId) ?? 0;
    if (delta === 0) return mi;
    return { ...mi, availableQty: Math.max(0, mi.availableQty - delta) };
  });
  await stores.putMeal({ ...meal, items });
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
  editOrder: (id: string, edits: { items?: Order['items']; notes?: string | undefined; fulfillment?: Order['fulfillment']; address?: string | undefined; deliveryFeePaise?: number }) => Promise<void>;
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
  },

  editOrder: async (id, edits) => {
    const o = await stores.getOrder(id);
    if (!o) return;

    const nextItems = edits.items ?? o.items;
    const nextFulfillment = edits.fulfillment ?? o.fulfillment;
    const nextDeliveryFee = edits.deliveryFeePaise ?? (nextFulfillment === 'delivery' ? o.deliveryFeePaise : 0);
    const subtotal = nextItems.reduce((s, l) => s + l.lineTotalPaise, 0);
    const total = subtotal + nextDeliveryFee;

    const updated: Order = {
      ...o,
      items: nextItems,
      notes: edits.notes !== undefined ? (edits.notes.trim() || undefined) : o.notes,
      fulfillment: nextFulfillment,
      address: edits.address !== undefined ? (edits.address.trim() || undefined) : o.address,
      deliveryFeePaise: nextDeliveryFee,
      subtotalPaise: subtotal,
      totalPaise: total
    };

    // Adjust meal qty by line deltas only if order is active (not cancelled).
    if (o.status !== 'cancelled' && edits.items) {
      const deltas = new Map<string, number>();
      const prevByItem = new Map(o.items.map((l) => [l.itemId, l.qty]));
      const nextByItem = new Map(nextItems.map((l) => [l.itemId, l.qty]));
      const ids = new Set<string>([...prevByItem.keys(), ...nextByItem.keys()]);
      for (const itemId of ids) {
        const prev = prevByItem.get(itemId) ?? 0;
        const next = nextByItem.get(itemId) ?? 0;
        if (next !== prev) deltas.set(itemId, next - prev);
      }
      await applyLineDeltas(o.mealWindowId, deltas);
    }

    await stores.putOrder(updated);
    const [orders, meals] = await Promise.all([stores.listOrders(), stores.listMeals()]);
    set({ orders, meals });
  }
}));
