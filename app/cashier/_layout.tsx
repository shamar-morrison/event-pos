import { Stack } from 'expo-router';
import React from 'react';
import Colors from '@/constants/colors';

export default function CashierLayout() {
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
