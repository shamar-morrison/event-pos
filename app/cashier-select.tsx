import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useCashiers } from '@/hooks/use-pos-data';
import { usePosStore } from '@/store/pos-store';

export default function CashierSelectScreen() {
  const router = useRouter();
  const isInitialized = usePosStore((state) => state.isInitialized);
  const isBootstrapping = usePosStore((state) => state.isBootstrapping);
  const pairedAdmin = usePosStore((state) => state.pairedAdmin);
  const session = usePosStore((state) => state.session);
  const { data: cashiers = [], isLoading } = useCashiers(pairedAdmin?.adminId);

  React.useEffect(() => {
    if (!isInitialized || isBootstrapping) return;
    if (!pairedAdmin) {
      void router.replace('/');
      return;
    }
    if (session?.role === 'cashier') {
      void router.replace('/cashier');
    }
  }, [isBootstrapping, isInitialized, pairedAdmin, router, session]);

  const handleSelectCashier = (cashierId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/cashier-pin',
      params: { cashierId },
    });
  };

  if (!isInitialized || isBootstrapping || isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.bg}>
      <Stack.Screen options={{ title: 'Select Cashier', headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.container}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Select Cashier</Text>
            <Text style={styles.sectionSubtitle}>
              {pairedAdmin ? `Choose a cashier for ${pairedAdmin.email}` : 'This device is not paired to an admin'}
            </Text>

            <View style={styles.cashierList}>
              {cashiers.map((c) => (
                <TouchableOpacity
                  key={c.cashierId}
                  style={styles.cashierCard}
                  onPress={() => handleSelectCashier(c.cashierId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cashierAvatar}>
                    <Text style={styles.cashierInitial}>{c.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.cashierName}>{c.name}</Text>
                  <ChevronRight size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            {cashiers.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No cashiers available</Text>
                <Text style={styles.emptySubtext}>Please contact the paired admin to create cashier accounts</Text>
              </View>
            )}
          </View>
        </ScrollView>
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
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  container: {
    paddingHorizontal: 24,
  },
  backButton: {
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  cashierList: {
    gap: 10,
  },
  cashierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  cashierAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.infoBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cashierInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.info,
  },
  cashierName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
});
