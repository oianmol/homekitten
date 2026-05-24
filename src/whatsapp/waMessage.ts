import type { MealWindow, Order, OrderPayload, OrderStatus } from '../model/types';
import { paiseToRupees } from '../lib/currency';
import { encodeOrder } from '../codec/orderCodec';
import { orderCode } from '../lib/id';

export interface BuildWaOrderMsgArgs {
  origin: string;          // e.g. https://homekitten.app
  kitchenName: string;
  payload: OrderPayload;
}

export function buildWaOrderText({ origin, kitchenName, payload }: BuildWaOrderMsgArgs): string {
  const o = payload.order;
  const code = orderCode(o.id);
  const lines: string[] = [];
  lines.push(`🍱 Order ${code} for ${kitchenName}`);
  lines.push(`From: ${o.customerName} (${o.customerPhone})`);
  lines.push('');
  for (const l of o.items) {
    const unit = l.unit ? ` (${l.unit})` : '';
    lines.push(`• ${l.name}${unit} × ${l.qty} — ${paiseToRupees(l.lineTotalPaise)}`);
  }
  lines.push('');
  lines.push(`Subtotal: ${paiseToRupees(o.subtotalPaise)}`);
  if (o.deliveryFeePaise > 0) lines.push(`Delivery: ${paiseToRupees(o.deliveryFeePaise)}`);
  lines.push(`Total: ${paiseToRupees(o.totalPaise)}`);
  lines.push(`Mode: ${o.fulfillment}${o.address ? ` — ${o.address}` : ''}`);
  if (o.notes) lines.push(`Notes: ${o.notes}`);
  lines.push(`UPI note: Order ${code}`);
  lines.push('');
  lines.push('— Open in HomeKitten —');
  lines.push(`${origin}/#o=${encodeOrder(payload)}`);
  return lines.join('\n');
}

export function buildWaShareUrl(adminPhone: string, body: string): string {
  // wa.me expects digits only, no '+'.
  const phone = adminPhone.replace(/\D/g, '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
}

// Auto-format a menu announcement matching the kitchens' existing style.
export interface BuildWaMenuMsgArgs {
  origin: string;
  kitchenName: string;
  meal: MealWindow;
  menuToken: string;       // already-encoded menu
  pickupLocation?: string;
  contactPhone?: string;
}

export function buildWaMenuText(a: BuildWaMenuMsgArgs): string {
  const m = a.meal;
  const lines: string[] = [];
  const mealLabel = m.mealType.charAt(0).toUpperCase() + m.mealType.slice(1);
  lines.push(`🍽️ ${a.kitchenName.toUpperCase()} — ${mealLabel.toUpperCase()} MENU`);
  lines.push('');
  for (const it of m.items) {
    const unit = it.unit ? ` (${it.unit})` : '';
    lines.push(`• ${it.name}${unit} — ${paiseToRupees(it.pricePaise)}`);
  }
  lines.push('');
  if (m.deliveryFeePaise > 0) lines.push(`🚚 Delivery: ${paiseToRupees(m.deliveryFeePaise)}`);
  lines.push(`⏰ Order by: ${formatTime(m.orderCutoffAt)}`);
  if (m.deliveryStartAt) lines.push(`📦 Pickup/Delivery: ${formatTime(m.deliveryStartAt)}${m.deliveryEndAt ? ' – ' + formatTime(m.deliveryEndAt) : ''}`);
  if (a.pickupLocation) lines.push(`📍 ${a.pickupLocation}`);
  if (a.contactPhone) lines.push(`📞 ${a.contactPhone}`);
  if (m.notes) { lines.push(''); lines.push(m.notes); }
  lines.push('');
  lines.push('👉 Place order:');
  lines.push(`${a.origin}/#m=${a.menuToken}`);
  return lines.join('\n');
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return iso;
  }
}

const STATUS_MESSAGES: Record<OrderStatus, (kitchenName: string) => string> = {
  imported: (k) => `Hi! ${k} received your order. We'll confirm shortly.`,
  accepted: (k) => `Hi! ${k} has accepted your order. We'll start preparing soon.`,
  preparing: (k) => `Your order is being prepared at ${k}.`,
  ready: (k) => `Your order from ${k} is ready.`,
  completed: (k) => `Thanks for ordering from ${k}! Hope you enjoyed the meal. ❤️`,
  cancelled: (k) => `Sorry — your order at ${k} couldn't be fulfilled and has been cancelled.`
};

export interface BuildCustomerStatusMsgArgs {
  kitchenName: string;
  order: Pick<Order, 'customerName' | 'status' | 'totalPaise' | 'fulfillment' | 'items'>;
}

export interface BuildCustomerStatusMsgArgsFull extends BuildCustomerStatusMsgArgs {
  code?: string;
}

export function buildCustomerStatusMessage(args: BuildCustomerStatusMsgArgsFull | BuildCustomerStatusMsgArgs): string {
  const { kitchenName, order } = args;
  const code = (args as BuildCustomerStatusMsgArgsFull).code;
  const lines: string[] = [];
  lines.push(`Hi ${order.customerName.split(' ')[0]},`);
  lines.push('');
  lines.push(STATUS_MESSAGES[order.status](kitchenName));
  if (code) lines.push(`Order ref: ${code}`);
  lines.push('');
  const summary = order.items.map((l) => `${l.name} × ${l.qty}`).join(', ');
  if (summary) lines.push(`Order: ${summary}`);
  lines.push(`Total: ${paiseToRupees(order.totalPaise)} · ${order.fulfillment}`);
  return lines.join('\n');
}
