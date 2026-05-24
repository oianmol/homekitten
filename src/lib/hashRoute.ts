import { useEffect, useState } from 'react';

export type Route =
  | { kind: 'landing' }
  | { kind: 'menu'; token: string }
  | { kind: 'checkout' }
  | { kind: 'order'; token: string }
  | { kind: 'admin'; subPath: string }
  | { kind: 'me' };

function parse(hash: string): Route {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!h) return { kind: 'landing' };

  if (h.startsWith('m=')) return { kind: 'menu', token: h.slice(2) };
  if (h.startsWith('o=')) return { kind: 'order', token: h.slice(2) };
  if (h === '/checkout') return { kind: 'checkout' };
  if (h === '/me' || h === '/orders') return { kind: 'me' };
  if (h === '/admin' || h.startsWith('/admin/')) {
    return { kind: 'admin', subPath: h.replace(/^\/admin\/?/, '') };
  }
  return { kind: 'landing' };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(hash: string) {
  window.location.hash = hash;
}
