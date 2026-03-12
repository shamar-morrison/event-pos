import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import PinInput from '@/components/PinInput';
import { usePosStore } from '@/store/pos-store';

export default function CashierPinScreen() {
  const router = useRouter();
  const { cashierId } = useLocalSearchParams<{ cashierId: string }>();
  const { db, loginCashier, session } = usePosStore();
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (session) {
      void router.replace('/cashier');
    }
  }, [session, router]);

  const cashier = db.users.cashiers[cashierId ?? ''];

  const handleCashierPin = useCallback(async (pin: string) => {
    if (!cashierId) return;
    setLoading(true);
    setError('');
    try {
      const success = await loginCashier(cashierId, pin);
      if (success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void router.replace('/cashier');
      } else {
        setError('Incorrect PIN');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  }, [cashierId, loginCashier, router]);

  if (!cashier) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.bg}>
      <Stack.Screen options={{ title: 'Cashier Login', headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <PinInput
            title="Cashier Login"
            subtitle={`Welcome, ${cashier.name}`}
            onComplete={handleCashierPin}
            error={error}
            loading={loading}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  safe: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 8,
    left: 0,
    paddingVertical: 8,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  backText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
  },
});
