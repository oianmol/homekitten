import { useEffect } from 'react';
import { useAdminStore } from '../../state/adminStore';
import { OnboardingView } from './OnboardingView';
import { TodayView } from './TodayView';
import { ItemsView } from './ItemsView';
import { OrdersView } from './OrdersView';
import { SettingsView } from './SettingsView';
import { navigate } from '../../lib/hashRoute';

const TABS: Array<{ key: string; label: string }> = [
  { key: '', label: 'Today' },
  { key: 'orders', label: 'Orders' },
  { key: 'items', label: 'Items' },
  { key: 'settings', label: 'Settings' }
];

export function AdminShell({ subPath }: { subPath: string }) {
  const { hydrated, kitchen, hydrate, orders } = useAdminStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return <div className="p-6 text-neutral-500">Loading…</div>;
  }

  if (!kitchen) {
    return <OnboardingView />;
  }

  const active = subPath || '';
  const openOrders = orders.filter((o) => o.status === 'imported' || o.status === 'accepted' || o.status === 'preparing').length;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-semibold">{kitchen.name}</div>
            <div className="text-xs text-neutral-500">{kitchen.slug}</div>
          </div>
          <button onClick={() => navigate('')} className="text-sm text-neutral-500 hover:text-neutral-700">Exit</button>
        </div>
        <nav className="max-w-3xl mx-auto px-2 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const isActive = active === t.key;
            const badge = t.key === 'orders' && openOrders > 0 ? openOrders : null;
            return (
              <button
                key={t.key}
                onClick={() => navigate(t.key ? `/admin/${t.key}` : '/admin')}
                className={`px-3 py-2 text-sm font-medium border-b-2 ${isActive ? 'border-brand text-brand-700' : 'border-transparent text-neutral-600 hover:text-neutral-900'}`}
              >
                {t.label}
                {badge !== null && <span className="ml-2 inline-flex px-1.5 py-0.5 rounded-full bg-brand text-white text-xs">{badge}</span>}
              </button>
            );
          })}
        </nav>
      </header>
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-4">
        {active === '' && <TodayView />}
        {active === 'orders' && <OrdersView />}
        {active === 'items' && <ItemsView />}
        {active === 'settings' && <SettingsView />}
      </main>
    </div>
  );
}
