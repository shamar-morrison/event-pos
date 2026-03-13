import { db } from '@/firebase/config';
import {
  AdminEventListItem,
  AdminProfile,
  CashierUser,
  EventItem,
  Order,
  POSEvent,
  POSEventSummary,
  createEmptyStats,
} from '@/types/pos';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  type DocumentData,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import { normalizeInventoryQuantity } from '@/utils/inventory';

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeAdminProfile(
  adminId: string,
  data: DocumentData | undefined,
  fallbackEmail?: string | null
): AdminProfile {
  const email =
    typeof data?.email === 'string' && data.email.trim()
      ? data.email.trim()
      : fallbackEmail?.trim() || '';
  const displayName =
    typeof data?.displayName === 'string' && data.displayName.trim()
      ? data.displayName.trim()
      : email.split('@')[0] || 'Admin';

  return {
    adminId,
    email,
    displayName,
    createdAt: toNumber(data?.createdAt, Date.now()),
  };
}

function normalizeCashier(cashierId: string, data: DocumentData | undefined): CashierUser {
  return {
    cashierId,
    name: typeof data?.name === 'string' ? data.name : 'Cashier',
    pinHash: typeof data?.pinHash === 'string' ? data.pinHash : '',
    createdAt: toNumber(data?.createdAt, Date.now()),
  };
}

function normalizeEventItem(itemId: string, data: DocumentData | undefined): EventItem {
  const now = Date.now();

  return {
    itemId,
    name: typeof data?.name === 'string' ? data.name : 'Item',
    price: toNumber(data?.price, 0),
    qtyRemaining: normalizeInventoryQuantity(data?.qtyRemaining),
    createdAt: toNumber(data?.createdAt, now),
    updatedAt: toNumber(data?.updatedAt, now),
  };
}

function normalizeOrder(orderId: string, data: DocumentData | undefined): Order {
  return {
    orderId,
    createdAt: toNumber(data?.createdAt, Date.now()),
    cashierId: typeof data?.cashierId === 'string' ? data.cashierId : '',
    status: data?.status === 'voided' || data?.status === 'refunded' ? data.status : 'completed',
    paymentMethod:
      data?.paymentMethod === 'card' ||
      data?.paymentMethod === 'mobile' ||
      data?.paymentMethod === 'comp'
        ? data.paymentMethod
        : 'cash',
    cashReceived: typeof data?.cashReceived === 'number' ? data.cashReceived : undefined,
    changeGiven: typeof data?.changeGiven === 'number' ? data.changeGiven : undefined,
    subtotal: toNumber(data?.subtotal, 0),
    total: toNumber(data?.total, 0),
    lines: Array.isArray(data?.lines) ? data.lines : [],
  };
}

function normalizeEventSummary(eventId: string, data: DocumentData | undefined): POSEventSummary {
  const stats = createEmptyStats();
  const rawStats = (data?.stats ?? {}) as Record<string, unknown>;
  const rawRevenue = (rawStats.revenueByPayment ?? {}) as Record<string, unknown>;
  const rawQtySold = (rawStats.qtySoldByItemId ?? {}) as Record<string, unknown>;

  return {
    eventId,
    name: typeof data?.name === 'string' ? data.name : 'Untitled Event',
    startTime: toNumber(data?.startTime, Date.now()),
    endTime: typeof data?.endTime === 'number' ? data.endTime : undefined,
    status:
      data?.status === 'live' || data?.status === 'paused' || data?.status === 'closed'
        ? data.status
        : 'draft',
    createdAt: toNumber(data?.createdAt, Date.now()),
    createdBy: typeof data?.createdBy === 'string' ? data.createdBy : '',
    defaultPaymentMethod:
      data?.defaultPaymentMethod === 'cash' ||
      data?.defaultPaymentMethod === 'card' ||
      data?.defaultPaymentMethod === 'mobile' ||
      data?.defaultPaymentMethod === 'comp'
        ? data.defaultPaymentMethod
        : undefined,
    stats: {
      totalRevenue: toNumber(rawStats.totalRevenue, stats.totalRevenue),
      totalOrders: toNumber(rawStats.totalOrders, stats.totalOrders),
      revenueByPayment: {
        cash: toNumber(rawRevenue.cash, stats.revenueByPayment.cash),
        card: toNumber(rawRevenue.card, stats.revenueByPayment.card),
        mobile: toNumber(rawRevenue.mobile, stats.revenueByPayment.mobile),
        comp: toNumber(rawRevenue.comp, stats.revenueByPayment.comp),
      },
      qtySoldByItemId: Object.fromEntries(
        Object.entries(rawQtySold).map(([key, value]) => [key, toNumber(value, 0)])
      ),
      lastUpdatedAt: toNumber(rawStats.lastUpdatedAt, stats.lastUpdatedAt),
    },
  };
}

function normalizeItemsSnapshot(itemsSnapshot: Awaited<ReturnType<typeof getDocs>>) {
  return Object.fromEntries(
    itemsSnapshot.docs.map((itemDoc) => [
      itemDoc.id,
      normalizeEventItem(itemDoc.id, itemDoc.data() as DocumentData),
    ])
  );
}

function normalizeOrdersSnapshot(ordersSnapshot: Awaited<ReturnType<typeof getDocs>>) {
  return Object.fromEntries(
    ordersSnapshot.docs.map((orderDoc) => [
      orderDoc.id,
      normalizeOrder(orderDoc.id, orderDoc.data() as DocumentData),
    ])
  );
}

export function adminDocRef(adminId: string): DocumentReference {
  return doc(db, 'admins', adminId);
}

export function cashiersCollectionRef(adminId: string) {
  return collection(db, 'admins', adminId, 'cashiers');
}

export function cashierDocRef(adminId: string, cashierId: string): DocumentReference {
  return doc(db, 'admins', adminId, 'cashiers', cashierId);
}

export function eventsCollectionRef(adminId: string) {
  return collection(db, 'admins', adminId, 'events');
}

export function eventDocRef(adminId: string, eventId: string): DocumentReference {
  return doc(db, 'admins', adminId, 'events', eventId);
}

export function eventItemsCollectionRef(adminId: string, eventId: string) {
  return collection(db, 'admins', adminId, 'events', eventId, 'items');
}

export function eventItemDocRef(adminId: string, eventId: string, itemId: string): DocumentReference {
  return doc(db, 'admins', adminId, 'events', eventId, 'items', itemId);
}

export function eventOrdersCollectionRef(adminId: string, eventId: string) {
  return collection(db, 'admins', adminId, 'events', eventId, 'orders');
}

export function eventOrderDocRef(adminId: string, eventId: string, orderId: string): DocumentReference {
  return doc(db, 'admins', adminId, 'events', eventId, 'orders', orderId);
}

export function auditLogCollectionRef(adminId: string) {
  return collection(db, 'admins', adminId, 'auditLogs');
}

export function auditLogDocRef(adminId: string, logId: string): DocumentReference {
  return doc(db, 'admins', adminId, 'auditLogs', logId);
}

export async function loadAdminProfile(adminId: string, fallbackEmail?: string | null): Promise<AdminProfile | null> {
  const snapshot = await getDoc(adminDocRef(adminId));
  if (!snapshot.exists()) {
    return null;
  }

  return normalizeAdminProfile(adminId, snapshot.data(), fallbackEmail);
}

export async function loadCashier(adminId: string, cashierId: string): Promise<CashierUser | null> {
  const snapshot = await getDoc(cashierDocRef(adminId, cashierId));
  if (!snapshot.exists()) {
    return null;
  }

  return normalizeCashier(snapshot.id, snapshot.data());
}

export async function fetchCashiers(adminId: string): Promise<CashierUser[]> {
  const snapshot = await getDocs(cashiersCollectionRef(adminId));
  return snapshot.docs
    .map((cashierDoc) => normalizeCashier(cashierDoc.id, cashierDoc.data()))
    .sort((left, right) => right.createdAt - left.createdAt);
}

export async function fetchAdminEvents(adminId: string): Promise<AdminEventListItem[]> {
  const snapshot = await getDocs(eventsCollectionRef(adminId));

  const events = await Promise.all(
    snapshot.docs.map(async (eventDoc) => {
      const eventSummary = normalizeEventSummary(eventDoc.id, eventDoc.data());
      const itemsSnapshot = await getDocs(eventItemsCollectionRef(adminId, eventDoc.id));

      return {
        ...eventSummary,
        itemCount: itemsSnapshot.size,
      };
    })
  );

  return events.sort((left, right) => right.createdAt - left.createdAt);
}

export async function fetchEventDetail(
  adminId: string,
  eventId: string,
  options?: { includeOrders?: boolean }
): Promise<POSEvent | null> {
  const snapshot = await getDoc(eventDocRef(adminId, eventId));
  if (!snapshot.exists()) {
    return null;
  }

  const [itemsSnapshot, ordersSnapshot] = await Promise.all([
    getDocs(eventItemsCollectionRef(adminId, eventId)),
    options?.includeOrders ? getDocs(eventOrdersCollectionRef(adminId, eventId)) : Promise.resolve(null),
  ]);

  const summary = normalizeEventSummary(snapshot.id, snapshot.data());

  return {
    ...summary,
    items: normalizeItemsSnapshot(itemsSnapshot),
    orders: ordersSnapshot ? normalizeOrdersSnapshot(ordersSnapshot) : {},
  };
}

export function subscribeToAdminEventSummaries(
  adminId: string,
  callbacks: {
    onData: (events: POSEventSummary[]) => void;
    onError: (error: Error) => void;
  }
): Unsubscribe {
  return onSnapshot(
    eventsCollectionRef(adminId),
    (snapshot) => {
      callbacks.onData(
        snapshot.docs
          .map((eventDoc) => normalizeEventSummary(eventDoc.id, eventDoc.data()))
          .sort((left, right) => right.createdAt - left.createdAt)
      );
    },
    (error) => {
      callbacks.onError(error instanceof Error ? error : new Error('Failed to listen for event updates.'));
    }
  );
}

export function subscribeToEventSummary(
  adminId: string,
  eventId: string,
  callbacks: {
    onData: (event: POSEventSummary | null) => void;
    onError: (error: Error) => void;
  }
): Unsubscribe {
  return onSnapshot(
    eventDocRef(adminId, eventId),
    (snapshot) => {
      callbacks.onData(snapshot.exists() ? normalizeEventSummary(snapshot.id, snapshot.data()) : null);
    },
    (error) => {
      callbacks.onError(error instanceof Error ? error : new Error('Failed to listen for event updates.'));
    }
  );
}

export function subscribeToEventItems(
  adminId: string,
  eventId: string,
  callbacks: {
    onData: (items: Record<string, EventItem>) => void;
    onError: (error: Error) => void;
  }
): Unsubscribe {
  return onSnapshot(
    eventItemsCollectionRef(adminId, eventId),
    (snapshot) => {
      callbacks.onData(
        Object.fromEntries(snapshot.docs.map((itemDoc) => [itemDoc.id, normalizeEventItem(itemDoc.id, itemDoc.data())]))
      );
    },
    (error) => {
      callbacks.onError(error instanceof Error ? error : new Error('Failed to listen for item updates.'));
    }
  );
}
