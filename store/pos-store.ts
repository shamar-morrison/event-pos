import { create } from 'zustand';
import {
  POSDatabase,
  Session,
  CartLine,
  Order,
  OrderLine,
  EventItem,
  POSEvent,
  PaymentMethod,
  EventStatus,
  createEmptyDB,
  createEmptyStats,
} from '@/types/pos';
import { loadDB, saveDB, loadSession, saveSession } from '@/db/database';
import { hashPin, verifyPin, hashPassword, verifyPassword } from '@/utils/pin';
import { generateId } from '@/utils/uuid';

let commitLock = false;

interface PosStore {
  db: POSDatabase;
  session: Session | null;
  isInitialized: boolean;
  cart: CartLine[];
  currentEventId: string | null;

  initialize: () => Promise<void>;

  setupAdmin: (username: string, password: string) => Promise<void>;
  loginAdmin: (username: string, password: string) => Promise<boolean>;
  hasAdmins: () => boolean;
  loginCashier: (cashierId: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;

  createEvent: (name: string) => Promise<string>;
  updateEventStatus: (eventId: string, status: EventStatus) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;

  addItem: (eventId: string, name: string, priceCents: number, qty: number) => Promise<string>;
  restockItem: (eventId: string, itemId: string, additionalQty: number) => Promise<void>;
  setItemQuantity: (eventId: string, itemId: string, newQty: number) => Promise<void>;
  removeItem: (eventId: string, itemId: string) => Promise<void>;
  setDefaultPaymentMethod: (eventId: string, method: PaymentMethod | undefined) => Promise<void>;

  createCashier: (name: string, pin: string) => Promise<string>;
  removeCashier: (cashierId: string) => Promise<void>;

  setCurrentEvent: (eventId: string | null) => void;
  addToCart: (line: CartLine) => void;
  incrementCartLine: (index: number) => void;
  decrementCartLine: (index: number) => void;
  removeCartLine: (index: number) => void;
  clearCart: () => void;

  commitOrder: (paymentMethod: PaymentMethod, cashReceivedCents?: number) => Promise<Order>;

  getEvent: (eventId: string) => POSEvent | undefined;
  getLiveEvents: () => POSEvent[];
  getCartTotal: () => number;
  getCartItemCount: () => number;
  getEventExportJSON: (eventId: string) => string | null;
  importEventFromJSON: (json: string) => Promise<string>;
}

export const usePosStore = create<PosStore>((set, get) => ({
  db: createEmptyDB(),
  session: null,
  isInitialized: false,
  cart: [],
  currentEventId: null,

  initialize: async () => {
    console.log('[Store] Initializing...');
    const [db, session] = await Promise.all([loadDB(), loadSession()]);
    set({ db, session, isInitialized: true });
    console.log('[Store] Initialized. Admins count:', Object.keys(db.users.admins).length);
  },

  setupAdmin: async (username: string, password: string) => {
    const { db } = get();
    const adminId = generateId();
    const passwordHash = await hashPassword(password);
    const now = Date.now();
    const adminUser = { adminId, username: username.trim(), passwordHash, createdAt: now };
    const updatedDb: POSDatabase = {
      ...db,
      users: {
        ...db.users,
        admins: { ...db.users.admins, [adminId]: adminUser },
      },
      auditLog: [
        ...db.auditLog,
        { id: generateId(), ts: now, type: 'admin_setup', meta: { adminId, username: username.trim() } },
      ],
    };
    await saveDB(updatedDb);
    const session: Session = { role: 'admin', adminId, adminUsername: username.trim() };
    await saveSession(session);
    set({ db: updatedDb, session });
    console.log('[Store] Admin setup complete:', username.trim());
  },

  loginAdmin: async (username: string, password: string) => {
    const { db } = get();
    const admins = Object.values(db.users.admins);
    const admin = admins.find((a) => a.username.toLowerCase() === username.trim().toLowerCase());
    if (!admin) return false;
    const valid = await verifyPassword(password, admin.passwordHash);
    if (valid) {
      const session: Session = { role: 'admin', adminId: admin.adminId, adminUsername: admin.username };
      await saveSession(session);
      set({ session });
      console.log('[Store] Admin logged in:', admin.username);
    }
    return valid;
  },

  hasAdmins: () => {
    const { db } = get();
    return Object.keys(db.users.admins).length > 0;
  },

  loginCashier: async (cashierId: string, pin: string) => {
    const { db } = get();
    const cashier = db.users.cashiers[cashierId];
    if (!cashier) return false;
    const valid = await verifyPin(pin, cashier.pinHash);
    if (valid) {
      const session: Session = {
        role: 'cashier',
        cashierId: cashier.cashierId,
        cashierName: cashier.name,
      };
      await saveSession(session);
      set({ session });
      console.log('[Store] Cashier logged in:', cashier.name);
    }
    return valid;
  },

  logout: async () => {
    await saveSession(null);
    set({ session: null, cart: [], currentEventId: null });
    console.log('[Store] Logged out');
  },

  createEvent: async (name: string) => {
    const { db } = get();
    const eventId = generateId();
    const now = Date.now();
    const event: POSEvent = {
      eventId,
      name,
      startTime: now,
      status: 'draft',
      createdAt: now,
      createdBy: 'admin',
      items: {},
      orders: {},
      stats: createEmptyStats(),
    };
    const updatedDb: POSDatabase = {
      ...db,
      events: { ...db.events, [eventId]: event },
      auditLog: [
        ...db.auditLog,
        { id: generateId(), ts: now, type: 'event_created', meta: { eventId, name } },
      ],
    };
    await saveDB(updatedDb);
    set({ db: updatedDb });
    console.log('[Store] Event created:', name);
    return eventId;
  },

  updateEventStatus: async (eventId: string, status: EventStatus) => {
    const { db } = get();
    const event = db.events[eventId];
    if (!event) throw new Error('Event not found');

    const updates: Partial<POSEvent> = { status };
    if (status === 'closed') {
      updates.endTime = Date.now();
    }

    const updatedDb: POSDatabase = {
      ...db,
      events: {
        ...db.events,
        [eventId]: { ...event, ...updates },
      },
      auditLog: [
        ...db.auditLog,
        { id: generateId(), ts: Date.now(), type: 'event_status_changed', meta: { eventId, from: event.status, to: status } },
      ],
    };
    await saveDB(updatedDb);
    set({ db: updatedDb });
    console.log('[Store] Event status changed:', event.name, '->', status);
  },

  deleteEvent: async (eventId: string) => {
    const { db } = get();
    const { [eventId]: _, ...remainingEvents } = db.events;
    const updatedDb: POSDatabase = {
      ...db,
      events: remainingEvents,
      auditLog: [
        ...db.auditLog,
        { id: generateId(), ts: Date.now(), type: 'event_deleted', meta: { eventId } },
      ],
    };
    await saveDB(updatedDb);
    set({ db: updatedDb });
  },

  addItem: async (eventId: string, name: string, priceCents: number, qty: number) => {
    const { db } = get();
    const event = db.events[eventId];
    if (!event) throw new Error('Event not found');

    const itemId = generateId();
    const now = Date.now();
    const item: EventItem = {
      itemId,
      name,
      price: priceCents,
      qtyRemaining: qty,
      createdAt: now,
      updatedAt: now,
    };

    const updatedDb: POSDatabase = {
      ...db,
      events: {
        ...db.events,
        [eventId]: {
          ...event,
          items: { ...event.items, [itemId]: item },
        },
      },
      auditLog: [
        ...db.auditLog,
        { id: generateId(), ts: now, type: 'item_added', meta: { eventId, itemId, name, priceCents, qty } },
      ],
    };
    await saveDB(updatedDb);
    set({ db: updatedDb });
    console.log('[Store] Item added:', name);
    return itemId;
  },

  restockItem: async (eventId: string, itemId: string, additionalQty: number) => {
    const { db } = get();
    const event = db.events[eventId];
    if (!event) throw new Error('Event not found');
    const item = event.items[itemId];
    if (!item) throw new Error('Item not found');

    const updatedDb: POSDatabase = {
      ...db,
      events: {
        ...db.events,
        [eventId]: {
          ...event,
          items: {
            ...event.items,
            [itemId]: {
              ...item,
              qtyRemaining: item.qtyRemaining + additionalQty,
              updatedAt: Date.now(),
            },
          },
        },
      },
      auditLog: [
        ...db.auditLog,
        { id: generateId(), ts: Date.now(), type: 'item_restocked', meta: { eventId, itemId, additionalQty } },
      ],
    };
    await saveDB(updatedDb);
    set({ db: updatedDb });
    console.log('[Store] Item restocked:', item.name, '+', additionalQty);
  },

  setItemQuantity: async (eventId: string, itemId: string, newQty: number) => {
    const { db } = get();
    const event = db.events[eventId];
    if (!event) throw new Error('Event not found');
    const item = event.items[itemId];
    if (!item) throw new Error('Item not found');
    if (newQty < 0) throw new Error('Quantity cannot be negative');

    const updatedDb: POSDatabase = {
      ...db,
      events: {
        ...db.events,
        [eventId]: {
          ...event,
          items: {
            ...event.items,
            [itemId]: {
              ...item,
              qtyRemaining: newQty,
              updatedAt: Date.now(),
            },
          },
        },
      },
      auditLog: [
        ...db.auditLog,
        { id: generateId(), ts: Date.now(), type: 'item_qty_set', meta: { eventId, itemId, from: item.qtyRemaining, to: newQty } },
      ],
    };
    await saveDB(updatedDb);
    set({ db: updatedDb });
    console.log('[Store] Item qty set:', item.name, '->', newQty);
  },

  removeItem: async (eventId: string, itemId: string) => {
    const { db } = get();
    const event = db.events[eventId];
    if (!event) throw new Error('Event not found');
    const { [itemId]: _, ...remainingItems } = event.items;
    const updatedDb: POSDatabase = {
      ...db,
      events: {
        ...db.events,
        [eventId]: { ...event, items: remainingItems },
      },
    };
    await saveDB(updatedDb);
    set({ db: updatedDb });
  },

  createCashier: async (name: string, pin: string) => {
    const { db } = get();
    const cashierId = generateId();
    const pinHash = await hashPin(pin);
    const updatedDb: POSDatabase = {
      ...db,
      users: {
        ...db.users,
        cashiers: {
          ...db.users.cashiers,
          [cashierId]: { cashierId, name, pinHash, createdAt: Date.now() },
        },
      },
      auditLog: [
        ...db.auditLog,
        { id: generateId(), ts: Date.now(), type: 'cashier_created', meta: { cashierId, name } },
      ],
    };
    await saveDB(updatedDb);
    set({ db: updatedDb });
    console.log('[Store] Cashier created:', name);
    return cashierId;
  },

  setDefaultPaymentMethod: async (eventId: string, method: PaymentMethod | undefined) => {
    const { db } = get();
    const event = db.events[eventId];
    if (!event) throw new Error('Event not found');

    const updatedDb: POSDatabase = {
      ...db,
      events: {
        ...db.events,
        [eventId]: {
          ...event,
          defaultPaymentMethod: method,
        },
      },
      auditLog: [
        ...db.auditLog,
        { id: generateId(), ts: Date.now(), type: 'default_payment_set', meta: { eventId, method } },
      ],
    };
    await saveDB(updatedDb);
    set({ db: updatedDb });
    console.log('[Store] Default payment set:', method);
  },

  removeCashier: async (cashierId: string) => {
    const { db } = get();
    const { [cashierId]: _, ...remaining } = db.users.cashiers;
    const updatedDb: POSDatabase = {
      ...db,
      users: { ...db.users, cashiers: remaining },
      auditLog: [
        ...db.auditLog,
        { id: generateId(), ts: Date.now(), type: 'cashier_removed', meta: { cashierId } },
      ],
    };
    await saveDB(updatedDb);
    set({ db: updatedDb });
  },

  setCurrentEvent: (eventId: string | null) => {
    set({ currentEventId: eventId, cart: [] });
  },

  addToCart: (line: CartLine) => {
    const { cart } = get();
    if (line.type === 'inventory' && line.itemId) {
      const existingIndex = cart.findIndex(
        (l) => l.type === 'inventory' && l.itemId === line.itemId
      );
      if (existingIndex >= 0) {
        const existing = cart[existingIndex];
        const maxQty = existing.maxQty ?? Infinity;
        if (existing.qty >= maxQty) return;
        const updated = [...cart];
        updated[existingIndex] = { ...existing, qty: existing.qty + 1 };
        set({ cart: updated });
        return;
      }
    }
    set({ cart: [...cart, { ...line, qty: 1 }] });
  },

  incrementCartLine: (index: number) => {
    const { cart } = get();
    const line = cart[index];
    if (!line) return;
    if (line.type === 'inventory' && line.maxQty !== undefined && line.qty >= line.maxQty) return;
    const updated = [...cart];
    updated[index] = { ...line, qty: line.qty + 1 };
    set({ cart: updated });
  },

  decrementCartLine: (index: number) => {
    const { cart } = get();
    const line = cart[index];
    if (!line) return;
    if (line.qty <= 1) {
      set({ cart: cart.filter((_, i) => i !== index) });
    } else {
      const updated = [...cart];
      updated[index] = { ...line, qty: line.qty - 1 };
      set({ cart: updated });
    }
  },

  removeCartLine: (index: number) => {
    const { cart } = get();
    set({ cart: cart.filter((_, i) => i !== index) });
  },

  clearCart: () => {
    set({ cart: [] });
  },

  commitOrder: async (paymentMethod: PaymentMethod, cashReceivedCents?: number) => {
    if (commitLock) {
      throw new Error('An order is already being processed. Please wait.');
    }
    commitLock = true;

    try {
      const { db, session, cart, currentEventId } = get();

      if (!session || session.role !== 'cashier' || !session.cashierId) {
        throw new Error('Not authorized to place orders');
      }
      if (!currentEventId) throw new Error('No event selected');
      if (cart.length === 0) throw new Error('Cart is empty');

      const event = db.events[currentEventId];
      if (!event) throw new Error('Event not found');
      if (event.status !== 'live') throw new Error('Event is not currently live');

      for (const line of cart) {
        if (line.type === 'inventory' && line.itemId) {
          const item = event.items[line.itemId];
          if (!item) throw new Error(`Item "${line.name}" no longer exists`);
          if (item.qtyRemaining < line.qty) {
            throw new Error(`Not enough "${line.name}" in stock (${item.qtyRemaining} remaining)`);
          }
        }
      }

      const orderId = generateId();
      const now = Date.now();

      const subtotal = cart.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
      const total = subtotal;

      const orderLines: OrderLine[] = cart.map((l) => ({
        type: l.type,
        itemId: l.itemId,
        nameAtSale: l.name,
        unitPriceAtSale: l.unitPrice,
        qty: l.qty,
        lineTotal: l.unitPrice * l.qty,
        reason: l.reason,
      }));

      let changeGiven: number | undefined;
      if (paymentMethod === 'cash' && cashReceivedCents !== undefined) {
        changeGiven = cashReceivedCents - total;
      }

      const order: Order = {
        orderId,
        createdAt: now,
        cashierId: session.cashierId,
        status: 'completed',
        paymentMethod,
        cashReceived: cashReceivedCents,
        changeGiven,
        subtotal,
        total,
        lines: orderLines,
      };

      const updatedItems = { ...event.items };
      for (const line of cart) {
        if (line.type === 'inventory' && line.itemId && updatedItems[line.itemId]) {
          const item = updatedItems[line.itemId];
          updatedItems[line.itemId] = {
            ...item,
            qtyRemaining: item.qtyRemaining - line.qty,
            updatedAt: now,
          };
        }
      }

      const updatedStats = {
        totalRevenue: event.stats.totalRevenue + total,
        totalOrders: event.stats.totalOrders + 1,
        revenueByPayment: {
          ...event.stats.revenueByPayment,
          [paymentMethod]: (event.stats.revenueByPayment[paymentMethod] || 0) + total,
        },
        qtySoldByItemId: { ...event.stats.qtySoldByItemId },
        lastUpdatedAt: now,
      };

      for (const line of cart) {
        if (line.type === 'inventory' && line.itemId) {
          updatedStats.qtySoldByItemId[line.itemId] =
            (updatedStats.qtySoldByItemId[line.itemId] || 0) + line.qty;
        }
      }

      const updatedDb: POSDatabase = {
        ...db,
        events: {
          ...db.events,
          [currentEventId]: {
            ...event,
            items: updatedItems,
            orders: { ...event.orders, [orderId]: order },
            stats: updatedStats,
          },
        },
        auditLog: [
          ...db.auditLog,
          {
            id: generateId(),
            ts: now,
            type: 'order_created',
            meta: { orderId, eventId: currentEventId, total, paymentMethod, cashierId: session.cashierId },
          },
        ],
      };

      await saveDB(updatedDb);
      set({ db: updatedDb, cart: [] });

      console.log('[Store] Order committed:', orderId, 'Total:', total);
      return order;
    } finally {
      commitLock = false;
    }
  },

  getEvent: (eventId: string) => {
    return get().db.events[eventId];
  },

  getLiveEvents: () => {
    const { db } = get();
    return Object.values(db.events).filter((e) => e.status === 'live');
  },

  getCartTotal: () => {
    const { cart } = get();
    return cart.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  },

  getCartItemCount: () => {
    const { cart } = get();
    return cart.reduce((sum, l) => sum + l.qty, 0);
  },

  getEventExportJSON: (eventId: string) => {
    const { db } = get();
    const event = db.events[eventId];
    if (!event) return null;
    const exportData = {
      exportedAt: Date.now(),
      schemaVersion: db.schemaVersion,
      event,
    };
    return JSON.stringify(exportData, null, 2);
  },

  importEventFromJSON: async (json: string) => {
    const { db } = get();
    const parsed = JSON.parse(json);
    const eventData = parsed.event as POSEvent;
    if (!eventData || !eventData.eventId) {
      throw new Error('Invalid event data');
    }

    const newEventId = generateId();
    const importedEvent: POSEvent = {
      ...eventData,
      eventId: newEventId,
      name: `${eventData.name} (imported)`,
      status: 'closed' as const,
    };

    const updatedDb: POSDatabase = {
      ...db,
      events: { ...db.events, [newEventId]: importedEvent },
      auditLog: [
        ...db.auditLog,
        { id: generateId(), ts: Date.now(), type: 'event_imported', meta: { originalId: eventData.eventId, newId: newEventId } },
      ],
    };
    await saveDB(updatedDb);
    set({ db: updatedDb });
    console.log('[Store] Event imported as:', newEventId);
    return newEventId;
  },
}));
