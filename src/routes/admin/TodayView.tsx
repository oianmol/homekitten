import { useMemo, useState } from 'react';
import { useAdminStore } from '../../state/adminStore';
import { Button, Card, Input, Modal, Pill, Textarea } from '../../components/ui';
import { paiseToRupees, rupeesToPaise } from '../../lib/currency';
import { uuid } from '../../lib/id';
import type { Item, MealItem, MealType, MealWindow, MenuPayload } from '../../model/types';
import { encodeMenu, buildMenuUrl } from '../../codec/menuCodec';
import { buildWaMenuText, buildWaShareUrl } from '../../whatsapp/waMessage';
import { QrImage } from '../../components/QrImage';
import { siteRoot } from '../../lib/siteRoot';

export function TodayView() {
  const { kitchen, items, meals, saveMeal, deleteMeal } = useAdminStore();
  const today = new Date().toISOString().slice(0, 10);
  const [editing, setEditing] = useState<MealWindow | null>(null);

  const todayMeals = useMemo(() => meals.filter((m) => m.date === today), [meals, today]);
  const upcomingOrPast = useMemo(() => meals.filter((m) => m.date !== today).slice(0, 5), [meals, today]);

  if (!kitchen) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Today</h1>
        <Button
          onClick={() => setEditing(blankMeal(today))}
          disabled={items.filter((i) => i.isActive).length === 0}
        >
          + New meal
        </Button>
      </div>

      {items.filter((i) => i.isActive).length === 0 && (
        <Card>
          <p className="text-neutral-600">Add a few items to your catalog before building a meal.</p>
        </Card>
      )}

      {todayMeals.length === 0 && items.length > 0 && (
        <Card>
          <p className="text-neutral-600">No meal planned yet for today.</p>
        </Card>
      )}

      {todayMeals.map((m) => (
        <MealCard key={m.id} meal={m} onEdit={() => setEditing(m)} onClose={async () => {
          await saveMeal({ ...m, status: 'closed' });
        }} onReopen={async () => {
          await saveMeal({ ...m, status: 'open' });
        }} />
      ))}

      {upcomingOrPast.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mt-6">Other dates</h2>
          {upcomingOrPast.map((m) => (
            <MealCard key={m.id} meal={m} onEdit={() => setEditing(m)} compact />
          ))}
        </>
      )}

      {editing && (
        <MealEditor
          meal={editing}
          items={items.filter((i) => i.isActive)}
          onClose={() => setEditing(null)}
          onSave={async (m) => { await saveMeal(m); setEditing(null); }}
          onDelete={async (id) => { await deleteMeal(id); setEditing(null); }}
        />
      )}
    </div>
  );
}

function MealCard({ meal, onEdit, onClose, onReopen, compact }: {
  meal: MealWindow;
  onEdit: () => void;
  onClose?: () => void | Promise<void>;
  onReopen?: () => void | Promise<void>;
  compact?: boolean;
}) {
  const { kitchen } = useAdminStore();
  const [shareOpen, setShareOpen] = useState(false);
  if (!kitchen) return null;

  const total = meal.items.reduce((s, i) => s + i.pricePaise, 0);
  const tone = meal.status === 'open' ? 'green' : meal.status === 'closed' ? 'neutral' : meal.status === 'fulfilled' ? 'blue' : 'amber';

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium capitalize">{meal.mealType} <span className="text-neutral-500 text-sm">· {meal.date}</span></div>
          <div className="text-xs text-neutral-500">{meal.items.length} items · {paiseToRupees(total)} grand</div>
        </div>
        <Pill tone={tone}>{meal.status}</Pill>
      </div>
      {!compact && (
        <>
          <ul className="mt-3 text-sm space-y-1">
            {meal.items.map((it) => (
              <li key={it.itemId} className="flex justify-between">
                <span>{it.name} {it.unit ? <span className="text-neutral-500">({it.unit})</span> : null}</span>
                <span className="text-neutral-700">
                  {paiseToRupees(it.pricePaise)} · {it.availableQty == null ? '∞' : it.availableQty} qty
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => setShareOpen(true)}>Share menu</Button>
            <Button variant="secondary" onClick={onEdit}>Edit</Button>
            {meal.status === 'open' && onClose && <Button variant="ghost" onClick={onClose}>Close orders</Button>}
            {meal.status === 'closed' && onReopen && <Button variant="ghost" onClick={onReopen}>Reopen</Button>}
          </div>
        </>
      )}
      {shareOpen && <ShareMenuModal meal={meal} onClose={() => setShareOpen(false)} />}
    </Card>
  );
}

function ShareMenuModal({ meal, onClose }: { meal: MealWindow; onClose: () => void }) {
  const { kitchen } = useAdminStore();
  if (!kitchen) return null;
  const origin = siteRoot();
  const payload: MenuPayload = {
    v: 1,
    kitchen: {
      id: kitchen.id, slug: kitchen.slug, name: kitchen.name,
      upiId: kitchen.upiId, whatsappPhone: kitchen.whatsappPhone,
      address: kitchen.address, logoUrl: kitchen.logoUrl, themeColor: kitchen.themeColor
    },
    meal
  };
  const token = encodeMenu(payload);
  const url = buildMenuUrl(origin, payload);
  const text = buildWaMenuText({
    origin,
    kitchenName: kitchen.name,
    meal,
    menuToken: token,
    pickupLocation: kitchen.address,
    contactPhone: kitchen.whatsappPhone
  });

  return (
    <Modal open onClose={onClose} title="Share menu">
      <div className="space-y-3">
        <div className="text-sm text-neutral-600">URL length: {url.length} chars · Message length: {text.length}</div>
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex flex-col items-center gap-1">
            <QrImage value={url} size={200} />
            <span className="text-xs text-neutral-500">Scan to open menu</span>
          </div>
          <Textarea readOnly rows={10} value={text} className="flex-1" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigator.clipboard.writeText(text)}>Copy message</Button>
          <Button variant="secondary" onClick={() => navigator.clipboard.writeText(url)}>Copy URL</Button>
          <a className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium bg-emerald-600 text-white hover:bg-emerald-700"
             href={buildWaShareUrl('', text)} target="_blank" rel="noreferrer">
            Open WhatsApp
          </a>
        </div>
        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer">Show raw URL</summary>
          <p className="break-all mt-2">{url}</p>
        </details>
      </div>
    </Modal>
  );
}

function blankMeal(date: string): MealWindow {
  return {
    id: uuid(),
    date,
    mealType: 'lunch',
    orderCutoffAt: `${date}T11:00:00`,
    deliveryStartAt: `${date}T12:30:00`,
    deliveryEndAt: `${date}T13:00:00`,
    status: 'draft',
    items: [],
    deliveryFeePaise: 2000
  };
}

function MealEditor({ meal, items, onClose, onSave, onDelete }: {
  meal: MealWindow;
  items: Item[];
  onClose: () => void;
  onSave: (m: MealWindow) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [mealType, setMealType] = useState<MealType>(meal.mealType);
  const [date, setDate] = useState(meal.date);
  const [cutoff, setCutoff] = useState(stripSec(meal.orderCutoffAt));
  const [start, setStart] = useState(stripSec(meal.deliveryStartAt ?? ''));
  const [end, setEnd] = useState(stripSec(meal.deliveryEndAt ?? ''));
  const [deliveryFee, setDeliveryFee] = useState((meal.deliveryFeePaise / 100).toString());
  const [notes, setNotes] = useState(meal.notes ?? '');
  const [mealItems, setMealItems] = useState<MealItem[]>(meal.items);
  const [status, setStatus] = useState(meal.status);

  const inMeal = new Set(mealItems.map((m) => m.itemId));
  const canSave = mealItems.length > 0;
  const isNew = !useAdminStore.getState().meals.some((m) => m.id === meal.id);

  function addItem(it: Item) {
    setMealItems((s) => [...s, {
      itemId: it.id, name: it.name, pricePaise: it.pricePaise, unit: it.unit, imageUrl: it.imageUrl, availableQty: 10
    }]);
  }
  function removeItem(id: string) { setMealItems((s) => s.filter((m) => m.itemId !== id)); }
  function setQty(id: string, qty: number | null) {
    setMealItems((s) => s.map((m) => (m.itemId === id ? { ...m, availableQty: qty } : m)));
  }

  async function save() {
    if (!canSave) return;
    await onSave({
      ...meal,
      date,
      mealType,
      orderCutoffAt: cutoff || `${date}T11:00:00`,
      deliveryStartAt: start || undefined,
      deliveryEndAt: end || undefined,
      deliveryFeePaise: rupeesToPaise(deliveryFee || '0'),
      notes: notes.trim() || undefined,
      items: mealItems,
      status: status === 'draft' ? 'open' : status
    });
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'New meal' : 'Edit meal'}>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-sm font-medium text-neutral-700 mb-1">Meal</span>
            <select value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300">
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="breakfast">Breakfast</option>
              <option value="special">Special</option>
            </select>
          </label>
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Order cutoff" type="datetime-local" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
          <Input label="Delivery start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input label="Delivery end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <Input label="Delivery fee (₹)" inputMode="decimal" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
        <Textarea label="Notes (e.g. 'Today South Indian!')" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div>
          <div className="text-sm font-medium text-neutral-700 mb-1">Items in this meal</div>
          {mealItems.length === 0 && <div className="text-sm text-neutral-500">Pick from catalog below.</div>}
          <ul className="space-y-1">
            {mealItems.map((mi) => (
              <li key={mi.itemId} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{mi.name} <span className="text-neutral-500">{mi.unit ? `(${mi.unit})` : ''}</span></span>
                <span className="text-neutral-700">{paiseToRupees(mi.pricePaise)}</span>
                <input
                  type="number"
                  min={0}
                  value={mi.availableQty ?? ''}
                  placeholder="∞"
                  onChange={(e) => setQty(mi.itemId, e.target.value === '' ? null : Number(e.target.value))}
                  className="w-16 px-2 py-1 rounded border border-neutral-300 text-right"
                />
                <button onClick={() => removeItem(mi.itemId)} className="text-red-600 text-sm">remove</button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-sm font-medium text-neutral-700 mb-1">Catalog</div>
          <div className="grid grid-cols-1 gap-1">
            {items.filter((i) => !inMeal.has(i.id)).map((i) => (
              <button key={i.id} onClick={() => addItem(i)}
                className="flex items-center gap-2 text-left p-2 rounded hover:bg-neutral-50 border border-neutral-200">
                <span className="flex-1">{i.name} <span className="text-neutral-500 text-xs">{i.unit}</span></span>
                <span className="text-sm text-neutral-700">{paiseToRupees(i.pricePaise)}</span>
                <span className="text-xs text-brand-600">+ add</span>
              </button>
            ))}
            {items.filter((i) => !inMeal.has(i.id)).length === 0 && (
              <div className="text-sm text-neutral-500">All catalog items already added.</div>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={!canSave} className="flex-1">{status === 'draft' ? 'Publish' : 'Save'}</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {!isNew && <Button variant="danger" onClick={() => onDelete(meal.id)}>Delete</Button>}
        </div>
        {!isNew && (
          <label className="text-xs text-neutral-500 flex items-center gap-2">
            <span>Status:</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as MealWindow['status'])} className="px-2 py-1 rounded border border-neutral-300 text-xs">
              <option value="draft">draft</option>
              <option value="open">open</option>
              <option value="closed">closed</option>
              <option value="fulfilled">fulfilled</option>
            </select>
          </label>
        )}
      </div>
    </Modal>
  );
}

function stripSec(iso: string): string {
  return iso ? iso.slice(0, 16) : '';
}
