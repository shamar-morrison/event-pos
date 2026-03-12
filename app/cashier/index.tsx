import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, Zap, Calendar } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import EmptyState from '@/components/EmptyState';
import { usePosStore } from '@/store/pos-store';

export default function CashierEventsScreen() {
  const router = useRouter();
  const { db, session, logout, setCurrentEvent } = usePosStore();

  const liveEvents = useMemo(
    () => Object.values(db.events).filter((e) => e.status === 'live').sort((a, b) => b.createdAt - a.createdAt),
    [db.events]
  );

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  const handleSelectEvent = (eventId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCurrentEvent(eventId);
    router.push(`/cashier/${eventId}`);
  };

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Hi, {session?.cashierName ?? 'Cashier'}
            </Text>
            <Text style={styles.subtitle}>Select an event to start selling</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {liveEvents.length === 0 ? (
            <EmptyState
              icon={<Calendar size={48} color={Colors.textMuted} />}
              title="No live events"
              subtitle="Ask your admin to set an event to live"
            />
          ) : (
            <View style={styles.eventList}>
              {liveEvents.map((event) => {
                const itemCount = Object.keys(event.items).length;
                return (
                  <TouchableOpacity
                    key={event.eventId}
                    style={styles.eventCard}
                    onPress={() => handleSelectEvent(event.eventId)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.eventLiveIndicator}>
                      <Zap size={16} color={Colors.statusLive} />
                      <Text style={styles.liveText}>LIVE</Text>
                    </View>
                    <Text style={styles.eventName}>{event.name}</Text>
                    <Text style={styles.eventMeta}>
                      {itemCount} item{itemCount !== 1 ? 's' : ''} available
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: { fontSize: 22, fontWeight: '700' as const, color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  eventList: { gap: 12 },
  eventCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.statusLive,
  },
  eventLiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.statusLive,
    letterSpacing: 1,
  },
  eventName: { fontSize: 20, fontWeight: '600' as const, color: Colors.text, marginBottom: 6 },
  eventMeta: { fontSize: 14, color: Colors.textSecondary },
});
