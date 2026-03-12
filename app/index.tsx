import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, User, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useCashiers } from '@/hooks/use-pos-data';
import { usePosStore } from '@/store/pos-store';

export default function RoleSelectScreen() {
  const router = useRouter();
  const session = usePosStore((state) => state.session);
  const pairedAdmin = usePosStore((state) => state.pairedAdmin);
  const isInitialized = usePosStore((state) => state.isInitialized);
  const isBootstrapping = usePosStore((state) => state.isBootstrapping);
  const authError = usePosStore((state) => state.authError);
  const clearAuthError = usePosStore((state) => state.clearAuthError);
  const { data: cashiers = [] } = useCashiers(pairedAdmin?.adminId);

  React.useEffect(() => {
    if (!isInitialized || isBootstrapping) return;
    if (session) {
      if (session.role === 'admin') {
        void router.replace('/admin');
      } else {
        void router.replace('/cashier');
      }
    }
  }, [isBootstrapping, isInitialized, router, session]);

  if (!isInitialized || isBootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.container}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>EP</Text>
              </View>
              <Text style={styles.appTitle}>Welcome to Event POS</Text>
              <Text style={styles.appSubtitle}>
                {pairedAdmin ? `Paired to ${pairedAdmin.email}` : 'Pair this device with an admin to continue'}
              </Text>
            </View>

            {authError ? (
              <TouchableOpacity
                style={styles.errorBox}
                onPress={clearAuthError}
                activeOpacity={0.8}
              >
                <Text style={styles.errorText}>{authError}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.roleCards}>
              <TouchableOpacity
                style={styles.roleCard}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  void router.push('/admin-login');
                }}
                activeOpacity={0.7}
                testID="login-admin"
              >
                <View style={[styles.roleIcon, { backgroundColor: Colors.primaryBg }]}>
                  <Shield size={28} color={Colors.primary} />
                </View>
                <View style={styles.roleInfo}>
                  <Text style={styles.roleName}>Admin</Text>
                  <Text style={styles.roleDesc}>
                    {pairedAdmin ? 'Re-enter admin credentials to manage events' : 'Pair this device with an admin account'}
                  </Text>
                </View>
                <ChevronRight size={20} color={Colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleCard, (!pairedAdmin || cashiers.length === 0) && styles.roleCardDisabled]}
                onPress={() => {
                  if (!pairedAdmin || cashiers.length === 0) return;
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  void router.push('/cashier-select');
                }}
                activeOpacity={pairedAdmin && cashiers.length > 0 ? 0.7 : 1}
                testID="login-cashier"
              >
                <View style={[styles.roleIcon, { backgroundColor: Colors.infoBg }]}>
                  <User size={28} color={Colors.info} />
                </View>
                <View style={styles.roleInfo}>
                  <Text style={styles.roleName}>Cashier</Text>
                  <Text style={styles.roleDesc}>
                    {!pairedAdmin
                      ? 'Admin must pair this device first'
                      : cashiers.length > 0
                        ? `${cashiers.length} cashier${cashiers.length > 1 ? 's' : ''} available`
                        : 'No cashiers yet'}
                  </Text>
                </View>
                <ChevronRight size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
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
  },
  container: {
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  appSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  roleCards: {
    gap: 12,
  },
  errorBox: {
    backgroundColor: Colors.dangerBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.danger,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  roleCardDisabled: {
    opacity: 0.4,
  },
  roleIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleInfo: {
    flex: 1,
  },
  roleName: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  roleDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
