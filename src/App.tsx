import { useHashRoute } from './lib/hashRoute';
import { MenuView } from './routes/customer/MenuView';
import { CheckoutView } from './routes/customer/CheckoutView';
import { OrderStatusView } from './routes/customer/OrderStatusView';
import { AdminShell } from './routes/admin/AdminShell';
import { Landing } from './routes/Landing';

export default function App() {
  const route = useHashRoute();

  if (route.kind === 'menu') return <MenuView token={route.token} />;
  if (route.kind === 'order') return <OrderStatusView token={route.token} />;
  if (route.kind === 'checkout') return <CheckoutView />;
  if (route.kind === 'admin') return <AdminShell subPath={route.subPath} />;
  return <Landing />;
}
