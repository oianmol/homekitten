import { navigate } from '../lib/hashRoute';

export function Landing() {
  return (
    <div className="min-h-screen px-6 py-10 sm:py-16 max-w-3xl mx-auto">
      <header className="text-center">
        <div className="text-6xl mb-4">🍱</div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">HomeKitten</h1>
        <p className="mt-4 text-lg text-neutral-700 max-w-xl mx-auto">
          A simple way for home kitchens to take orders on WhatsApp — without juggling messages, spreadsheets, or apps that charge a cut.
        </p>
      </header>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={() => navigate('/admin')}
          className="px-6 py-3 rounded-xl bg-brand text-white font-medium hover:bg-brand-600 w-full sm:w-auto"
        >
          Set up my kitchen
        </button>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); navigate('/admin'); }}
          className="text-sm text-neutral-500 hover:text-neutral-700"
        >
          Already set up? Open admin →
        </a>
      </div>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 text-center">
          How it works
        </h2>
        <ol className="mt-4 grid sm:grid-cols-3 gap-4">
          <Step n={1} title="Build today's menu">
            Pick items from your reusable catalog, set how many portions you'll cook, and set an order cutoff time.
          </Step>
          <Step n={2} title="Share the link in your group">
            One tap creates a menu link and a ready-to-send WhatsApp message — or a QR code to print.
          </Step>
          <Step n={3} title="Get structured orders">
            Customers add items to a cart and send their order back through WhatsApp. Tap the link in their message and the order lands in your admin tab.
          </Step>
        </ol>
      </section>

      <section className="mt-10 grid sm:grid-cols-2 gap-3 text-sm text-neutral-700">
        <Bullet>Payments are direct UPI to your account. We never touch the money.</Bullet>
        <Bullet>All your data stays on your device. Export a backup any time.</Bullet>
        <Bullet>Works as a phone app — install from the browser, no Play Store needed.</Bullet>
        <Bullet>Free to use. No accounts, no monthly fees, no commissions.</Bullet>
      </section>

      <footer className="mt-12 border-t border-neutral-200 pt-6 text-center text-sm text-neutral-500 space-y-2">
        <p>
          <span className="font-medium text-neutral-700">Just here to order food?</span>{' '}
          Open the menu link your kitchen shared with you — this page is for kitchen owners.
        </p>
        <p>
          Already ordered before?{' '}
          <a href="#/me" onClick={(e) => { e.preventDefault(); navigate('/me'); }} className="text-brand-600 hover:text-brand-700">
            See your past orders →
          </a>
        </p>
      </footer>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="bg-white border border-neutral-200 rounded-2xl p-4">
      <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center font-semibold text-sm mb-2">{n}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600">{children}</p>
    </li>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-brand-600 mt-0.5">✓</span>
      <span>{children}</span>
    </div>
  );
}
