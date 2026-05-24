import type { MenuPayload } from '../model/types';
import { encodePayload, decodePayload } from '../lib/compress';

export function encodeMenu(payload: MenuPayload): string {
  return encodePayload(payload);
}

export function decodeMenu(token: string): MenuPayload {
  const p = decodePayload<MenuPayload>(token);
  if (p.v !== 1) throw new Error(`Unsupported menu schema version: ${p.v}`);
  return p;
}

export function buildMenuUrl(origin: string, payload: MenuPayload): string {
  return `${origin}/#m=${encodeMenu(payload)}`;
}
