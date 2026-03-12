import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { Banknote, CreditCard, Gift, Smartphone } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors, { getPaymentColor } from '@/constants/colors';
import { posKeys, useCashierEventDetail } from '@/hooks/use-pos-data';
import { usePosStore } from '@/store/pos-store';
import { formatMoney, parseDollarInput } from '@/utils/money';
import type { PaymentMethod, POSEvent } from '@/types/pos';

const PAYMENT_OPTIONS: { key: PaymentMethod; label: string; Icon: typeof Banknote }[] = [
  { key: 'cash', label: 'Cash', Icon: Banknote },
  { key: 'card', label: 'Card', Icon: CreditCard },
  { key: 'mobile', label: 'Mobile', Icon: Smartphone },
  { key: 'comp', label: 'Comp', Icon: Gift },
];

const CONTENT_PADDING = 20;
const BUTTON_BOTTOM_PADDING = 20;
const CHECKOUT_KEYBOARD_OFFSET = 84;

export default function CheckoutScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const pairedAdmin = usePosStore((state) => state.pairedAdmin);
  const cart = usePosStore((state) => state.cart);
  const currentEventId = usePosStore((state) => state.currentEventId);
  const commitOrder = usePosStore((state) => state.commitOrder);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dismissInProgressRef = useRef(false);

  const { data: event, isLoading } = useCashierEventDetail(pairedAdmin?.adminId, currentEventId);
  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.unitPrice * line.qty, 0),
    [cart]
  );
  const cashReceivedCents = parseDollarInput(cashReceived);
  const changeDue =
    paymentMethod === 'cash' && cashReceivedCents !== null ? cashReceivedCents - total : null;
  const activeEventHref = currentEventId
    ? { pathname: '/cashier/[eventId]' as const, params: { eventId: currentEventId } }
    : '/cashier';
  const invalidDismissHref = currentEventId && event ? activeEventHref : '/cashier';
  const bottomInset = Math.max(insets.bottom, 16);

  useEffect(() => {
    if (event?.defaultPaymentMethod) {
      setPaymentMethod(event.defaultPaymentMethod);
      return;
    }

    setPaymentMethod('cash');
  }, [event?.defaultPaymentMethod]);

  useEffect(() => {
    if (isLoading || submitting || dismissInProgressRef.current) return;
    if (event && currentEventId && cart.length > 0) return;

    dismissInProgressRef.current = true;
    router.dismissTo(invalidDismissHref);
  }, [cart.length, currentEventId, event, invalidDismissHref, isLoading, router, submitting]);

  useEffect(() => {
    if (!isLoading && event && cart.length > 0) {
      dismissInProgressRef.current = false;
    }
  }, [cart.length, event, isLoading]);

  const handleSubmit = async () => {
    if (!event) return;
    if (paymentMethod === 'cash' && (cashReceivedCents === null || cashReceivedCents < total)) {
      Alert.alert('Cash Needed', 'Enter the amount collected before completing a cash sale.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await commitOrder(
        paymentMethod,
        paymentMethod === 'cash' ? cashReceivedCents ?? undefined : undefined
      );

      if (pairedAdmin && currentEventId) {
        queryClient.setQueryData<POSEvent | null>(
          posKeys.eventDetail(pairedAdmin.adminId, currentEventId),
          (current) => {
            if (!current) {
              return current;
            }

            const nextItems = { ...current.items };
            Object.entries(result.updatedItemQuantities).forEach(([itemId, qtyRemaining]) => {
              const item = nextItems[itemId];
              if (!item) return;
              nextItems[itemId] = {
                ...item,
                qtyRemaining,
              };
            });

            return {
              ...current,
              items: nextItems,
              stats: result.updatedStats,
            };
          }
        );
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Order Completed',
        paymentMethod === 'cash' && result.order.changeGiven !== undefined
          ? `Change due: ${formatMoney(result.order.changeGiven)}`
          : 'The order has been saved.'
      );
      dismissInProgressRef.current = true;
      router.dismissTo(activeEventHref);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete order.';
      Alert.alert('Checkout Error', message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>Loading checkout...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>No active event selected.</Text>
      </View>
    );
  }

  const disableSubmit =
    submitting || (paymentMethod === 'cash' && (cashReceivedCents === null || cashReceivedCents < total));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="height"
      keyboardVerticalOffset={CHECKOUT_KEYBOARD_OFFSET}
    >
      <Stack.Screen options={{ title: 'Checkout' }} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + BUTTON_BOTTOM_PADDING }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Event</Text>
          <Text style={styles.summaryTitle}>{event.name}</Text>
          <Text style={styles.summaryTotal}>{formatMoney(total)}</Text>
          <Text style={styles.summaryMeta}>{cart.length} line{cart.length === 1 ? '' : 's'} in cart</Text>
        </View>

        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.sectionCard}>
          {cart.map((line, index) => (
            <View key={`${line.itemId ?? line.name}-${index}`} style={styles.lineRow}>
              <View style={styles.lineInfo}>
                <Text style={styles.lineName}>{line.name}</Text>
                {line.reason ? <Text style={styles.lineReason}>{line.reason}</Text> : null}
                <Text style={styles.lineMeta}>
                  {formatMoney(line.unitPrice)} × {line.qty}
                </Text>
              </View>
              <Text style={styles.lineTotal}>{formatMoney(line.unitPrice * line.qty)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Payment Method</Text>
        <View style={styles.paymentGrid}>
          {PAYMENT_OPTIONS.map(({ key, label, Icon }) => {
            const isSelected = paymentMethod === key;
            const color = getPaymentColor(key);

            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.paymentButton,
                  isSelected && { borderColor: color, backgroundColor: `${color}20` },
                ]}
                onPress={() => setPaymentMethod(key)}
                activeOpacity={0.8}
              >
                <Icon size={18} color={isSelected ? color : Colors.textMuted} />
                <Text style={[styles.paymentText, isSelected && { color }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {paymentMethod === 'cash' ? (
          <View style={styles.sectionCard}>
            <Text style={styles.cashLabel}>Cash Received</Text>
            <TextInput
              style={styles.cashInput}
              value={cashReceived}
              onChangeText={setCashReceived}
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />

            <View style={styles.cashRow}>
              <Text style={styles.cashRowLabel}>Total</Text>
              <Text style={styles.cashRowValue}>{formatMoney(total)}</Text>
            </View>

            <View style={styles.cashRow}>
              <Text style={styles.cashRowLabel}>Received</Text>
              <Text style={styles.cashRowValue}>
                {cashReceivedCents === null ? '$0.00' : formatMoney(cashReceivedCents)}
              </Text>
            </View>

            <View style={styles.cashRow}>
              <Text style={styles.cashRowLabel}>Change</Text>
              <Text
                style={[
                  styles.cashRowValue,
                  changeDue !== null && changeDue < 0 && styles.cashShort,
                ]}
              >
                {changeDue === null ? '$0.00' : formatMoney(changeDue)}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              disableSubmit && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={disableSubmit}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? 'Completing Order...' : `Complete Sale • ${formatMoney(total)}`}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: CONTENT_PADDING,
    paddingTop: CONTENT_PADDING,
    flexGrow: 1,
  },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  summaryTotal: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.primary,
  },
  summaryMeta: {
    marginTop: 6,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  lineInfo: {
    flex: 1,
  },
  lineName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  lineReason: {
    marginTop: 2,
    fontSize: 12,
    color: Colors.textMuted,
  },
  lineMeta: {
    marginTop: 4,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  lineTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  paymentButton: {
    width: '48%' as unknown as number,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  cashLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  cashInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    fontSize: 18,
    color: Colors.text,
  },
  cashRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cashRowLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  cashRowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  cashShort: {
    color: Colors.danger,
  },
  buttonSection: {
    marginTop: 'auto',
    paddingTop: 8,
    paddingBottom: 8,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    width: '100%',
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
