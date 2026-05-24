import { useEffect, useMemo, useState } from 'react';
import { useCartStore } from '../../state/cartStore';
import { decodeMenu } from '../../codec/menuCodec';
import { Button, Card, Input, Modal, Pill, Textarea } from '../../components/ui';
import { paiseToRupees } from '../../lib/currency';
import { uuid, nowIso, orderCode } from '../../lib/id';
import { buildUpiLink } from '../../upi/upiLink';
import { buildWaOrderText, buildWaShareUrl } from '../../whatsapp/waMessage';
import { siteRoot } from '../../lib/siteRoot';
import type { Fulfillment, MealItem, MenuPayload, OrderPayload } from '../../model/types';
import { appendHistory, readHistory, rememberKitchen, type HistoryEntry } from '../../state/customerHistory';
import { navigate } from '../../lib/hashRoute';
import { useInstall } from '../../lib/useInstall';

const REPEAT_KEY = 'hk-customer';

interface RepeatHint { name?: string; phone?: string; address?: string }

function loadRepeat(): RepeatHint {
  try { return JSON.parse(localStorage.getItem(REPEAT_KEY) ?? '{}'); } catch { return {}; }
}

function saveRepeat(h: RepeatHint) {
  try { localStorage.setItem(REPEAT_KEY, JSON.stringify(h)); } catch { /* ignore */ }
}

export function MenuView({ token }: { token: string }) {
  const payload = useMemo<MenuPayload | { error: string }>(() => {
    try { return decodeMenu(token); }
    catch (e) { return { error: e instanceof Error ? e.message : String(e) }; }
  }, [token]);

  if ('error' in payload) {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <div className="text-4xl mb-2">😕</div>
        <h1 className="text-xl font-semibold mb-2">Could not load menu</h1>
        <p className="text-sm text-neutral-600">{payload.error}</p>
        <p className="text-sm text-neutral-500 mt-4">Ask the kitchen to share the link again.</p>
      </div>
    );
  }

  return <MenuContent payload={payload} />;
}

function MenuContent({ payload }: { payload: MenuPayload }) {
  const { kitchen, meal } = payload;
  const lines = useCartStore((s) => s.lines);
  const subtotal = useCartStore((s) => s.subtotalPaise());
  const addOne = useCartStore((s) => s.addOne);
  const setQty = useCartStore((s) => s.setQty);
  const clear = useCartStore((s) => s.clear);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [reorderNote, setReorderNote] = useState<string | null>(null);
  useEffect(() => {
    setHistory(readHistory(kitchen.id));
    rememberKitchen({
      kitchenId: kitchen.id,
      kitchenName: kitchen.name,
      whatsappPhone: kitchen.whatsappPhone,
      lastMenuUrl: window.location.href,
      lastSeenAt: new Date().toISOString()
    });
  }, [kitchen.id, kitchen.name, kitchen.whatsappPhone]);

  function reorder(entry: HistoryEntry) {
    clear();
    const skipped: string[] = [];
    for (const l of entry.lines) {
      const mi = meal.items.find((m) => m.itemId === l.itemId);
      if (!mi) { skipped.push(l.name); continue; }
      if (mi.availableQty != null && mi.availableQty <= 0) { skipped.push(`${l.name} (sold out)`); continue; }
      const cap = mi.availableQty ?? Infinity;
      const qty = Math.min(l.qty, cap);
      for (let i = 0; i < qty; i++) addOne(mi);
    }
    setReorderNote(skipped.length ? `Reordered. Skipped: ${skipped.join(', ')}` : 'Reordered from your last visit.');
    window.setTimeout(() => setReorderNote(null), 4000);
  }

  const isOpen = meal.status === 'open';
  const cutoff = new Date(meal.orderCutoffAt);
  const cutoffPassed = !isNaN(cutoff.getTime()) && cutoff < new Date();
  const canOrder = isOpen && !cutoffPassed && lines.length > 0;

  const themeColor = kitchen.themeColor ?? '#f97316';

  return (
    <div className="min-h-screen pb-32" style={{ background: 'linear-gradient(180deg, ' + themeColor + '14, #fafafa)' }}>
      <header className="max-w-2xl mx-auto px-4 pt-6 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {kitchen.logoUrl ? (
              <img src={kitchen.logoUrl} alt="" className="w-14 h-14 rounded-2xl object-cover border border-white shadow" />
            ) : (
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow" style={{ background: themeColor }}>🍱</div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate">{kitchen.name}</h1>
              <div className="text-sm text-neutral-600 truncate">{kitchen.address}</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0 mt-1">
            <button onClick={() => navigate('/me')} className="text-xs text-neutral-500 hover:text-neutral-700">My orders</button>
            <AddToHomeButton kitchenName={kitchen.name} />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap text-sm">
          <Pill tone={isOpen && !cutoffPassed ? 'green' : 'red'}>
            {isOpen && !cutoffPassed ? `Orders open · cutoff ${formatTime(meal.orderCutoffAt)}` : cutoffPassed ? 'Orders closed (cutoff passed)' : `Orders ${meal.status}`}
          </Pill>
          <span className="text-neutral-500 capitalize">{meal.mealType} · {meal.date}</span>
        </div>
        {meal.notes && <div className="mt-2 text-sm text-neutral-700">{meal.notes}</div>}
      </header>

      {history.length > 0 && (
        <section className="max-w-2xl mx-auto px-4 pb-2">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Your past orders</div>
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
            {history.slice(0, 5).map((h) => (
              <button
                key={h.id}
                onClick={() => reorder(h)}
                className="shrink-0 min-w-[180px] text-left bg-white border border-neutral-200 rounded-xl p-3 hover:border-brand"
                disabled={!isOpen || cutoffPassed}
                title="Tap to reorder these items"
              >
                <div className="text-sm font-medium truncate">{h.lines.map((l) => l.name).join(', ')}</div>
                <div className="text-xs text-neutral-500 mt-1">{paiseToRupees(h.totalPaise)} · {new Date(h.placedAt).toLocaleDateString('en-IN')}</div>
                <div className="text-xs text-brand-600 mt-1">↻ Reorder</div>
              </button>
            ))}
          </div>
          {reorderNote && <div className="mt-2 text-xs text-emerald-700">{reorderNote}</div>}
        </section>
      )}

      <main className="max-w-2xl mx-auto px-4 space-y-2">
        {meal.items.map((it) => (
          <ItemRow
            key={it.itemId}
            item={it}
            qty={lines.find((l) => l.itemId === it.itemId)?.qty ?? 0}
            onAdd={() => addOne(it)}
            onSetQty={(q) => setQty(it.itemId, q)}
            disabled={!isOpen || cutoffPassed}
          />
        ))}
      </main>

      {lines.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-neutral-200 p-3 shadow-lg">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm text-neutral-500">{lines.reduce((s, l) => s + l.qty, 0)} items in cart</div>
              <div className="font-semibold">Subtotal {paiseToRupees(subtotal)}</div>
            </div>
            <Button onClick={() => setCheckoutOpen(true)} disabled={!canOrder}>
              Checkout
            </Button>
            <Button variant="ghost" onClick={clear}>Clear</Button>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <CheckoutModal
          payload={payload}
          onClose={() => setCheckoutOpen(false)}
          onPlaced={() => { clear(); setCheckoutOpen(false); }}
        />
      )}
    </div>
  );
}

function ItemRow({ item, qty, onAdd, onSetQty, disabled }: {
  item: MealItem;
  qty: number;
  onAdd: () => void;
  onSetQty: (q: number) => void;
  disabled?: boolean;
}) {
  const soldOut = item.availableQty != null && item.availableQty <= 0;
  return (
    <Card className="flex items-center gap-3">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover" />
      ) : (
        <div className="w-16 h-16 rounded-xl bg-neutral-100 flex items-center justify-center text-2xl">🍛</div>
      )}
      <div className="flex-1">
        <div className="font-medium">{item.name}</div>
        <div className="text-xs text-neutral-500">
          {item.unit ? <>{item.unit} · </> : null}
          {item.availableQty == null ? 'unlimited' : `${item.availableQty} left`}
        </div>
        <div className="mt-1 font-semibold">{paiseToRupees(item.pricePaise)}</div>
      </div>
      {soldOut ? <Pill tone="red">Sold out</Pill> : qty === 0 ? (
        <Button onClick={onAdd} disabled={disabled}>Add</Button>
      ) : (
        <div className="flex items-center gap-2">
          <button onClick={() => onSetQty(qty - 1)} className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200">−</button>
          <span className="w-6 text-center">{qty}</span>
          <button onClick={() => onSetQty(Math.min(qty + 1, item.availableQty ?? 99))} className="w-8 h-8 rounded-full bg-brand text-white hover:bg-brand-600" disabled={disabled || (item.availableQty != null && qty >= item.availableQty)}>+</button>
        </div>
      )}
    </Card>
  );
}

function CheckoutModal({ payload, onClose, onPlaced }: {
  payload: MenuPayload;
  onClose: () => void;
  onPlaced: () => void;
}) {
  const lines = useCartStore((s) => s.lines);
  const subtotal = useCartStore((s) => s.subtotalPaise());
  const hint = loadRepeat();
  const [name, setName] = useState(hint.name ?? '');
  const [phone, setPhone] = useState(hint.phone ?? '');
  const [fulfillment, setFulfillment] = useState<Fulfillment>('pickup');
  const [address, setAddress] = useState(hint.address ?? '');
  const [notes, setNotes] = useState('');
  const [placed, setPlaced] = useState<{ orderId: string; code: string; waUrl: string; upiUrl: string; text: string } | null>(null);

  const deliveryFee = fulfillment === 'delivery' ? payload.meal.deliveryFeePaise : 0;
  const total = subtotal + deliveryFee;
  const valid = name.trim() && phone.replace(/\D/g, '').length >= 10 && lines.length > 0 && (fulfillment === 'pickup' || address.trim());

  function place() {
    if (!valid) return;
    saveRepeat({ name: name.trim(), phone: phone.replace(/\D/g, ''), address: address.trim() });
    const orderId = uuid();
    const orderPayload: OrderPayload = {
      v: 1,
      kitchenId: payload.kitchen.id,
      order: {
        id: orderId,
        mealWindowId: payload.meal.id,
        customerName: name.trim(),
        customerPhone: phone.replace(/\D/g, ''),
        items: lines.map((l) => ({
          itemId: l.itemId,
          name: l.name,
          unit: l.unit,
          qty: l.qty,
          unitPricePaise: l.unitPricePaise,
          lineTotalPaise: l.qty * l.unitPricePaise
        })),
        fulfillment,
        address: fulfillment === 'delivery' ? address.trim() : undefined,
        notes: notes.trim() || undefined,
        subtotalPaise: subtotal,
        deliveryFeePaise: deliveryFee,
        totalPaise: total,
        paymentMethod: 'upi',
        placedAt: nowIso()
      }
    };
    appendHistory({
      id: orderId,
      kitchenId: payload.kitchen.id,
      kitchenName: payload.kitchen.name,
      mealId: payload.meal.id,
      mealLabel: `${payload.meal.mealType} · ${payload.meal.date}`,
      placedAt: orderPayload.order.placedAt,
      totalPaise: total,
      lines: lines.map((l) => ({ itemId: l.itemId, name: l.name, unit: l.unit, qty: l.qty, unitPricePaise: l.unitPricePaise }))
    });
    const origin = siteRoot();
    const text = buildWaOrderText({ origin, kitchenName: payload.kitchen.name, payload: orderPayload });
    const waUrl = buildWaShareUrl(payload.kitchen.whatsappPhone, text);
    const code = orderCode(orderId);
    const upiUrl = buildUpiLink({
      payeeVpa: payload.kitchen.upiId,
      payeeName: payload.kitchen.name,
      amountPaise: total,
      transactionNote: `Order ${code}`,
      transactionRef: code
    });
    setPlaced({ orderId, code, waUrl, upiUrl, text });
  }

  if (placed) {
    return <PlacedView placed={placed} total={total} onPlaced={onPlaced} onClose={onClose} />;
  }

  return (
    <Modal open onClose={onClose} title="Place order">
      <div className="space-y-3">
        <Input label="Your name *" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="WhatsApp phone *" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <div>
          <span className="block text-sm font-medium text-neutral-700 mb-1">Fulfillment</span>
          <div className="flex gap-2">
            {(['pickup', 'delivery'] as Fulfillment[]).map((f) => (
              <button key={f} onClick={() => setFulfillment(f)}
                className={`flex-1 px-3 py-2 rounded-lg border ${fulfillment === f ? 'bg-brand text-white border-brand' : 'border-neutral-300'}`}>
                {f === 'pickup' ? 'Pickup' : `Delivery (+${paiseToRupees(payload.meal.deliveryFeePaise)})`}
              </button>
            ))}
          </div>
        </div>
        {fulfillment === 'delivery' && (
          <Textarea label="Delivery address *" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
        )}
        <Textarea label="Notes (allergies, special requests)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="text-sm border-t border-neutral-200 pt-2">
          <div className="flex justify-between"><span>Subtotal</span><span>{paiseToRupees(subtotal)}</span></div>
          {deliveryFee > 0 && <div className="flex justify-between"><span>Delivery</span><span>{paiseToRupees(deliveryFee)}</span></div>}
          <div className="flex justify-between font-semibold mt-1"><span>Total</span><span>{paiseToRupees(total)}</span></div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={place} disabled={!valid} className="flex-1">Continue</Button>
          <Button variant="ghost" onClick={onClose}>Back</Button>
        </div>
      </div>
    </Modal>
  );
}

function AddToHomeButton({ kitchenName }: { kitchenName: string }) {
  const { installed, canPrompt, isIosNonStandalone, showIosHint, dismissIosHint, promptInstall } = useInstall();
  if (installed) return null;
  if (!canPrompt && !isIosNonStandalone) return null;
  return (
    <>
      <button
        onClick={() => promptInstall()}
        className="text-xs px-2 py-1 rounded-full bg-brand text-white hover:bg-brand-600"
        title={`Add ${kitchenName} to your home screen`}
      >
        + Home screen
      </button>
      {showIosHint && (
        <Modal open onClose={dismissIosHint} title="Add to Home Screen">
          <p className="text-sm text-neutral-700">
            On iPhone, tap the <span className="font-medium">Share</span> button in Safari's bottom bar,
            then choose <span className="font-medium">Add to Home Screen</span>. The current menu will
            be saved as an app icon.
          </p>
          <div className="mt-3 flex justify-end">
            <Button variant="ghost" onClick={dismissIosHint}>Got it</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function PlacedView({ placed, total, onPlaced, onClose }: {
  placed: { orderId: string; code: string; waUrl: string; upiUrl: string; text: string };
  total: number;
  onPlaced: () => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<'text' | 'url' | null>(null);
  function copy(kind: 'text' | 'url') {
    const value = kind === 'text' ? placed.text : `${siteRoot()}/#o=HK1:${placed.orderId}`;
    navigator.clipboard.writeText(kind === 'text' ? placed.text : value).then(() => {
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    });
  }
  return (
    <Modal open onClose={onClose} title="Order ready to send">
      <div className="space-y-3">
        <div className="rounded-xl bg-brand-50 border border-brand-100 p-3 text-center">
          <div className="text-xs uppercase tracking-wide text-brand-700">Your order code</div>
          <div className="text-2xl font-bold text-brand-700 font-mono tracking-widest">{placed.code}</div>
          <div className="text-xs text-neutral-600 mt-1">Share this with the kitchen if there's any payment question.</div>
        </div>
        <p className="text-sm text-neutral-700">Send the order to the kitchen on WhatsApp, then pay via UPI.</p>
        <a href={placed.waUrl} target="_blank" rel="noreferrer"
          className="block w-full text-center px-4 py-3 rounded-xl font-medium bg-emerald-600 text-white hover:bg-emerald-700">
          1. Send order on WhatsApp
        </a>
        <a href={placed.upiUrl}
          className="block w-full text-center px-4 py-3 rounded-xl font-medium bg-brand text-white hover:bg-brand-600">
          2. Pay {paiseToRupees(total)} via UPI
        </a>
        <p className="text-xs text-neutral-500 text-center">
          UPI note will read <span className="font-mono">Order {placed.code}</span>.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => copy('text')} className="flex-1">
            {copied === 'text' ? 'Copied ✓' : 'Copy WhatsApp text'}
          </Button>
        </div>
        <p className="text-xs text-neutral-500">
          No WhatsApp? Copy the text and paste it in any chat. Make sure the <code>HK1:</code> token is included.
        </p>
        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer">Preview message</summary>
          <pre className="mt-2 whitespace-pre-wrap break-all bg-neutral-50 p-2 rounded">{placed.text}</pre>
        </details>
        <Button variant="ghost" onClick={onPlaced}>Done</Button>
      </div>
    </Modal>
  );
}

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
  catch { return iso; }
}
