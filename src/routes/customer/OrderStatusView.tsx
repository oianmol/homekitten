import { useEffect, useMemo, useState } from 'react';
import { decodeOrder } from '../../codec/orderCodec';
import { Card, Pill } from '../../components/ui';
import { paiseToRupees } from '../../lib/currency';
import { useAdminStore } from '../../state/adminStore';
import { navigate } from '../../lib/hashRoute';
import { nowIso, orderCode } from '../../lib/id';
import { findKitchenContact } from '../../state/customerHistory';
import { buildWaShareUrl } from '../../whatsapp/waMessage';
import type { Order } from '../../model/types';

export function OrderStatusView({ token }: { token: string }) {
  const parsed = useMemo(() => {
    try { return { ok: true as const, p: decodeOrder(token) }; }
    catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : String(e) }; }
  }, [token]);

  const { hydrated, hydrate, orders, kitchen, upsertOrder } = useAdminStore();
  useEffect(() => { hydrate(); }, [hydrate]);

  const [importState, setImportState] = useState<'idle' | 'importing' | 'imported' | 'existing' | 'wrong-kitchen' | 'customer'>('idle');

  useEffect(() => {
    if (!parsed.ok || !hydrated) return;
    if (!kitchen) { setImportState('customer'); return; }
    if (kitchen.id !== parsed.p.kitchenId) { setImportState('wrong-kitchen'); return; }
    const existing = orders.find((o) => o.id === parsed.p.order.id);
    if (existing) {
      setImportState('existing');
      navigate('/admin/orders');
      return;
    }
    setImportState('importing');
    const order: Order = {
      ...parsed.p.order,
      kitchenId: parsed.p.kitchenId,
      status: 'imported',
      paymentStatus: 'pending',
      importedAt: nowIso()
    };
    upsertOrder(order).then(() => {
      setImportState('imported');
      navigate('/admin/orders');
    });
  }, [parsed, hydrated, kitchen, orders, upsertOrder]);

  if (!parsed.ok) {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <div className="text-4xl mb-2">😕</div>
        <h1 className="text-xl font-semibold">Could not load order</h1>
        <p className="text-sm text-neutral-600 mt-2">{parsed.error}</p>
      </div>
    );
  }

  const ordSeed = parsed.p.order;
  const live = hydrated && kitchen && kitchen.id === parsed.p.kitchenId
    ? orders.find((o) => o.id === ordSeed.id)
    : undefined;

  if (importState === 'importing' || importState === 'imported' || importState === 'existing') {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <div className="text-4xl mb-2">📥</div>
        <h1 className="text-xl font-semibold">
          {importState === 'existing' ? 'Already imported' : 'Importing order…'}
        </h1>
        <p className="text-sm text-neutral-600 mt-2">Opening your Orders.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-1">Order</h1>
      <p className="text-sm text-neutral-500 mb-4">
        {importState === 'wrong-kitchen'
          ? "This order belongs to a different kitchen on this device."
          : 'Saved on this device.'}
      </p>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{ordSeed.customerName}</div>
            <div className="text-xs text-neutral-500">{new Date(ordSeed.placedAt).toLocaleString('en-IN')}</div>
          </div>
          {live ? (
            <Pill tone={live.status === 'completed' ? 'green' : live.status === 'cancelled' ? 'red' : 'amber'}>{live.status}</Pill>
          ) : (
            <Pill tone="neutral">{'submitted'}</Pill>
          )}
        </div>
        <ul className="mt-3 text-sm space-y-1">
          {ordSeed.items.map((l) => (
            <li key={l.itemId} className="flex justify-between">
              <span>{l.name} {l.unit ? <span className="text-neutral-500">({l.unit})</span> : null} × {l.qty}</span>
              <span>{paiseToRupees(l.lineTotalPaise)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 text-sm border-t border-neutral-200 pt-2 flex justify-between font-medium">
          <span>Total</span><span>{paiseToRupees(ordSeed.totalPaise)}</span>
        </div>
        <div className="text-xs text-neutral-500 mt-1 capitalize">{ordSeed.fulfillment}{ordSeed.address ? ' · ' + ordSeed.address : ''}</div>
      </Card>

      <RequestChange kitchenId={parsed.p.kitchenId} order={ordSeed} />

      <p className="text-sm text-neutral-500 text-center mt-4">
        For updates, message the kitchen on WhatsApp.
      </p>
    </div>
  );
}

function RequestChange({ kitchenId, order }: { kitchenId: string; order: { id: string; customerName: string; items: { name: string; qty: number }[] } }) {
  const contact = findKitchenContact(kitchenId);
  if (!contact?.whatsappPhone) {
    return (
      <p className="mt-4 text-xs text-neutral-500 text-center">
        Need to change something? Reply to the kitchen on WhatsApp where you got the menu link.
      </p>
    );
  }
  const code = orderCode(order.id);
  const summary = order.items.map((l) => `${l.name} × ${l.qty}`).join(', ');
  const body = [
    `Hi! I'd like to modify my order ${code}.`,
    '',
    `Current: ${summary}`,
    'Change request: ',
    '(please tell us what you want to add / remove / change)'
  ].join('\n');
  const url = buildWaShareUrl(contact.whatsappPhone, body);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-4 block w-full text-center px-4 py-3 rounded-xl font-medium bg-emerald-600 text-white hover:bg-emerald-700"
    >
      Request a change on WhatsApp
    </a>
  );
}
