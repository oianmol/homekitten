// All currency in paise (integer) to avoid floating-point pain.
// Phone numbers stored as digits-only "919876543210" (country code + number).

export type ISODateTime = string; // e.g. "2026-05-24T11:30:00+05:30"
export type ISODate = string;     // e.g. "2026-05-24"
export type UUID = string;

export type MealType = 'lunch' | 'dinner' | 'breakfast' | 'special';
export type Fulfillment = 'pickup' | 'delivery';

export type OrderStatus =
  | 'imported'    // just landed in admin's app
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled';

export type PaymentMethod = 'upi' | 'cash';
export type PaymentStatus = 'pending' | 'submitted' | 'verified' | 'rejected';

export interface Kitchen {
  id: UUID;
  slug: string;                  // label only; not enforced unique globally
  name: string;
  upiId: string;                 // e.g. "akanksha@okhdfcbank"
  whatsappPhone: string;         // digits only with country code
  address: string;
  logoUrl?: string;
  themeColor?: string;           // hex, e.g. "#f97316"
  createdAt: ISODateTime;
}

export interface Item {
  id: UUID;
  name: string;
  description?: string;
  pricePaise: number;
  imageUrl?: string;
  category?: string;
  unit?: string;                 // "250 ml", "1 pc", "250 gm"
  isActive: boolean;
  updatedAt: ISODateTime;
}

export interface MealItem {
  itemId: UUID;
  name: string;                  // denormalized for menu link self-containment
  pricePaise: number;
  unit?: string;
  imageUrl?: string;
  availableQty: number | null;   // null = unlimited
}

export interface MealWindow {
  id: UUID;
  date: ISODate;
  mealType: MealType;
  orderCutoffAt: ISODateTime;
  deliveryStartAt?: ISODateTime;
  deliveryEndAt?: ISODateTime;
  status: 'draft' | 'open' | 'closed' | 'fulfilled';
  notes?: string;
  items: MealItem[];
  deliveryFeePaise: number;
}

export interface CartLine {
  itemId: UUID;
  name: string;
  unit?: string;
  qty: number;
  unitPricePaise: number;
}

export interface OrderLine {
  itemId: UUID;
  name: string;
  unit?: string;
  qty: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}

export interface Order {
  id: UUID;
  kitchenId: UUID;
  mealWindowId: UUID;
  customerName: string;
  customerPhone: string;
  items: OrderLine[];
  fulfillment: Fulfillment;
  address?: string;
  notes?: string;
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  placedAt: ISODateTime;
  importedAt?: ISODateTime;
}

// What gets serialized into the menu URL fragment.
export interface MenuPayload {
  v: 1;                          // schema version
  kitchen: Pick<Kitchen, 'id' | 'slug' | 'name' | 'upiId' | 'whatsappPhone' | 'address' | 'logoUrl' | 'themeColor'>;
  meal: MealWindow;
}

// What gets serialized into the order URL fragment (HK1:...)
export interface OrderPayload {
  v: 1;
  kitchenId: UUID;
  order: Omit<Order, 'kitchenId' | 'status' | 'paymentStatus' | 'importedAt'>;
}
