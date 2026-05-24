// Checkout is rendered as a modal inside MenuView since cart state and menu
// data live together in the customer session. This file is kept as a
// placeholder for a future deep-link checkout route if needed.
export function CheckoutView() {
  return (
    <div className="p-6 max-w-md mx-auto text-center">
      <p className="text-neutral-600">Open a menu link from your kitchen to begin checkout.</p>
    </div>
  );
}
