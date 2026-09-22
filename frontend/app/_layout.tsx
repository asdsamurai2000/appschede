import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { LogBox, StatusBar, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect, useState } from "react";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { loadStoredScheme, useTheme } from "@/src/theme";
import { loadHostState, setIsHost, clearHostVerified } from "@/src/state";
import { setUnauthorizedHandler } from "@/src/api";

LogBox.ignoreAllLogs(true);

function Chrome({ children }: { children: React.ReactNode }) {
  const { scheme, colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar barStyle={scheme === "dark" ? "light-content" : "dark-content"} backgroundColor={colors.surface} />
      {children}
    </View>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      await Promise.all([loadStoredScheme(), loadHostState()]);
      setReady(true);
    })();
    setUnauthorizedHandler(() => {
      // Token scaduto o mancante: reset stato host e vai allo sblocco.
      clearHostVerified().catch(() => {});
      setIsHost(false);
      try { router.replace("/host-unlock"); } catch {}
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  if (!ready) return null;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <KeyboardProvider>
            <Chrome>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" } }} />
            </Chrome>
          </KeyboardProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
