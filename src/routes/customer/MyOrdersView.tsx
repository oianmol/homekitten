import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Pill } from '../../components/ui';
import { paiseToRupees } from '../../lib/currency';
import { navigate } from '../../lib/hashRoute';
import { readAllHistory, readKitchenContacts, type HistoryEntry, type KitchenContact } from '../../state/customerHistory';

export function MyOrdersView() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [contacts, setContacts] = useState<KitchenContact[]>([]);

  useEffect(() => {
    setHistory(readAllHistory());
    setContacts(readKitchenContacts());
  }, []);

  const byKitchen = useMemo(() => groupBy(history, (h) => h.kitchenId), [history]);
  const kitchenIds = Array.from(byKitchen.keys());

  const totalSpentPaise = history.reduce((s, h) => s + h.totalPaise, 0);

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => navigate('')} className="text-sm text-neutral-500 hover:text-neutral-700">← Home</button>
        <span className="text-xs text-neutral-400">All data on this device</span>
      </div>

      <h1 className="text-2xl font-bold">Your orders</h1>
      <p className="text-sm text-neutral-600 mt-1">
        Orders you've placed through HomeKitten on this device, across every kitchen.
      </p>

      {history.length === 0 ? (
        <Card className="mt-6">
          <p className="text-neutral-600">
            You haven't placed any orders yet. Open a menu link your kitchen shared with you to get started.
          </p>
        </Card>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Orders" value={String(history.length)} />
            <Stat label="Kitchens" value={String(kitchenIds.length)} />
            <Stat label="Total spent" value={paiseToRupees(totalSpentPaise)} />
          </div>

          <div className="mt-6 space-y-6">
            {kitchenIds.map((kid) => {
              const items = byKitchen.get(kid)!;
              const kName = items[0].kitchenName;
              const contact = contacts.find((c) => c.kitchenId === kid);
              return (
                <section key={kid}>
                  <header className="flex items-center justify-between mb-2">
                    <div>
                      <h2 className="font-semibold">{kName}</h2>
                      <div className="text-xs text-neutral-500">{items.length} order{items.length === 1 ? '' : 's'}</div>
                    </div>
                    {contact?.lastMenuUrl && (
                      <a
                        href={contact.lastMenuUrl}
                        className="text-sm text-brand-600 hover:text-brand-700"
                      >
                        Open last menu →
                      </a>
                    )}
                  </header>
                  <div className="space-y-2">
                    {items.map((h) => (
                      <Card key={h.id}>
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-neutral-500">
                            {new Date(h.placedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                          <Pill tone="neutral">{h.mealLabel}</Pill>
                        </div>
                        <ul className="mt-2 text-sm space-y-0.5">
                          {h.lines.map((l) => (
                            <li key={l.itemId} className="flex justify-between">
                              <span>{l.name} {l.unit ? <span className="text-neutral-500">({l.unit})</span> : null} × {l.qty}</span>
                              <span>{paiseToRupees(l.qty * l.unitPricePaise)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 text-sm border-t border-neutral-200 pt-2 flex justify-between font-medium">
                          <span>Total</span><span>{paiseToRupees(h.totalPaise)}</span>
                        </div>
                        {contact?.whatsappPhone && (
                          <div className="mt-3">
                            <a
                              href={`https://wa.me/${contact.whatsappPhone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-emerald-700 hover:text-emerald-800"
                            >
                              Message kitchen on WhatsApp →
                            </a>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-10 text-center">
        <Button variant="ghost" onClick={() => navigate('')}>Back to home</Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-3 text-center">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="font-semibold text-lg leading-tight">{value}</div>
    </div>
  );
}

function groupBy<T, K>(arr: T[], keyFn: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const t of arr) {
    const k = keyFn(t);
    const cur = m.get(k);
    if (cur) cur.push(t);
    else m.set(k, [t]);
  }
  return m;
}
