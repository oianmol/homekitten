export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (older browsers)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

// Short, copy-paste-friendly code derived from a UUID. Used as the order
// reference in UPI transaction notes and the WhatsApp message body so the
// admin can match payment receipts back to an order in a glance.
// Crockford base32 alphabet (no 0/1/I/O confusion).
const CROCKFORD = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export function orderCode(uuid: string): string {
  const hex = uuid.replace(/-/g, '').toLowerCase();
  // Parse high bits of UUID into a number and map into Crockford base32 (6 chars).
  let n = 0;
  for (let i = 0; i < 10; i++) {
    n = n * 16 + parseInt(hex[i] ?? '0', 16);
  }
  const len = CROCKFORD.length;
  let out = '';
  for (let i = 0; i < 6; i++) {
    out = CROCKFORD[n % len] + out;
    n = Math.floor(n / len);
  }
  return out;
}
