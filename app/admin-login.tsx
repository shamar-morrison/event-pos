import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePosStore } from '@/store/pos-store';

export default function AdminLoginScreen() {
  const router = useRouter();
  const { loginAdmin } = usePosStore();
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = useCallback(async () => {
    if (!adminUsername.trim() || !adminPassword) return;
    setLoading(true);
    setError('');
    try {
      const success = await loginAdmin(adminUsername.trim(), adminPassword);
      if (success) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void router.replace('/admin');
      } else {
        setError('Invalid username or password');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  }, [adminUsername, adminPassword, loginAdmin, router]);

  return (
    <View style={styles.bg}>
      <Stack.Screen options={{ title: 'Admin Login', headerShown: false }} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.container}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Text style={styles.backText}>← Back</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>Admin Login</Text>
              <Text style={styles.sectionSubtitle}>Enter your username and password</Text>

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Username</Text>
                  <TextInput
                    style={styles.input}
                    value={adminUsername}
                    onChangeText={setAdminUsername}
                    placeholder="Enter username"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    testID="admin-username"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={styles.passwordInput}
                      value={adminPassword}
                      onChangeText={setAdminPassword}
                      placeholder="Enter password"
                      placeholderTextColor={Colors.textMuted}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onSubmitEditing={handleAdminLogin}
                      returnKeyType="go"
                      testID="admin-password"
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      {showPassword ? (
                        <EyeOff size={20} color={Colors.textMuted} />
                      ) : (
                        <Eye size={20} color={Colors.textMuted} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.loginBtn,
                    (!adminUsername.trim() || !adminPassword || loading) && styles.loginBtnDisabled,
                  ]}
                  onPress={handleAdminLogin}
                  disabled={!adminUsername.trim() || !adminPassword || loading}
                  activeOpacity={0.7}
                  testID="admin-login-submit"
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.loginBtnText}>Sign In</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  flex: {
    flex: 1,
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
  form: {
    gap: 18,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  errorBox: {
    backgroundColor: Colors.dangerBg,
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  loginBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  loginBtnDisabled: {
    opacity: 0.4,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
