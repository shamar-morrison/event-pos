import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { queryClient } from "@/lib/query-client";
import { usePosStore } from "@/store/pos-store";

void SplashScreen.preventAutoHideAsync();

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
    let active = true;
    const fallback = setTimeout(() => {
      if (!active) return;
      void SplashScreen.hideAsync();
    }, 2500);

    void initialize()
      .catch((error) => {
        console.error('[RootLayout] Failed to initialize app:', error);
      })
      .finally(() => {
        if (!active) return;
        clearTimeout(fallback);
        void SplashScreen.hideAsync();
      });

    return () => {
      active = false;
      clearTimeout(fallback);
    };
  }, [initialize]);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootLayoutNav />
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
