import type { OrderPayload } from '../model/types';
import { encodePayload, decodePayload } from '../lib/compress';

export const ORDER_TOKEN_PREFIX = 'HK1:';

export function encodeOrder(payload: OrderPayload): string {
  return ORDER_TOKEN_PREFIX + encodePayload(payload);
}

export function decodeOrder(token: string): OrderPayload {
  const stripped = token.startsWith(ORDER_TOKEN_PREFIX) ? token.slice(ORDER_TOKEN_PREFIX.length) : token;
  const p = decodePayload<OrderPayload>(stripped);
  if (p.v !== 1) throw new Error(`Unsupported order schema version: ${p.v}`);
  return p;
}

export function buildOrderUrl(origin: string, payload: OrderPayload): string {
  return `${origin}/#o=${encodeOrder(payload)}`;
}

// Extract first HK1: token from arbitrary text (e.g. pasted WA message).
export function extractOrderToken(text: string): string | null {
  const m = text.match(/HK1:[A-Za-z0-9_-]+/);
  return m ? m[0] : null;
}
