import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate';

const enc = new TextEncoder();
const dec = new TextDecoder();

export function compress(s: string): Uint8Array {
  return gzipSync(strToU8(s), { level: 9 });
}

export function decompress(b: Uint8Array): string {
  return strFromU8(gunzipSync(b));
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function encodePayload(obj: unknown): string {
  const json = JSON.stringify(obj);
  return toBase64Url(compress(json));
}

export function decodePayload<T>(token: string): T {
  const bytes = fromBase64Url(token);
  return JSON.parse(decompress(bytes)) as T;
}

// Quiet usage of enc/dec to avoid tree-shake noise in tests if unused.
export const _internal = { enc, dec };
