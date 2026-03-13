import { create } from 'zustand';
import {
  CartLine,
  CommitOrderResult,
  EventStatus,
  InventoryQuantity,
  Order,
  OrderLine,
  PaymentMethod,
  POSEvent,
  Session,
  createEmptyStats,
  type AdminProfile,
} from '@/types/pos';
import { clearLegacyLocalData, loadSession, saveSession } from '@/db/database';
import { auth, db as firestoreDb } from '@/firebase/config';
import {
  auditLogDocRef,
  cashierDocRef,
  eventDocRef,
  eventItemDocRef,
  eventItemsCollectionRef,
  eventOrderDocRef,
  eventOrdersCollectionRef,
  fetchEventDetail,
  loadAdminProfile,
  loadCashier,
} from '@/services/pos-firestore';
import { queryClient } from '@/lib/query-client';
import { normalizeInventoryQuantity } from '@/utils/inventory';
import { hashPin, verifyPin } from '@/utils/pin';
import { generateId } from '@/utils/uuid';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User as FirebaseUser } from 'firebase/auth';
import {
  deleteField,
  getDoc,
  getDocs,
  increment,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';

let commitLock = false;
let authUnsubscribe: (() => void) | null = null;
let initializePromise: Promise<void> | null = null;
let resolveInitialize: (() => void) | null = null;
let pendingAuthError: string | null = null;
let initializeTimeout: ReturnType<typeof setTimeout> | null = null;

interface PosStore {
  session: Session | null;
  pairedAdmin: AdminProfile | null;
  isInitialized: boolean;
  isBootstrapping: boolean;
  authError: string | null;
  cart: CartLine[];
  currentEventId: string | null;

  initialize: () => Promise<void>;
  clearAuthError: () => void;

  loginAdmin: (email: string, password: string) => Promise<boolean>;
  hasPairedAdmin: () => boolean;
  loginCashier: (cashierId: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  unpairDevice: () => Promise<void>;

  createEvent: (name: string) => Promise<string>;
  updateEventStatus: (eventId: string, status: EventStatus) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;

  addItem: (eventId: string, name: string, priceCents: number, qty: InventoryQuantity) => Promise<string>;
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

  commitOrder: (paymentMethod: PaymentMethod, cashReceivedCents?: number) => Promise<CommitOrderResult>;

  getCartTotal: () => number;
  getCartItemCount: () => number;
  getEventExportJSON: (eventId: string) => Promise<string | null>;
  importEventFromJSON: (json: string) => Promise<string>;
}

function normalizeSessionForAdmin(session: Session | null, admin: AdminProfile): Session | null {
  if (!session || session.adminId !== admin.adminId) {
    return null;
  }

  if (session.role === 'admin') {
    return {
      ...session,
      adminId: admin.adminId,
      adminUsername: admin.email,
    };
  }

  return {
    ...session,
    adminId: admin.adminId,
  };
}

function areSessionsEqual(left: Session | null, right: Session | null): boolean {
  if (left === right) return true;
  if (!left || !right) return false;

  return (
    left.role === right.role &&
    left.adminId === right.adminId &&
    left.adminUsername === right.adminUsername &&
    left.cashierId === right.cashierId &&
    left.cashierName === right.cashierName
  );
}

function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as T;
}

function buildAuditEntry(type: string, meta: Record<string, unknown>, ts = Date.now()) {
  const id = generateId();
  return {
    id,
    ts,
    type,
    meta,
  };
}

export const usePosStore = create<PosStore>((set, get) => {
  const markInitialized = () => {
    if (initializeTimeout) {
      clearTimeout(initializeTimeout);
      initializeTimeout = null;
    }
    set({ isInitialized: true });
    if (resolveInitialize) {
      resolveInitialize();
      resolveInitialize = null;
      initializePromise = null;
    }
  };

  const resetAuthState = (authError: string | null) => {
    queryClient.clear();
    set({
      session: null,
      pairedAdmin: null,
      isBootstrapping: false,
      authError,
      cart: [],
      currentEventId: null,
    });
  };

  const requirePairedAdmin = () => {
    const pairedAdmin = get().pairedAdmin;
    if (!pairedAdmin) {
      throw new Error('This device is not paired to an admin account.');
    }
    return pairedAdmin;
  };

  const requireAdminSession = () => {
    const { session } = get();
    const pairedAdmin = requirePairedAdmin();

    if (!session || session.role !== 'admin' || session.adminId !== pairedAdmin.adminId) {
      throw new Error('Admin sign-in is required.');
    }

    return pairedAdmin;
  };

  const handleSignedOut = async () => {
    const authError = pendingAuthError;
    pendingAuthError = null;
    await saveSession(null);
    resetAuthState(authError);
    markInitialized();
  };

  const handleSignedIn = async (user: FirebaseUser) => {
    set({ isBootstrapping: true, authError: null });

    const profile = await loadAdminProfile(user.uid, user.email);
    if (!profile) {
      pendingAuthError = 'This Firebase account is not registered as an admin.';
      await saveSession(null);
      resetAuthState(pendingAuthError);
      markInitialized();
      await signOut(auth);
      return;
    }

    let normalizedSession = normalizeSessionForAdmin(get().session, profile);

    if (normalizedSession?.role === 'cashier' && normalizedSession.cashierId) {
      const cashier = await loadCashier(profile.adminId, normalizedSession.cashierId);
      if (!cashier) {
        normalizedSession = null;
      } else {
        normalizedSession = {
          ...normalizedSession,
          cashierName: cashier.name,
        };
      }
    }

    if (!areSessionsEqual(get().session, normalizedSession)) {
      await saveSession(normalizedSession);
    }

    set({
      pairedAdmin: profile,
      session: normalizedSession,
      isBootstrapping: false,
      authError: null,
    });
    markInitialized();
  };

  return {
    session: null,
    pairedAdmin: null,
    isInitialized: false,
    isBootstrapping: true,
    authError: null,
    cart: [],
    currentEventId: null,

    initialize: async () => {
      if (authUnsubscribe) {
        return initializePromise ?? Promise.resolve();
      }

      const session = await loadSession();
      await clearLegacyLocalData();
      set({ session, isBootstrapping: true });

      initializePromise = new Promise<void>((resolve) => {
        resolveInitialize = resolve;
      });

      initializeTimeout = setTimeout(() => {
        console.error('[Store] Initialization timed out while waiting for Firebase auth state.');
        set({
          isBootstrapping: false,
          authError: 'Initialization timed out. Check your Firebase config and restart Expo.',
        });
        markInitialized();
      }, 5000);

      authUnsubscribe = onAuthStateChanged(auth, (user) => {
        if (!user) {
          void handleSignedOut();
          return;
        }

        void handleSignedIn(user);
      });

      return initializePromise;
    },

    clearAuthError: () => {
      pendingAuthError = null;
      set({ authError: null });
    },

    loginAdmin: async (email: string, password: string) => {
      try {
        const credentials = await signInWithEmailAndPassword(auth, email.trim(), password);
        const profile = await loadAdminProfile(credentials.user.uid, credentials.user.email);

        if (!profile) {
          pendingAuthError = 'This Firebase account is not registered as an admin.';
          await signOut(auth);
          set({ authError: pendingAuthError });
          return false;
        }

        queryClient.clear();

        const session: Session = {
          role: 'admin',
          adminId: profile.adminId,
          adminUsername: profile.email,
        };

        await saveSession(session);
        set({ session, pairedAdmin: profile, authError: null, isBootstrapping: false });
        return true;
      } catch (error) {
        console.error('[Store] Admin login failed:', error);
        return false;
      }
    },

    hasPairedAdmin: () => {
      return !!get().pairedAdmin;
    },

    loginCashier: async (cashierId: string, pin: string) => {
      const pairedAdmin = requirePairedAdmin();
      const cashier = await loadCashier(pairedAdmin.adminId, cashierId);

      if (!cashier) {
        return false;
      }

      const valid = await verifyPin(pin, cashier.pinHash);
      if (!valid) {
        return false;
      }

      const session: Session = {
        role: 'cashier',
        adminId: pairedAdmin.adminId,
        cashierId: cashier.cashierId,
        cashierName: cashier.name,
      };

      await saveSession(session);
      set({ session, cart: [], currentEventId: null });
      return true;
    },

    logout: async () => {
      await saveSession(null);
      set({ session: null, cart: [], currentEventId: null });
    },

    unpairDevice: async () => {
      await saveSession(null);
      resetAuthState(null);
      await signOut(auth);
    },

    createEvent: async (name: string) => {
      const pairedAdmin = requireAdminSession();
      const eventId = generateId();
      const now = Date.now();
      const event = {
        eventId,
        name,
        startTime: now,
        status: 'draft' as const,
        createdAt: now,
        createdBy: pairedAdmin.adminId,
        stats: createEmptyStats(),
      };

      const auditEntry = buildAuditEntry('event_created', { eventId, name }, now);
      const batch = writeBatch(firestoreDb);
      batch.set(eventDocRef(pairedAdmin.adminId, eventId), event);
      batch.set(auditLogDocRef(pairedAdmin.adminId, auditEntry.id), auditEntry);
      await batch.commit();
      return eventId;
    },

    updateEventStatus: async (eventId: string, status: EventStatus) => {
      const pairedAdmin = requireAdminSession();
      const eventSnapshot = await getDoc(eventDocRef(pairedAdmin.adminId, eventId));
      if (!eventSnapshot.exists()) {
        throw new Error('Event not found');
      }

      const currentStatus =
        eventSnapshot.data().status === 'live' ||
        eventSnapshot.data().status === 'paused' ||
        eventSnapshot.data().status === 'closed'
          ? eventSnapshot.data().status
          : 'draft';

      const now = Date.now();
      const updates: Record<string, unknown> = { status };
      if (status === 'closed') {
        updates.endTime = now;
      }

      const auditEntry = buildAuditEntry('event_status_changed', { eventId, from: currentStatus, to: status }, now);
      const batch = writeBatch(firestoreDb);
      batch.update(eventDocRef(pairedAdmin.adminId, eventId), updates);
      batch.set(auditLogDocRef(pairedAdmin.adminId, auditEntry.id), auditEntry);
      await batch.commit();
    },

    deleteEvent: async (eventId: string) => {
      const pairedAdmin = requireAdminSession();
      const [itemsSnapshot, ordersSnapshot] = await Promise.all([
        getDocs(eventItemsCollectionRef(pairedAdmin.adminId, eventId)),
        getDocs(eventOrdersCollectionRef(pairedAdmin.adminId, eventId)),
      ]);

      const auditEntry = buildAuditEntry('event_deleted', { eventId });
      const batch = writeBatch(firestoreDb);
      itemsSnapshot.docs.forEach((itemDoc) => batch.delete(itemDoc.ref));
      ordersSnapshot.docs.forEach((orderDoc) => batch.delete(orderDoc.ref));
      batch.delete(eventDocRef(pairedAdmin.adminId, eventId));
      batch.set(auditLogDocRef(pairedAdmin.adminId, auditEntry.id), auditEntry);
      await batch.commit();
    },

    addItem: async (eventId: string, name: string, priceCents: number, qty: InventoryQuantity) => {
      const pairedAdmin = requireAdminSession();
      const itemId = generateId();
      const now = Date.now();
      const item = {
        itemId,
        name,
        price: priceCents,
        qtyRemaining: qty,
        createdAt: now,
        updatedAt: now,
      };

      const auditEntry = buildAuditEntry('item_added', { eventId, itemId, name, priceCents, qty }, now);
      const batch = writeBatch(firestoreDb);
      batch.set(eventItemDocRef(pairedAdmin.adminId, eventId, itemId), item);
      batch.set(auditLogDocRef(pairedAdmin.adminId, auditEntry.id), auditEntry);
      await batch.commit();
      return itemId;
    },

    restockItem: async (eventId: string, itemId: string, additionalQty: number) => {
      const pairedAdmin = requireAdminSession();
      const itemReference = eventItemDocRef(pairedAdmin.adminId, eventId, itemId);
      const itemSnapshot = await getDoc(itemReference);
      if (!itemSnapshot.exists()) {
        throw new Error('Item not found');
      }

      const currentQty = normalizeInventoryQuantity(itemSnapshot.data().qtyRemaining);
      const now = Date.now();
      const auditEntry = buildAuditEntry('item_restocked', { eventId, itemId, additionalQty }, now);
      const batch = writeBatch(firestoreDb);
      if (currentQty === null) {
        batch.update(itemReference, {
          qtyRemaining: additionalQty,
          updatedAt: now,
        });
      } else {
        batch.update(itemReference, {
          qtyRemaining: increment(additionalQty),
          updatedAt: now,
        });
      }
      batch.set(auditLogDocRef(pairedAdmin.adminId, auditEntry.id), auditEntry);
      await batch.commit();
    },

    setItemQuantity: async (eventId: string, itemId: string, newQty: number) => {
      const pairedAdmin = requireAdminSession();
      if (newQty < 0) {
        throw new Error('Quantity cannot be negative');
      }

      const itemSnapshot = await getDoc(eventItemDocRef(pairedAdmin.adminId, eventId, itemId));
      if (!itemSnapshot.exists()) {
        throw new Error('Item not found');
      }

      const previousQty = normalizeInventoryQuantity(itemSnapshot.data().qtyRemaining);
      const now = Date.now();
      const auditEntry = buildAuditEntry('item_qty_set', { eventId, itemId, from: previousQty, to: newQty }, now);
      const batch = writeBatch(firestoreDb);
      batch.update(eventItemDocRef(pairedAdmin.adminId, eventId, itemId), {
        qtyRemaining: newQty,
        updatedAt: now,
      });
      batch.set(auditLogDocRef(pairedAdmin.adminId, auditEntry.id), auditEntry);
      await batch.commit();
    },

    removeItem: async (eventId: string, itemId: string) => {
      const pairedAdmin = requireAdminSession();
      const itemSnapshot = await getDoc(eventItemDocRef(pairedAdmin.adminId, eventId, itemId));
      if (!itemSnapshot.exists()) {
        throw new Error('Item not found');
      }

      const itemName = typeof itemSnapshot.data().name === 'string' ? itemSnapshot.data().name : itemId;
      const auditEntry = buildAuditEntry('item_removed', { eventId, itemId, name: itemName });
      const batch = writeBatch(firestoreDb);
      batch.delete(eventItemDocRef(pairedAdmin.adminId, eventId, itemId));
      batch.set(auditLogDocRef(pairedAdmin.adminId, auditEntry.id), auditEntry);
      await batch.commit();
    },

    setDefaultPaymentMethod: async (eventId: string, method: PaymentMethod | undefined) => {
      const pairedAdmin = requireAdminSession();
      const now = Date.now();
      const auditEntry = buildAuditEntry('default_payment_set', { eventId, method }, now);
      const batch = writeBatch(firestoreDb);
      batch.update(eventDocRef(pairedAdmin.adminId, eventId), {
        defaultPaymentMethod: method ?? deleteField(),
      });
      batch.set(auditLogDocRef(pairedAdmin.adminId, auditEntry.id), auditEntry);
      await batch.commit();
    },

    createCashier: async (name: string, pin: string) => {
      const pairedAdmin = requireAdminSession();
      const cashierId = generateId();
      const pinHash = await hashPin(pin);
      const now = Date.now();
      const auditEntry = buildAuditEntry('cashier_created', { cashierId, name }, now);
      const batch = writeBatch(firestoreDb);
      batch.set(cashierDocRef(pairedAdmin.adminId, cashierId), {
        cashierId,
        name,
        pinHash,
        createdAt: now,
      });
      batch.set(auditLogDocRef(pairedAdmin.adminId, auditEntry.id), auditEntry);
      await batch.commit();
      return cashierId;
    },

    removeCashier: async (cashierId: string) => {
      const pairedAdmin = requireAdminSession();
      const auditEntry = buildAuditEntry('cashier_removed', { cashierId });
      const batch = writeBatch(firestoreDb);
      batch.delete(cashierDocRef(pairedAdmin.adminId, cashierId));
      batch.set(auditLogDocRef(pairedAdmin.adminId, auditEntry.id), auditEntry);
      await batch.commit();
    },

    setCurrentEvent: (eventId: string | null) => {
      set({ currentEventId: eventId, cart: [] });
    },

    addToCart: (line: CartLine) => {
      const { cart } = get();
      if (line.type === 'inventory' && line.itemId) {
        const existingIndex = cart.findIndex(
          (cartLine) => cartLine.type === 'inventory' && cartLine.itemId === line.itemId
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

      set({ cart: [...cart, { ...line }] });
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
        set({ cart: cart.filter((_, cartIndex) => cartIndex !== index) });
        return;
      }

      const updated = [...cart];
      updated[index] = { ...line, qty: line.qty - 1 };
      set({ cart: updated });
    },

    removeCartLine: (index: number) => {
      const { cart } = get();
      set({ cart: cart.filter((_, cartIndex) => cartIndex !== index) });
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
        const pairedAdmin = requirePairedAdmin();
        const { session, cart, currentEventId } = get();

        if (!session || session.role !== 'cashier' || session.adminId !== pairedAdmin.adminId || !session.cashierId) {
          throw new Error('Cashier login required.');
        }
        if (!currentEventId) throw new Error('No event selected.');
        if (cart.length === 0) throw new Error('Cart is empty.');

        const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
        const total = subtotal;

        if (paymentMethod === 'cash' && (cashReceivedCents === undefined || cashReceivedCents < total)) {
          throw new Error('Cash received must cover the order total.');
        }

        const now = Date.now();
        const orderId = generateId();
        const changeGiven = paymentMethod === 'cash' ? (cashReceivedCents ?? 0) - total : undefined;
        const orderLines: OrderLine[] = cart.map((line) =>
          omitUndefined<OrderLine>({
            type: line.type,
            itemId: line.type === 'inventory' ? line.itemId : undefined,
            nameAtSale: line.name,
            unitPriceAtSale: line.unitPrice,
            qty: line.qty,
            lineTotal: line.unitPrice * line.qty,
            reason: line.type === 'manual' && line.reason?.trim() ? line.reason.trim() : undefined,
          })
        );

        const order: Order = omitUndefined<Order>({
          orderId,
          createdAt: now,
          cashierId: session.cashierId,
          status: 'completed',
          paymentMethod,
          cashReceived: paymentMethod === 'cash' ? cashReceivedCents : undefined,
          changeGiven: paymentMethod === 'cash' ? changeGiven : undefined,
          subtotal,
          total,
          lines: orderLines,
        });

        const inventoryLines = cart.filter(
          (line): line is CartLine & { itemId: string } => line.type === 'inventory' && !!line.itemId
        );

        let updatedStats = createEmptyStats();
        const updatedItemQuantities: Record<string, InventoryQuantity> = {};

        await runTransaction(firestoreDb, async (transaction) => {
          const eventReference = eventDocRef(pairedAdmin.adminId, currentEventId);
          const eventSnapshot = await transaction.get(eventReference);

          if (!eventSnapshot.exists()) {
            throw new Error('Event not found.');
          }

          const eventData = eventSnapshot.data() as Record<string, unknown>;
          if (eventData.status !== 'live') {
            throw new Error('Event is not currently live.');
          }

          const itemSnapshots = await Promise.all(
            inventoryLines.map((line) =>
              transaction.get(eventItemDocRef(pairedAdmin.adminId, currentEventId, line.itemId))
            )
          );

          itemSnapshots.forEach((itemSnapshot, index) => {
            if (!itemSnapshot.exists()) {
              throw new Error(`Item "${inventoryLines[index]?.name}" no longer exists.`);
            }

            const itemData = itemSnapshot.data() as Record<string, unknown>;
            const qtyRemaining = normalizeInventoryQuantity(itemData.qtyRemaining);

            if (qtyRemaining !== null && qtyRemaining < inventoryLines[index].qty) {
              throw new Error(`Not enough "${inventoryLines[index].name}" in stock (${qtyRemaining} remaining).`);
            }
          });

          itemSnapshots.forEach((itemSnapshot, index) => {
            const itemData = itemSnapshot.data() as Record<string, unknown>;
            const qtyRemaining = normalizeInventoryQuantity(itemData.qtyRemaining);
            if (qtyRemaining === null) {
              return;
            }

            const nextQty = qtyRemaining - inventoryLines[index].qty;
            updatedItemQuantities[inventoryLines[index].itemId] = nextQty;
            transaction.update(itemSnapshot.ref, {
              qtyRemaining: nextQty,
              updatedAt: now,
            });
          });

          const baseStats = createEmptyStats();
          const eventStats = ((eventData.stats ?? {}) as Record<string, unknown>) || {};
          const revenueByPayment = ((eventStats.revenueByPayment ?? {}) as Record<string, unknown>) || {};
          const qtySoldByItemId = { ...(eventStats.qtySoldByItemId as Record<string, number> | undefined) };

          inventoryLines.forEach((line) => {
            qtySoldByItemId[line.itemId] = (qtySoldByItemId[line.itemId] || 0) + line.qty;
          });

          updatedStats = {
            totalRevenue:
              (typeof eventStats.totalRevenue === 'number' ? eventStats.totalRevenue : baseStats.totalRevenue) + total,
            totalOrders:
              (typeof eventStats.totalOrders === 'number' ? eventStats.totalOrders : baseStats.totalOrders) + 1,
            revenueByPayment: {
              cash: typeof revenueByPayment.cash === 'number' ? revenueByPayment.cash : baseStats.revenueByPayment.cash,
              card: typeof revenueByPayment.card === 'number' ? revenueByPayment.card : baseStats.revenueByPayment.card,
              mobile:
                typeof revenueByPayment.mobile === 'number'
                  ? revenueByPayment.mobile
                  : baseStats.revenueByPayment.mobile,
              comp: typeof revenueByPayment.comp === 'number' ? revenueByPayment.comp : baseStats.revenueByPayment.comp,
              [paymentMethod]:
                (typeof revenueByPayment[paymentMethod] === 'number'
                  ? (revenueByPayment[paymentMethod] as number)
                  : 0) + total,
            },
            qtySoldByItemId,
            lastUpdatedAt: now,
          };

          const auditEntry = buildAuditEntry(
            'order_created',
            {
              orderId,
              eventId: currentEventId,
              total,
              paymentMethod,
              cashierId: session.cashierId,
            },
            now
          );

          transaction.set(eventOrderDocRef(pairedAdmin.adminId, currentEventId, orderId), order);
          transaction.update(eventReference, { stats: updatedStats });
          transaction.set(auditLogDocRef(pairedAdmin.adminId, auditEntry.id), auditEntry);
        });

        set({ cart: [] });
        return {
          order,
          updatedStats,
          updatedItemQuantities,
        };
      } finally {
        commitLock = false;
      }
    },

    getCartTotal: () => {
      return get().cart.reduce((sum, line) => sum + line.unitPrice * line.qty, 0);
    },

    getCartItemCount: () => {
      return get().cart.reduce((sum, line) => sum + line.qty, 0);
    },

    getEventExportJSON: async (eventId: string) => {
      const pairedAdmin = requireAdminSession();
      const event = await fetchEventDetail(pairedAdmin.adminId, eventId, { includeOrders: true });
      if (!event) return null;

      return JSON.stringify(
        {
          exportedAt: Date.now(),
          schemaVersion: 2,
          event,
        },
        null,
        2
      );
    },

    importEventFromJSON: async (json: string) => {
      const pairedAdmin = requireAdminSession();
      const parsed = JSON.parse(json) as { event?: POSEvent };
      const eventData = parsed.event;

      if (!eventData?.eventId) {
        throw new Error('Invalid event data.');
      }

      const newEventId = generateId();
      const now = Date.now();
      const batch = writeBatch(firestoreDb);

      batch.set(eventDocRef(pairedAdmin.adminId, newEventId), {
        eventId: newEventId,
        name: `${eventData.name} (imported)`,
        startTime: eventData.startTime,
        endTime: eventData.endTime ?? now,
        status: 'closed',
        createdAt: now,
        createdBy: pairedAdmin.adminId,
        defaultPaymentMethod: eventData.defaultPaymentMethod ?? null,
        stats: eventData.stats ?? createEmptyStats(),
      });

      Object.values(eventData.items ?? {}).forEach((item) => {
        batch.set(eventItemDocRef(pairedAdmin.adminId, newEventId, item.itemId), item);
      });

      Object.values(eventData.orders ?? {}).forEach((order) => {
        batch.set(eventOrderDocRef(pairedAdmin.adminId, newEventId, order.orderId), order);
      });

      const auditEntry = buildAuditEntry(
        'event_imported',
        { originalId: eventData.eventId, newId: newEventId },
        now
      );
      batch.set(auditLogDocRef(pairedAdmin.adminId, auditEntry.id), auditEntry);
      await batch.commit();

      return newEventId;
    },
  };
});
