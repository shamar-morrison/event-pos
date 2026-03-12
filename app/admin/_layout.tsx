import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import Colors from '@/constants/colors';
import { usePosStore } from '@/store/pos-store';

export default function AdminLayout() {
  const isInitialized = usePosStore((state) => state.isInitialized);
  const isBootstrapping = usePosStore((state) => state.isBootstrapping);
  const session = usePosStore((state) => state.session);

  if (!isInitialized || isBootstrapping) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (session?.role !== 'admin') {
    return <Redirect href="/" />;
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
      <Stack.Screen name="index" options={{ title: 'Dashboard', headerShown: false }} />
      <Stack.Screen name="create-event" options={{ title: 'New Event', presentation: 'modal' }} />
      <Stack.Screen name="cashiers" options={{ title: 'Cashiers' }} />
      <Stack.Screen name="event/[eventId]" options={{ title: 'Event' }} />
      <Stack.Screen name="reports/[eventId]" options={{ title: 'Reports' }} />
      <Stack.Screen name="export-import" options={{ title: 'Export / Import' }} />
    </Stack>
  );
}
