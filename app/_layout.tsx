import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { usePosStore } from "@/store/pos-store";

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0B0E14' },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="index" options={{ gestureEnabled: false }} />
      <Stack.Screen name="setup" />
      <Stack.Screen name="admin-login" />
      <Stack.Screen name="cashier-select" />
      <Stack.Screen name="cashier-pin" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="cashier" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const initialize = usePosStore((s) => s.initialize);

  useEffect(() => {
    void initialize().then(() => {
      void SplashScreen.hideAsync();
    });
  }, [initialize]);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootLayoutNav />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
