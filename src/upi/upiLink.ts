export interface UpiLinkArgs {
  payeeVpa: string;          // e.g. name@bank
  payeeName: string;
  amountPaise: number;
  transactionNote?: string;  // e.g. "ORDER ABC12"
  transactionRef?: string;   // e.g. order short id
  currency?: string;         // default INR
}

function enc(v: string) {
  return encodeURIComponent(v);
}

export function buildUpiLink(args: UpiLinkArgs): string {
  const params: string[] = [
    `pa=${enc(args.payeeVpa)}`,
    `pn=${enc(args.payeeName)}`,
    `am=${(args.amountPaise / 100).toFixed(2)}`,
    `cu=${args.currency ?? 'INR'}`
  ];
  if (args.transactionRef) params.push(`tr=${enc(args.transactionRef)}`);
  if (args.transactionNote) params.push(`tn=${enc(args.transactionNote)}`);
  return `upi://pay?${params.join('&')}`;
}
