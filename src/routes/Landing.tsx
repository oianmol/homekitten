import { navigate } from '../lib/hashRoute';

export function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-4">🍱</div>
      <h1 className="text-3xl font-bold mb-2">HomeKitten</h1>
      <p className="text-neutral-600 max-w-md mb-8">
        Home kitchens, structured ordering. Customers get a link, you get the order. No servers, no fees.
      </p>
      <button
        onClick={() => navigate('/admin')}
        className="px-6 py-3 rounded-xl bg-brand text-white font-medium hover:bg-brand-600"
      >
        I run a kitchen → Open admin
      </button>
      <p className="mt-8 text-sm text-neutral-500">
        Customers: open the link your kitchen shared.
      </p>
    </div>
  );
}
