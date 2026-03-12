import { Stack } from 'expo-router';
import React from 'react';
import Colors from '@/constants/colors';

export default function AdminLayout() {
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
