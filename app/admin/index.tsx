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
import {
  Plus,
  Users,
  Download,
  LogOut,
  Calendar,
  TrendingUp,
  Package,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import { useAdminEvents, useCashiers } from '@/hooks/use-pos-data';
import { usePosStore } from '@/store/pos-store';
import { formatMoney } from '@/utils/money';

export default function AdminDashboard() {
  const router = useRouter();
  const logout = usePosStore((state) => state.logout);
  const pairedAdmin = usePosStore((state) => state.pairedAdmin);
  const unpairDevice = usePosStore((state) => state.unpairDevice);
  const { data: events = [] } = useAdminEvents(pairedAdmin?.adminId, { realtime: true });
  const { data: cashiers = [] } = useCashiers(pairedAdmin?.adminId);

  const stats = useMemo(() => {
    const liveCount = events.filter((e) => e.status === 'live').length;
    const totalRevenue = events.reduce((sum, e) => sum + e.stats.totalRevenue, 0);
    const totalOrders = events.reduce((sum, e) => sum + e.stats.totalOrders, 0);
    return { liveCount, totalRevenue, totalOrders };
  }, [events]);

  const cashierCount = cashiers.length;

  const handleLogout = () => {
    Alert.alert('Admin Access', 'Choose how you want to leave the admin panel.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Exit Admin',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
      {
        text: 'Unpair Device',
        style: 'destructive',
        onPress: async () => {
          await unpairDevice();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Admin Panel</Text>
            <Text style={styles.subtitle}>{pairedAdmin?.email ?? 'Event Drink POS'}</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} testID="logout-btn">
            <LogOut size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: Colors.primaryBg }]}>
              <Calendar size={20} color={Colors.primary} />
              <Text style={[styles.statValue, { color: Colors.primary }]}>{stats.liveCount}</Text>
              <Text style={styles.statLabel}>Live Events</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.accentBg }]}>
              <TrendingUp size={20} color={Colors.accent} />
              <Text style={[styles.statValue, { color: Colors.accent }]}>{formatMoney(stats.totalRevenue)}</Text>
              <Text style={styles.statLabel}>Total Revenue</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: Colors.infoBg }]}>
              <Package size={20} color={Colors.info} />
              <Text style={[styles.statValue, { color: Colors.info }]}>{stats.totalOrders}</Text>
              <Text style={styles.statLabel}>Orders</Text>
            </View>
          </View>

          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/admin/cashiers'); }}
            >
              <Users size={18} color={Colors.text} />
              <Text style={styles.actionText}>Cashiers ({cashierCount})</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/admin/export-import'); }}
            >
              <Download size={18} color={Colors.text} />
              <Text style={styles.actionText}>Export / Import</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Events</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push('/admin/create-event'); }}
              testID="create-event-btn"
            >
              <Plus size={18} color={Colors.white} />
              <Text style={styles.addBtnText}>New Event</Text>
            </TouchableOpacity>
          </View>

          {events.length === 0 ? (
            <EmptyState
              icon={<Calendar size={48} color={Colors.textMuted} />}
              title="No events yet"
              subtitle="Create your first event to start selling"
            />
          ) : (
            <View style={styles.eventList}>
              {events.map((event) => {
                const itemCount = event.itemCount;
                const orderCount = event.stats.totalOrders;
                return (
                  <TouchableOpacity
                    key={event.eventId}
                    style={styles.eventCard}
                    onPress={() => router.push(`/admin/event/${event.eventId}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.eventCardHeader}>
                      <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
                      <StatusBadge status={event.status} />
                    </View>
                    <View style={styles.eventCardMeta}>
                      <Text style={styles.eventMetaText}>{itemCount} items</Text>
                      <View style={styles.metaDot} />
                      <Text style={styles.eventMetaText}>{orderCount} orders</Text>
                      <View style={styles.metaDot} />
                      <Text style={styles.eventMetaText}>{formatMoney(event.stats.totalRevenue)}</Text>
                    </View>
                    <Text style={styles.eventDate}>
                      {new Date(event.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
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
  greeting: { fontSize: 24, fontWeight: '700' as const, color: Colors.text },
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
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  statValue: { fontSize: 18, fontWeight: '700' as const },
  statLabel: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' as const },
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 14,
  },
  actionText: { fontSize: 14, fontWeight: '500' as const, color: Colors.text },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 19, fontWeight: '700' as const, color: Colors.text },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: { fontSize: 14, fontWeight: '600' as const, color: Colors.white },
  eventList: { gap: 10 },
  eventCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventName: { fontSize: 17, fontWeight: '600' as const, color: Colors.text, flex: 1, marginRight: 10 },
  eventCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  eventMetaText: { fontSize: 13, color: Colors.textSecondary },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.textMuted },
  eventDate: { fontSize: 12, color: Colors.textMuted },
});
