import { useEffect, useMemo, useRef, useState } from 'react';
import { useAdminStore } from '../../state/adminStore';
import { Button, Card, Input, Modal, Pill, Textarea } from '../../components/ui';
import { paiseToRupees, rupeesToPaise } from '../../lib/currency';
import { extractOrderToken, decodeOrder } from '../../codec/orderCodec';
import type { Fulfillment, MealItem, Order, OrderLine, OrderStatus, PaymentStatus } from '../../model/types';
import { nowIso, orderCode } from '../../lib/id';
import { getBlob, putBlob } from '../../storage/stores';
import { buildCustomerStatusMessage, buildWaShareUrl } from '../../whatsapp/waMessage';

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  imported: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'completed'
};

const STATUS_TONE: Record<OrderStatus, 'neutral' | 'amber' | 'green' | 'red' | 'blue'> = {
  imported: 'amber',
  accepted: 'blue',
  preparing: 'blue',
  ready: 'green',
  completed: 'neutral',
  cancelled: 'red'
};

export function OrdersView() {
  const { orders, kitchen, meals, upsertOrder, updateOrderStatus, updateOrderPayment, editOrder } = useAdminStore();
  const [importOpen, setImportOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Order | null>(null);

  async function importFromPaste() {
    setPasteError(null);
    const token = extractOrderToken(paste);
    if (!token) { setPasteError('No HK1: token found in the pasted text.'); return; }
    try {
      const payload = decodeOrder(token);
      if (kitchen && payload.kitchenId !== kitchen.id) {
        setPasteError("This order doesn't belong to this kitchen.");
        return;
      }
      const order: Order = {
        ...payload.order,
        kitchenId: payload.kitchenId,
        status: 'imported',
        paymentStatus: 'pending',
        importedAt: nowIso()
      };
      const { added } = await upsertOrder(order);
      if (!added) setPasteError('Order already imported earlier — refreshed.');
      else { setPaste(''); setImportOpen(false); }
    } catch (e) {
      setPasteError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Orders</h1>
        <Button onClick={() => setImportOpen(true)}>Import order</Button>
      </div>

      {orders.length === 0 ? (
        <Card>
          <p className="text-neutral-600">No orders yet. When customers place orders, tap the link in their WhatsApp message or paste it here.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <Card key={o.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="font-medium">{o.customerName} <span className="text-neutral-500 text-sm font-normal">· {o.customerPhone}</span></div>
                  <div className="text-xs text-neutral-500 flex items-center gap-2">
                    <span className="font-mono px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700">#{orderCode(o.id)}</span>
                    <span>{new Date(o.placedAt).toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <PaymentProof orderId={o.id} onUploaded={() => updateOrderPayment(o.id, 'submitted')} />
                  <div className="flex flex-col items-end gap-1">
                    <Pill tone={STATUS_TONE[o.status]}>{o.status}</Pill>
                    <Pill tone={o.paymentStatus === 'verified' ? 'green' : o.paymentStatus === 'submitted' ? 'amber' : 'neutral'}>
                      pay: {o.paymentStatus}
                    </Pill>
                  </div>
                </div>
              </div>
              <ul className="mt-2 text-sm space-y-1">
                {o.items.map((l) => (
                  <li key={l.itemId} className="flex justify-between">
                    <span>{l.name} {l.unit ? <span className="text-neutral-500">({l.unit})</span> : null} × {l.qty}</span>
                    <span className="text-neutral-700">{paiseToRupees(l.lineTotalPaise)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-sm">
                <span className="font-medium">{paiseToRupees(o.totalPaise)}</span>
                <span className="text-neutral-500"> · {o.fulfillment}{o.address ? ' · ' + o.address : ''}</span>
              </div>
              {o.notes && <div className="mt-1 text-xs text-neutral-500">Notes: {o.notes}</div>}

              <div className="mt-3 flex flex-wrap gap-2">
                {NEXT_STATUS[o.status] && (
                  <Button onClick={() => updateOrderStatus(o.id, NEXT_STATUS[o.status]!)}>
                    Mark {NEXT_STATUS[o.status]}
                  </Button>
                )}
                {o.status !== 'completed' && o.status !== 'cancelled' && (
                  <Button variant="secondary" onClick={() => setEditing(o)}>Edit</Button>
                )}
                {o.status !== 'completed' && o.status !== 'cancelled' && (
                  <Button variant="ghost" onClick={() => updateOrderStatus(o.id, 'cancelled')}>Cancel</Button>
                )}
                <PaymentMenu current={o.paymentStatus} onSet={(p) => updateOrderPayment(o.id, p)} />
                <a className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium text-neutral-700 hover:bg-neutral-100"
                   href={`tel:${o.customerPhone}`}>Call</a>
                <a className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium text-neutral-700 hover:bg-neutral-100"
                   href={buildWaShareUrl(o.customerPhone, kitchen ? buildCustomerStatusMessage({ kitchenName: kitchen.name, order: o, code: orderCode(o.id) }) : '')}
                   target="_blank" rel="noreferrer">WhatsApp</a>
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <OrderEditor
          order={editing}
          meal={meals.find((m) => m.id === editing.mealWindowId) ?? null}
          onClose={() => setEditing(null)}
          onSave={async (edits) => { await editOrder(editing.id, edits); setEditing(null); }}
        />
      )}

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import order">
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            Tip: tap the order link in WhatsApp — it imports automatically. Or paste the whole message here.
          </p>
          <Textarea rows={6} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste the WhatsApp message containing HK1:… token" />
          {pasteError && <div className="text-sm text-red-600">{pasteError}</div>}
          <div className="flex gap-2">
            <Button onClick={importFromPaste} className="flex-1">Import</Button>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function OrderEditor({ order, meal, onClose, onSave }: {
  order: Order;
  meal: { items: MealItem[] } | null;
  onClose: () => void;
  onSave: (edits: { items: OrderLine[]; notes: string; fulfillment: Fulfillment; address: string; deliveryFeePaise: number }) => Promise<void>;
}) {
  const [lines, setLines] = useState<OrderLine[]>(order.items);
  const [notes, setNotes] = useState(order.notes ?? '');
  const [fulfillment, setFulfillment] = useState<Fulfillment>(order.fulfillment);
  const [address, setAddress] = useState(order.address ?? '');
  const [deliveryFee, setDeliveryFee] = useState((order.deliveryFeePaise / 100).toString());

  const inOrder = useMemo(() => new Set(lines.map((l) => l.itemId)), [lines]);
  const catalog = meal?.items ?? [];
  const subtotal = lines.reduce((s, l) => s + l.lineTotalPaise, 0);
  const total = subtotal + (fulfillment === 'delivery' ? rupeesToPaise(deliveryFee || '0') : 0);

  function setQty(itemId: string, qty: number) {
    setLines((s) => {
      if (qty <= 0) return s.filter((l) => l.itemId !== itemId);
      return s.map((l) => (l.itemId === itemId ? { ...l, qty, lineTotalPaise: qty * l.unitPricePaise } : l));
    });
  }

  function addFromCatalog(mi: MealItem) {
    setLines((s) => [...s, {
      itemId: mi.itemId,
      name: mi.name,
      unit: mi.unit,
      qty: 1,
      unitPricePaise: mi.pricePaise,
      lineTotalPaise: mi.pricePaise
    }]);
  }

  async function save() {
    await onSave({
      items: lines,
      notes,
      fulfillment,
      address,
      deliveryFeePaise: fulfillment === 'delivery' ? rupeesToPaise(deliveryFee || '0') : 0
    });
  }

  return (
    <Modal open onClose={onClose} title={`Edit order #${orderCode(order.id)}`}>
      <div className="space-y-3 max-h-[75vh] overflow-y-auto">
        <div>
          <div className="text-sm font-medium text-neutral-700 mb-1">Items</div>
          {lines.length === 0 && <div className="text-sm text-neutral-500">No items — add from catalog below.</div>}
          <ul className="space-y-1">
            {lines.map((l) => (
              <li key={l.itemId} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{l.name} {l.unit ? <span className="text-neutral-500">({l.unit})</span> : null}</span>
                <span className="text-neutral-700">{paiseToRupees(l.unitPricePaise)}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setQty(l.itemId, l.qty - 1)} className="w-7 h-7 rounded bg-neutral-100 hover:bg-neutral-200">−</button>
                  <span className="w-6 text-center">{l.qty}</span>
                  <button onClick={() => setQty(l.itemId, l.qty + 1)} className="w-7 h-7 rounded bg-brand text-white hover:bg-brand-600">+</button>
                </div>
                <span className="w-16 text-right text-neutral-700">{paiseToRupees(l.lineTotalPaise)}</span>
              </li>
            ))}
          </ul>
        </div>

        {catalog.length > 0 && catalog.some((mi) => !inOrder.has(mi.itemId)) && (
          <div>
            <div className="text-sm font-medium text-neutral-700 mb-1">Add from menu</div>
            <div className="grid gap-1">
              {catalog.filter((mi) => !inOrder.has(mi.itemId)).map((mi) => (
                <button key={mi.itemId} onClick={() => addFromCatalog(mi)}
                  className="flex items-center gap-2 text-left p-2 rounded hover:bg-neutral-50 border border-neutral-200">
                  <span className="flex-1">{mi.name} <span className="text-neutral-500 text-xs">{mi.unit}</span></span>
                  <span className="text-sm text-neutral-700">{paiseToRupees(mi.pricePaise)}</span>
                  <span className="text-xs text-brand-600">+ add</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <span className="block text-sm font-medium text-neutral-700 mb-1">Fulfillment</span>
          <div className="flex gap-2">
            {(['pickup', 'delivery'] as Fulfillment[]).map((f) => (
              <button key={f} onClick={() => setFulfillment(f)}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm ${fulfillment === f ? 'bg-brand text-white border-brand' : 'border-neutral-300'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        {fulfillment === 'delivery' && (
          <>
            <Textarea label="Delivery address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
            <Input label="Delivery fee (₹)" inputMode="decimal" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
          </>
        )}
        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="text-sm border-t border-neutral-200 pt-2">
          <div className="flex justify-between"><span>Subtotal</span><span>{paiseToRupees(subtotal)}</span></div>
          {fulfillment === 'delivery' && <div className="flex justify-between"><span>Delivery</span><span>{paiseToRupees(rupeesToPaise(deliveryFee || '0'))}</span></div>}
          <div className="flex justify-between font-semibold mt-1"><span>New total</span><span>{paiseToRupees(total)}</span></div>
          {total !== order.totalPaise && (
            <div className="text-xs text-amber-700 mt-1">
              Was {paiseToRupees(order.totalPaise)} — difference {paiseToRupees(Math.abs(total - order.totalPaise))} {total > order.totalPaise ? 'to collect' : 'to refund'}.
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={save} className="flex-1">Save changes</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function PaymentMenu({ current, onSet }: { current: PaymentStatus; onSet: (p: PaymentStatus) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen((x) => !x)}>Payment: {current}</Button>
      {open && (
        <div className="absolute z-10 mt-1 right-0 bg-white border border-neutral-200 rounded-lg shadow-lg p-1 w-44">
          {(['pending', 'submitted', 'verified', 'rejected'] as PaymentStatus[]).map((p) => (
            <button key={p} onClick={() => { onSet(p); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-neutral-100">
              Mark {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentProof({ orderId, onUploaded }: { orderId: string; onUploaded: () => void }) {
  const key = `payment-proof:${orderId}`;
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let revoked = '';
    getBlob(key).then((blob) => {
      if (blob) {
        const u = URL.createObjectURL(blob);
        revoked = u;
        setUrl(u);
      }
    });
    return () => { if (revoked) URL.revokeObjectURL(revoked); };
  }, [key]);

  async function onFile(file: File) {
    await putBlob(key, file);
    const u = URL.createObjectURL(file);
    setUrl(u);
    onUploaded();
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      {url ? (
        <button onClick={() => setZoom(true)} className="w-12 h-12 rounded-lg overflow-hidden border border-neutral-200" title="View payment proof">
          <img src={url} alt="payment proof" className="w-full h-full object-cover" />
        </button>
      ) : (
        <button onClick={() => inputRef.current?.click()}
          className="w-12 h-12 rounded-lg border border-dashed border-neutral-300 text-neutral-400 text-xl hover:bg-neutral-50"
          title="Attach payment screenshot">📎</button>
      )}
      {zoom && url && (
        <Modal open onClose={() => setZoom(false)} title="Payment proof">
          <img src={url} alt="payment proof" className="max-h-[70vh] w-full object-contain rounded" />
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={() => inputRef.current?.click()}>Replace</Button>
            <Button variant="ghost" onClick={() => setZoom(false)}>Close</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
