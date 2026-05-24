import { describe, it, expect } from 'vitest';
import { encodeMenu, decodeMenu, buildMenuUrl } from '../src/codec/menuCodec';
import { encodeOrder, decodeOrder, extractOrderToken, ORDER_TOKEN_PREFIX } from '../src/codec/orderCodec';
import type { MenuPayload, OrderPayload } from '../src/model/types';

const sampleMenu: MenuPayload = {
  v: 1,
  kitchen: {
    id: 'k-1',
    slug: 'shriiji',
    name: 'Shriiji Kitchen',
    upiId: 'akanksha@okhdfcbank',
    whatsappPhone: '917455825552',
    address: 'Tower 3, Flat 607',
    themeColor: '#f97316'
  },
  meal: {
    id: 'm-1',
    date: '2026-05-24',
    mealType: 'lunch',
    orderCutoffAt: '2026-05-24T11:00:00+05:30',
    deliveryStartAt: '2026-05-24T12:30:00+05:30',
    deliveryEndAt: '2026-05-24T13:00:00+05:30',
    status: 'open',
    deliveryFeePaise: 2000,
    items: [
      { itemId: 'i1', name: 'Paneer Curry', pricePaise: 15000, unit: '250 ml', availableQty: 10 },
      { itemId: 'i2', name: 'Chapati', pricePaise: 1500, unit: '1 pc', availableQty: null },
      { itemId: 'i3', name: 'Jeera Rice', pricePaise: 6000, unit: '250 gm', availableQty: 8 }
    ]
  }
};

describe('menuCodec', () => {
  it('round-trips a menu payload', () => {
    const token = encodeMenu(sampleMenu);
    expect(token.length).toBeGreaterThan(0);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    const back = decodeMenu(token);
    expect(back).toEqual(sampleMenu);
  });

  it('builds a menu URL under the WhatsApp practical limit', () => {
    const url = buildMenuUrl('https://homekitten.app', sampleMenu);
    expect(url.startsWith('https://homekitten.app/#m=')).toBe(true);
    expect(url.length).toBeLessThan(1500);
  });

  it('rejects unsupported schema version', () => {
    const bad = { ...sampleMenu, v: 99 as unknown as 1 };
    const token = encodeMenu(bad as MenuPayload);
    expect(() => decodeMenu(token)).toThrow(/Unsupported menu schema/);
  });
});

const sampleOrder: OrderPayload = {
  v: 1,
  kitchenId: 'k-1',
  order: {
    id: 'o-1',
    mealWindowId: 'm-1',
    customerName: 'Anmol',
    customerPhone: '919876543210',
    items: [
      { itemId: 'i1', name: 'Paneer Curry', unit: '250 ml', qty: 2, unitPricePaise: 15000, lineTotalPaise: 30000 },
      { itemId: 'i2', name: 'Chapati', unit: '1 pc', qty: 4, unitPricePaise: 1500, lineTotalPaise: 6000 }
    ],
    fulfillment: 'pickup',
    subtotalPaise: 36000,
    deliveryFeePaise: 0,
    totalPaise: 36000,
    paymentMethod: 'upi',
    placedAt: '2026-05-24T10:30:00+05:30'
  }
};

describe('orderCodec', () => {
  it('round-trips an order payload with HK1: prefix', () => {
    const token = encodeOrder(sampleOrder);
    expect(token.startsWith(ORDER_TOKEN_PREFIX)).toBe(true);
    const back = decodeOrder(token);
    expect(back).toEqual(sampleOrder);
  });

  it('extracts HK1: token from arbitrary text', () => {
    const token = encodeOrder(sampleOrder);
    const text = `Hello here is my order:\n\nblah blah\n${token}\n\nthanks`;
    const found = extractOrderToken(text);
    expect(found).toBe(token);
    expect(decodeOrder(found!)).toEqual(sampleOrder);
  });

  it('handles missing optional fields', () => {
    const minimal: OrderPayload = {
      v: 1,
      kitchenId: 'k-1',
      order: {
        id: 'o-2',
        mealWindowId: 'm-1',
        customerName: 'X',
        customerPhone: '919999999999',
        items: [{ itemId: 'i1', name: 'X', qty: 1, unitPricePaise: 100, lineTotalPaise: 100 }],
        fulfillment: 'pickup',
        subtotalPaise: 100,
        deliveryFeePaise: 0,
        totalPaise: 100,
        paymentMethod: 'cash',
        placedAt: '2026-05-24T10:30:00+05:30'
      }
    };
    expect(decodeOrder(encodeOrder(minimal))).toEqual(minimal);
  });
});
