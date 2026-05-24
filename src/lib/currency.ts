export function paiseToRupees(p: number): string {
  const r = (p / 100).toFixed(p % 100 === 0 ? 0 : 2);
  return `₹${r}`;
}

export function rupeesToPaise(r: number | string): number {
  const n = typeof r === 'string' ? parseFloat(r) : r;
  return Math.round(n * 100);
}
