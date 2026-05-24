import { describe, it, expect } from 'vitest';
import { buildUpiLink } from '../src/upi/upiLink';
import { buildWaOrderText, buildWaMenuText, buildWaShareUrl } from '../src/whatsapp/waMessage';
import { encodeMenu } from '../src/codec/menuCodec';
import type { MenuPayload, OrderPayload } from '../src/model/types';

describe('upiLink', () => {
  it('builds a valid upi:// link', () => {
    const link = buildUpiLink({
      payeeVpa: 'sample@bank',
      payeeName: 'Sample Kitchen',
      amountPaise: 36000,
      transactionNote: 'ORDER ABC12',
      transactionRef: 'ABC12'
    });
    expect(link).toContain('upi://pay?');
    expect(link).toContain('pa=sample%40bank');
    expect(link).toContain('pn=Sample%20Kitchen');
    expect(link).toContain('am=360.00');
    expect(link).toContain('cu=INR');
    expect(link).toContain('tr=ABC12');
    expect(link).toContain('tn=ORDER%20ABC12');
  });
});

const order: OrderPayload = {
  v: 1,
  kitchenId: 'k-1',
  order: {
    id: 'o-1',
    mealWindowId: 'm-1',
    customerName: 'Anmol',
    customerPhone: '919876543210',
    items: [
      { itemId: 'i1', name: 'Paneer Curry', unit: '250 ml', qty: 2, unitPricePaise: 15000, lineTotalPaise: 30000 }
    ],
    fulfillment: 'pickup',
    subtotalPaise: 30000,
    deliveryFeePaise: 0,
    totalPaise: 30000,
    paymentMethod: 'upi',
    placedAt: '2026-05-24T10:30:00+05:30'
  }
};

describe('waMessage', () => {
  it('builds a readable WhatsApp order text containing the HK1: token', () => {
    const text = buildWaOrderText({ origin: 'https://homekitten.app', kitchenName: 'Sample Kitchen', payload: order });
    expect(text).toContain('Sample Kitchen');
    expect(text).toContain('Anmol');
    expect(text).toContain('Paneer Curry');
    expect(text).toContain('₹300');
    expect(text).toContain('HK1:');
  });

  it('builds a wa.me share URL with phone digits only', () => {
    const url = buildWaShareUrl('+91 9876543210', 'hi');
    expect(url).toBe('https://wa.me/919876543210?text=hi');
  });

  it('menu text stays under WhatsApp practical limit for 10 items', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      itemId: `i${i}`,
      name: `Item ${i}`,
      pricePaise: 10000 + i * 100,
      unit: '250 gm',
      availableQty: 10
    }));
    const menu: MenuPayload = {
      v: 1,
      kitchen: {
        id: 'k-1', slug: 'sample', name: 'Sample Kitchen',
        upiId: 'sample@bank', whatsappPhone: '919876543210',
        address: 'Sample Building, Flat 101'
      },
      meal: {
        id: 'm-1', date: '2026-05-24', mealType: 'lunch',
        orderCutoffAt: '2026-05-24T11:00:00+05:30',
        status: 'open', deliveryFeePaise: 2000, items
      }
    };
    const token = encodeMenu(menu);
    const text = buildWaMenuText({
      origin: 'https://homekitten.app',
      kitchenName: menu.kitchen.name,
      meal: menu.meal,
      menuToken: token,
      pickupLocation: 'Sample Building, Flat 101',
      contactPhone: '9876543210'
    });
    expect(text.length).toBeLessThan(2000);
  });
});
