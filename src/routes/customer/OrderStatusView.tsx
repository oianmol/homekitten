import { useMemo } from 'react';
import { decodeOrder } from '../../codec/orderCodec';
import { Card, Pill } from '../../components/ui';
import { paiseToRupees } from '../../lib/currency';
import { useAdminStore } from '../../state/adminStore';
import { useEffect } from 'react';

export function OrderStatusView({ token }: { token: string }) {
  const parsed = useMemo(() => {
    try { return { ok: true as const, p: decodeOrder(token) }; }
    catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : String(e) }; }
  }, [token]);

  const { hydrated, hydrate, orders, kitchen } = useAdminStore();
  useEffect(() => { hydrate(); }, [hydrate]);

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
  // If this device is the admin for this kitchen, look up live status.
  const live = hydrated && kitchen && kitchen.id === parsed.p.kitchenId
    ? orders.find((o) => o.id === ordSeed.id)
    : undefined;

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-1">Order</h1>
      <p className="text-sm text-neutral-500 mb-4">Saved on this device.</p>

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

      <p className="text-sm text-neutral-500 text-center mt-4">
        For updates, message the kitchen on WhatsApp.
      </p>
    </div>
  );
}
