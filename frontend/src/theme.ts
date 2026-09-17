// Dual theme (light: white/red, dark: black/red) with user-controlled scheme
// persisted to AsyncStorage. Values match /app/design_guidelines.json.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Appearance, StyleSheet } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#0A0A0A",
  surfaceSecondary: "#F4F4F4",
  onSurfaceSecondary: "#0A0A0A",
  surfaceTertiary: "#EAEAEA",
  onSurfaceTertiary: "#0A0A0A",
  surfaceInverse: "#0A0A0A",
  onSurfaceInverse: "#FFFFFF",
  muted: "#737373",

  brand: "#E52020",
  onBrand: "#FFFFFF",
  brandPrimary: "#E52020",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#B31616",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#FFE5E5",
  onBrandTertiary: "#E52020",

  success: "#15803D",
  onSuccess: "#FFFFFF",
  warning: "#B45309",
  onWarning: "#FFFFFF",
  error: "#B91C1C",
  onError: "#FFFFFF",
  info: "#333333",
  onInfo: "#FFFFFF",

  border: "#E5E5E5",
  borderStrong: "#0A0A0A",
  divider: "#E5E5E5",
};

const dark: typeof light = {
  surface: "#0A0A0A",
  onSurface: "#FAFAFA",
  surfaceSecondary: "#141414",
  onSurfaceSecondary: "#FAFAFA",
  surfaceTertiary: "#1F1F1F",
  onSurfaceTertiary: "#FAFAFA",
  surfaceInverse: "#FAFAFA",
  onSurfaceInverse: "#0A0A0A",
  muted: "#888888",

  brand: "#FF3333",
  onBrand: "#050505",
  brandPrimary: "#FF3333",
  onBrandPrimary: "#050505",
  brandSecondary: "#E52020",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#330A0A",
  onBrandTertiary: "#FF3333",

  success: "#00E676",
  onSuccess: "#000000",
  warning: "#FFEA00",
  onWarning: "#000000",
  error: "#FF3333",
  onError: "#FFFFFF",
  info: "#FAFAFA",
  onInfo: "#0A0A0A",

  border: "#333333",
  borderStrong: "#FAFAFA",
  divider: "#222222",
};

export type ThemeColors = typeof light;
export const themes: Record<ColorScheme, ThemeColors> = { light, dark };

const STORAGE_KEY = "gymcode:scheme";

// Global reactive scheme.
let currentScheme: ColorScheme = "light";
const listeners = new Set<(s: ColorScheme) => void>();

function emit() {
  listeners.forEach((l) => l(currentScheme));
}

export function setColorScheme(scheme: ColorScheme) {
  currentScheme = scheme;
  Appearance.setColorScheme?.(scheme);
  AsyncStorage.setItem(STORAGE_KEY, scheme).catch(() => {});
  emit();
}

export async function loadStoredScheme(): Promise<ColorScheme> {
  try {
    const stored = (await AsyncStorage.getItem(STORAGE_KEY)) as ColorScheme | null;
    if (stored === "light" || stored === "dark") {
      currentScheme = stored;
      Appearance.setColorScheme?.(stored);
      emit();
      return stored;
    }
  } catch {}
  return currentScheme;
}

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const [scheme, setScheme] = useState<ColorScheme>(currentScheme);
  useEffect(() => {
    const l = (s: ColorScheme) => setScheme(s);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { scheme, colors: themes[scheme] };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const fonts = {
  display: undefined as string | undefined, // system, uppercase heavy tracking
  mono: "Courier",
} as const;
