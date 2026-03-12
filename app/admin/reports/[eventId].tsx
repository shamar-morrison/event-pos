import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import {
  DollarSign,
  ShoppingCart,
  CreditCard,
  Banknote,
  Smartphone,
  Gift,
} from 'lucide-react-native';
import Colors, { getPaymentColor } from '@/constants/colors';
import StatusBadge from '@/components/StatusBadge';
import { useAdminEventReport, useCashiers } from '@/hooks/use-pos-data';
import { usePosStore } from '@/store/pos-store';
import { formatMoney } from '@/utils/money';
import type { PaymentMethod } from '@/types/pos';

const paymentLabels: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  mobile: 'Mobile',
  comp: 'Comp',
};

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
  const { data: event, isLoading } = useAdminEventReport(pairedAdmin?.adminId, eventId);
  const { data: cashiers = [] } = useCashiers(pairedAdmin?.adminId);

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

  if (isLoading) {
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

  return (
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
                const cashierName = cashiersById[order.cashierId]?.name ?? 'Unknown';
                return (
                  <View key={order.orderId} style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <Text style={styles.orderTotal}>{formatMoney(order.total)}</Text>
                      <View style={[styles.orderPayment, { backgroundColor: getPaymentColor(order.paymentMethod) + '15' }]}>
                        <PaymentIcon method={order.paymentMethod} size={12} />
                        <Text style={[styles.orderPaymentText, { color: getPaymentColor(order.paymentMethod) }]}>
                          {paymentLabels[order.paymentMethod]}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.orderMeta}>
                      {cashierName} · {order.lines.length} item{order.lines.length > 1 ? 's' : ''} · {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
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
  closedNote: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  closedNoteText: { fontSize: 13, color: Colors.textMuted },
});
