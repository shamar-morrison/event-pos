import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

export default function SetupScreen() {
  const router = useRouter();

  return (
    <View style={styles.bg}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Admin Provisioning Required</Text>
          <Text style={styles.subtitle}>
            Admin accounts are now managed in Firebase. Sign in with an existing admin account to pair this device.
          </Text>

          <TouchableOpacity style={styles.button} onPress={() => router.replace('/admin-login')}>
            <Text style={styles.buttonText}>Go to Admin Login</Text>
          </TouchableOpacity>
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
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  button: {
    marginTop: 12,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
