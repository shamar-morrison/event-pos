import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import Colors from '@/constants/colors';
import { usePosStore } from '@/store/pos-store';

export default function CashierLayout() {
  const isInitialized = usePosStore((state) => state.isInitialized);
  const isBootstrapping = usePosStore((state) => state.isBootstrapping);
  const pairedAdmin = usePosStore((state) => state.pairedAdmin);
  const session = usePosStore((state) => state.session);

  if (!isInitialized || isBootstrapping) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!pairedAdmin) {
    return <Redirect href="/" />;
  }

  if (session?.role !== 'cashier') {
    return <Redirect href="/cashier-select" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: Colors.bg },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Events', headerShown: false }} />
      <Stack.Screen name="[eventId]" options={{ title: 'POS' }} />
      <Stack.Screen name="checkout" options={{ title: 'Checkout', presentation: 'modal' }} />
    </Stack>
  );
}
