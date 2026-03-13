export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'comp';
export type EventStatus = 'draft' | 'live' | 'paused' | 'closed';
export type OrderStatus = 'completed' | 'voided' | 'refunded';
export type LineType = 'inventory' | 'manual';
export type InventoryQuantity = number | null;

export interface OrderLine {
  type: LineType;
  itemId?: string;
  nameAtSale: string;
  unitPriceAtSale: number;
  qty: number;
  lineTotal: number;
  reason?: string;
}

export interface Order {
  orderId: string;
  createdAt: number;
  cashierId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  cashReceived?: number;
  changeGiven?: number;
  subtotal: number;
  total: number;
  lines: OrderLine[];
}

export interface EventItem {
  itemId: string;
  name: string;
  price: number;
  qtyRemaining: InventoryQuantity;
  createdAt: number;
  updatedAt: number;
}

export interface EventStats {
  totalRevenue: number;
  totalOrders: number;
  revenueByPayment: Record<PaymentMethod, number>;
  qtySoldByItemId: Record<string, number>;
  lastUpdatedAt: number;
}

export interface POSEvent {
  eventId: string;
  name: string;
  startTime: number;
  endTime?: number;
  status: EventStatus;
  createdAt: number;
  createdBy: string;
  defaultPaymentMethod?: PaymentMethod;
  items: Record<string, EventItem>;
  orders: Record<string, Order>;
  stats: EventStats;
}

export type POSEventSummary = Omit<POSEvent, 'items' | 'orders'>;

export interface AdminEventListItem extends POSEventSummary {
  itemCount: number;
}

export interface AdminUser {
  adminId: string;
  username: string;
  passwordHash: string;
  createdAt: number;
}

export interface AdminProfile {
  adminId: string;
  email: string;
  displayName: string;
  createdAt: number;
}

export interface CashierUser {
  cashierId: string;
  name: string;
  pinHash: string;
  createdAt: number;
}

export interface POSDatabase {
  schemaVersion: number;
  users: {
    admins: Record<string, AdminUser>;
    cashiers: Record<string, CashierUser>;
  };
  events: Record<string, POSEvent>;
  auditLog: AuditLogEntry[];
}

export interface AuditLogEntry {
  id: string;
  ts: number;
  type: string;
  meta: Record<string, unknown>;
}

export interface Session {
  role: 'admin' | 'cashier';
  adminId?: string;
  adminUsername?: string;
  cashierId?: string;
  cashierName?: string;
}

export interface CartLine {
  type: LineType;
  itemId?: string;
  name: string;
  unitPrice: number;
  qty: number;
  maxQty?: number;
  reason?: string;
}

export interface CommitOrderResult {
  order: Order;
  updatedStats: EventStats;
  updatedItemQuantities: Record<string, InventoryQuantity>;
}

export function createEmptyStats(): EventStats {
  return {
    totalRevenue: 0,
    totalOrders: 0,
    revenueByPayment: { cash: 0, card: 0, mobile: 0, comp: 0 },
    qtySoldByItemId: {},
    lastUpdatedAt: Date.now(),
  };
}

export function createEmptyDB(): POSDatabase {
  return {
    schemaVersion: 2,
    users: {
      admins: {},
      cashiers: {},
    },
    events: {},
    auditLog: [],
  };
}
