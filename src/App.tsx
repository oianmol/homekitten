import { useHashRoute } from './lib/hashRoute';
import { MenuView } from './routes/customer/MenuView';
import { CheckoutView } from './routes/customer/CheckoutView';
import { OrderStatusView } from './routes/customer/OrderStatusView';
import { AdminShell } from './routes/admin/AdminShell';
import { Landing } from './routes/Landing';
import { InstallPrompt } from './components/InstallPrompt';

export default function App() {
  const route = useHashRoute();

  let body: JSX.Element;
  if (route.kind === 'menu') body = <MenuView token={route.token} />;
  else if (route.kind === 'order') body = <OrderStatusView token={route.token} />;
  else if (route.kind === 'checkout') body = <CheckoutView />;
  else if (route.kind === 'admin') body = <AdminShell subPath={route.subPath} />;
  else body = <Landing />;

  return (
    <>
      {body}
      <InstallPrompt />
    </>
  );
}
