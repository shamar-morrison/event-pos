import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Users } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import EmptyState from '@/components/EmptyState';
import { posKeys, useCashiers } from '@/hooks/use-pos-data';
import { usePosStore } from '@/store/pos-store';
import type { CashierUser } from '@/types/pos';
import { validatePinFormat } from '@/utils/pin';

export default function CashiersScreen() {
  const queryClient = useQueryClient();
  const pairedAdmin = usePosStore((state) => state.pairedAdmin);
  const createCashier = usePosStore((state) => state.createCashier);
  const removeCashier = usePosStore((state) => state.removeCashier);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { data: cashierData = [] } = useCashiers(pairedAdmin?.adminId);

  const cashiers = useMemo(
    () => [...cashierData].sort((a, b) => b.createdAt - a.createdAt),
    [cashierData]
  );

  const handleCreate = async () => {
    if (!pairedAdmin) {
      Alert.alert('Error', 'This device is not paired to an admin.');
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    const pinError = validatePinFormat(pin);
    if (pinError) {
      Alert.alert('Error', pinError);
      return;
    }
    setLoading(true);
    try {
      const cashierId = await createCashier(trimmedName, pin);
      queryClient.setQueryData<CashierUser[]>(posKeys.cashiers(pairedAdmin.adminId), (current = []) =>
        [
          {
            cashierId,
            name: trimmedName,
            pinHash: '',
            createdAt: Date.now(),
          },
          ...current.filter((cashier) => cashier.cashierId !== cashierId),
        ].sort((a, b) => b.createdAt - a.createdAt)
      );
      void queryClient.invalidateQueries({ queryKey: posKeys.cashiers(pairedAdmin.adminId) });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setName('');
      setPin('');
      setShowForm(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to create cashier');
      console.error('[Cashiers]', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = (cashierId: string, cashierName: string) => {
    if (!pairedAdmin) {
      Alert.alert('Error', 'This device is not paired to an admin.');
      return;
    }

    Alert.alert('Remove Cashier', `Remove ${cashierName}? They won't be able to log in.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeCashier(cashierId);
            queryClient.setQueryData<CashierUser[]>(posKeys.cashiers(pairedAdmin.adminId), (current = []) =>
              current.filter((cashier) => cashier.cashierId !== cashierId)
            );
            void queryClient.invalidateQueries({ queryKey: posKeys.cashiers(pairedAdmin.adminId) });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          } catch (error) {
            console.error('[Cashiers] Failed to remove cashier:', error);
            Alert.alert('Error', 'Failed to remove cashier');
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => { setShowForm(!showForm); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        >
          <UserPlus size={18} color={Colors.primary} />
          <Text style={styles.addButtonText}>{showForm ? 'Cancel' : 'Add Cashier'}</Text>
        </TouchableOpacity>

        {showForm && (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Cashier name"
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={setPin}
              placeholder="PIN (4-6 digits)"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleCreate}
              disabled={loading}
            >
              <Text style={styles.submitBtnText}>{loading ? 'Creating...' : 'Create Cashier'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {cashiers.length === 0 ? (
          <EmptyState
            icon={<Users size={48} color={Colors.textMuted} />}
            title="No cashiers"
            subtitle="Add cashiers so they can log in and process orders"
          />
        ) : (
          <View style={styles.list}>
            {cashiers.map((c) => (
              <View key={c.cashierId} style={styles.cashierRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cashierInfo}>
                  <Text style={styles.cashierName}>{c.name}</Text>
                  <Text style={styles.cashierDate}>
                    Added {new Date(c.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemove(c.cashierId, c.name)}
                >
                  <Trash2 size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 40 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryBg,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    marginBottom: 16,
  },
  addButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.primary },
  form: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
  list: { gap: 8 },
  cashierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.infoBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '700' as const, color: Colors.info },
  cashierInfo: { flex: 1 },
  cashierName: { fontSize: 16, fontWeight: '500' as const, color: Colors.text },
  cashierDate: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  removeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.dangerBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
