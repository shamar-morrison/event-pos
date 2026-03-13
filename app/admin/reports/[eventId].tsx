import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import {
  CreditCard,
  Banknote,
  Smartphone,
  Gift,
  X,
} from 'lucide-react-native';
import Colors, { getPaymentColor } from '@/constants/colors';
import KeyboardSafeModal from '@/components/KeyboardSafeModal';
import StatusBadge from '@/components/StatusBadge';
import { useAdminEventReport, useCashiers } from '@/hooks/use-pos-data';
import { usePosStore } from '@/store/pos-store';
import { formatMoney } from '@/utils/money';
import type { Order, OrderLine, OrderStatus, PaymentMethod } from '@/types/pos';

const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  mobile: 'Mobile',
  comp: 'Comp',
};

const orderStatusMeta: Record<OrderStatus, { label: string; color: string; bg: string }> = {
  completed: {
    label: 'Completed',
    color: Colors.statusLive,
    bg: Colors.statusLiveBg,
  },
  voided: {
    label: 'Voided',
    color: Colors.statusClosed,
    bg: Colors.statusClosedBg,
  },
  refunded: {
    label: 'Refunded',
    color: Colors.accent,
    bg: Colors.accentBg,
  },
};

function getSafeNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getDisplayLines(order: Order | null): (OrderLine & {
  displayName: string;
  displayQty: number;
  displayUnitPrice: number;
  displayLineTotal: number;
  displayReason?: string;
})[] {
  if (!order || !Array.isArray(order.lines)) {
    return [];
  }

  return order.lines.map((line) => {
    const displayQty = getSafeNumber(line?.qty, 0);
    const displayUnitPrice = getSafeNumber(line?.unitPriceAtSale, 0);
    const displayLineTotal = getSafeNumber(line?.lineTotal, displayQty * displayUnitPrice);
    const displayReason =
      typeof line?.reason === 'string' && line.reason.trim() ? line.reason.trim() : undefined;

    return {
      type: line?.type === 'manual' ? 'manual' : 'inventory',
      itemId: typeof line?.itemId === 'string' ? line.itemId : undefined,
      nameAtSale:
        typeof line?.nameAtSale === 'string' && line.nameAtSale.trim() ? line.nameAtSale.trim() : 'Unknown item',
      unitPriceAtSale: displayUnitPrice,
      qty: displayQty,
      lineTotal: displayLineTotal,
      reason: displayReason,
      displayName:
        typeof line?.nameAtSale === 'string' && line.nameAtSale.trim() ? line.nameAtSale.trim() : 'Unknown item',
      displayQty,
      displayUnitPrice,
      displayLineTotal,
      displayReason,
    };
  });
}

function formatOrderTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const PaymentIcon = ({ method, size }: { method: PaymentMethod; size: number }) => {
  const color = getPaymentColor(method);
  switch (method) {
    case 'cash': return <Banknote size={size} color={color} />;
    case 'card': return <CreditCard size={size} color={color} />;
    case 'mobile': return <Smartphone size={size} color={color} />;
    case 'comp': return <Gift size={size} color={color} />;
    default: return null;
  }
};

export default function ReportsScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const pairedAdmin = usePosStore((state) => state.pairedAdmin);
  const { data: event, isPending } = useAdminEventReport(pairedAdmin?.adminId, eventId);
  const { data: cashiers = [] } = useCashiers(pairedAdmin?.adminId);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const orders = useMemo(
    () => (event ? Object.values(event.orders).sort((a, b) => b.createdAt - a.createdAt) : []),
    [event]
  );

  const itemsSold = useMemo(() => {
    if (!event) return [];
    return Object.entries(event.stats.qtySoldByItemId)
      .map(([itemId, qty]) => ({
        itemId,
        name: event.items[itemId]?.name ?? 'Unknown',
        qty,
        revenue: qty * (event.items[itemId]?.price ?? 0),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [event]);

  const cashiersById = useMemo(
    () => Object.fromEntries(cashiers.map((cashier) => [cashier.cashierId, cashier])),
    [cashiers]
  );
  const selectedOrder = useMemo(
    () => orders.find((order) => order.orderId === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );
  const selectedOrderLines = useMemo(() => getDisplayLines(selectedOrder), [selectedOrder]);

  useEffect(() => {
    if (!selectedOrderId) return;
    if (orders.some((order) => order.orderId === selectedOrderId)) return;
    setSelectedOrderId(null);
  }, [orders, selectedOrderId]);

  const isScreenLoading = isPending || event === undefined;

  if (isScreenLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    );
  }

  const isClosed = event.status === 'closed';
  const selectedStatusMeta = selectedOrder ? orderStatusMeta[selectedOrder.status] : null;
  const selectedSubtotal = selectedOrder ? getSafeNumber(selectedOrder.subtotal, 0) : 0;
  const selectedTotal = selectedOrder ? getSafeNumber(selectedOrder.total, 0) : 0;
  const selectedCollected = selectedOrder
    ? selectedOrder.paymentMethod === 'cash'
      ? getSafeNumber(selectedOrder.cashReceived, selectedTotal)
      : selectedTotal
    : 0;
  const selectedChange = selectedOrder ? getSafeNumber(selectedOrder.changeGiven, 0) : 0;

  return (
    <>
      <View style={styles.container}>
        <Stack.Screen
          options={{ title: isClosed ? 'End of Night Summary' : 'Reports' }}
        />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventName}>{event.name}</Text>
            <StatusBadge status={event.status} size="medium" />
          </View>

          <View style={styles.bigRevenue}>
            <Text style={styles.bigRevenueLabel}>Total Revenue</Text>
            <Text style={styles.bigRevenueValue}>{formatMoney(event.stats.totalRevenue)}</Text>
            <Text style={styles.bigRevenueOrders}>{event.stats.totalOrders} orders</Text>
          </View>

          <Text style={styles.sectionTitle}>Revenue by Payment</Text>
          <View style={styles.paymentGrid}>
            {(Object.keys(paymentLabels) as PaymentMethod[]).map((method) => {
              const amount = event.stats.revenueByPayment[method] || 0;
              const color = getPaymentColor(method);
              return (
                <View key={method} style={styles.paymentCard}>
                  <View style={[styles.paymentIcon, { backgroundColor: color + '15' }]}>
                    <PaymentIcon method={method} size={18} />
                  </View>
                  <Text style={styles.paymentAmount}>{formatMoney(amount)}</Text>
                  <Text style={styles.paymentLabel}>{paymentLabels[method]}</Text>
                </View>
              );
            })}
          </View>

          {itemsSold.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Items Sold</Text>
              <View style={styles.table}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, styles.tableColName]}>Item</Text>
                  <Text style={[styles.tableHeaderText, styles.tableColQty]}>Qty</Text>
                  <Text style={[styles.tableHeaderText, styles.tableColRev]}>Revenue</Text>
                </View>
                {itemsSold.map((item) => (
                  <View key={item.itemId} style={styles.tableRow}>
                    <Text style={[styles.tableCell, styles.tableColName]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.tableCell, styles.tableColQty]}>{item.qty}</Text>
                    <Text style={[styles.tableCellMoney, styles.tableColRev]}>{formatMoney(item.revenue)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {orders.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recent Orders</Text>
              <View style={styles.ordersList}>
                {orders.slice(0, 50).map((order) => {
                  const cashierName = cashiersById[order.cashierId]?.name ?? 'Unknown cashier';
                  const orderLineCount = getDisplayLines(order).length;

                  return (
                    <TouchableOpacity
                      key={order.orderId}
                      style={styles.orderCard}
                      activeOpacity={0.85}
                      onPress={() => setSelectedOrderId(order.orderId)}
                    >
                      <View style={styles.orderHeader}>
                        <Text style={styles.orderTotal}>{formatMoney(getSafeNumber(order.total, 0))}</Text>
                        <View style={[styles.orderPayment, { backgroundColor: getPaymentColor(order.paymentMethod) + '15' }]}>
                          <PaymentIcon method={order.paymentMethod} size={12} />
                          <Text style={[styles.orderPaymentText, { color: getPaymentColor(order.paymentMethod) }]}>
                            {paymentLabels[order.paymentMethod]}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.orderMeta}>
                        {cashierName} · {orderLineCount} item{orderLineCount === 1 ? '' : 's'} · {formatOrderTime(getSafeNumber(order.createdAt, Date.now()))}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {isClosed && event.endTime && (
            <View style={styles.closedNote}>
              <Text style={styles.closedNoteText}>
                Event closed at {new Date(event.endTime).toLocaleString()}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
      <KeyboardSafeModal
        visible={!!selectedOrder}
        onRequestClose={() => setSelectedOrderId(null)}
        animationType="fade"
        variant="centered"
        contentStyle={styles.modalContent}
      >
        {selectedOrder && selectedStatusMeta ? (
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaction Breakdown</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedOrderId(null)}
                activeOpacity={0.8}
              >
                <X size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalTotalRow}>
              <Text style={styles.modalTotal}>{formatMoney(selectedTotal)}</Text>
              <View
                style={[
                  styles.orderPayment,
                  styles.modalPaymentBadge,
                  { backgroundColor: getPaymentColor(selectedOrder.paymentMethod) + '15' },
                ]}
              >
                <PaymentIcon method={selectedOrder.paymentMethod} size={14} />
                <Text style={[styles.orderPaymentText, { color: getPaymentColor(selectedOrder.paymentMethod) }]}>
                  {paymentLabels[selectedOrder.paymentMethod]}
                </Text>
              </View>
            </View>

            <View style={[styles.orderStatusBadge, { backgroundColor: selectedStatusMeta.bg }]}>
              <Text style={[styles.orderStatusText, { color: selectedStatusMeta.color }]}>
                {selectedStatusMeta.label}
              </Text>
            </View>

            <Text style={styles.modalSectionTitle}>Items</Text>
            <View style={styles.receiptCard}>
              {selectedOrderLines.length > 0 ? (
                selectedOrderLines.map((line, index) => (
                  <View
                    key={`${line.itemId ?? line.displayName}-${index}`}
                    style={[
                      styles.receiptLine,
                      index < selectedOrderLines.length - 1 && styles.receiptLineBorder,
                    ]}
                  >
                    <View style={styles.receiptLineInfo}>
                      <Text style={styles.receiptLineName}>{line.displayName}</Text>
                      <Text style={styles.receiptLineMeta}>
                        {formatMoney(line.displayUnitPrice)} x {line.displayQty}
                      </Text>
                      {line.displayReason ? (
                        <Text style={styles.receiptLineReason}>{line.displayReason}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.receiptLineTotal}>{formatMoney(line.displayLineTotal)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyReceiptText}>No line items recorded for this transaction.</Text>
              )}
            </View>

            <Text style={styles.modalSectionTitle}>Payment Summary</Text>
            <View style={styles.receiptCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{formatMoney(selectedSubtotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Collected</Text>
                <Text style={styles.summaryValue}>{formatMoney(selectedCollected)}</Text>
              </View>
              {selectedOrder.paymentMethod === 'cash' ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Change given</Text>
                  <Text style={styles.summaryValue}>{formatMoney(selectedChange)}</Text>
                </View>
              ) : null}
              <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                <Text style={styles.summaryLabelTotal}>Total</Text>
                <Text style={styles.summaryValueTotal}>{formatMoney(selectedTotal)}</Text>
              </View>
            </View>
          </View>
        ) : null}
      </KeyboardSafeModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  errorText: { color: Colors.danger, textAlign: 'center', marginTop: 40, fontSize: 16 },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  eventName: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, flex: 1, marginRight: 10 },
  bigRevenue: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  bigRevenueLabel: { fontSize: 14, color: Colors.textSecondary, marginBottom: 6 },
  bigRevenueValue: { fontSize: 40, fontWeight: '800' as const, color: Colors.primary },
  bigRevenueOrders: { fontSize: 15, color: Colors.textMuted, marginTop: 4 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  paymentCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    width: '48%' as unknown as number,
    flexGrow: 1,
    flexBasis: '45%' as unknown as number,
  },
  paymentIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  paymentAmount: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  paymentLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  table: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableHeaderText: { fontSize: 12, fontWeight: '600' as const, color: Colors.textMuted, textTransform: 'uppercase' as const },
  tableColName: { flex: 1 },
  tableColQty: { width: 50, textAlign: 'center' as const },
  tableColRev: { width: 90, textAlign: 'right' as const },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '40',
  },
  tableCell: { fontSize: 14, color: Colors.text },
  tableCellMoney: { fontSize: 14, fontWeight: '600' as const, color: Colors.primary },
  ordersList: { gap: 8, marginBottom: 20 },
  orderCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderTotal: { fontSize: 17, fontWeight: '700' as const, color: Colors.text },
  orderPayment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  orderPaymentText: { fontSize: 11, fontWeight: '600' as const },
  orderMeta: { fontSize: 13, color: Colors.textMuted },
  modalContent: {
    width: '100%',
    maxWidth: 480,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  modalTotal: {
    flex: 1,
    fontSize: 32,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  modalPaymentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  orderStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 18,
  },
  orderStatusText: {
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  receiptCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 18,
  },
  receiptLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 12,
  },
  receiptLineBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '50',
  },
  receiptLineInfo: {
    flex: 1,
  },
  receiptLineName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  receiptLineMeta: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  receiptLineReason: {
    fontSize: 12,
    color: Colors.accent,
    marginTop: 6,
  },
  receiptLineTotal: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  emptyReceiptText: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  summaryRowTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 4,
    paddingTop: 14,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  summaryLabelTotal: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  summaryValueTotal: {
    fontSize: 17,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  closedNote: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  closedNoteText: { fontSize: 13, color: Colors.textMuted },
});
