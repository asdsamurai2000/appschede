// Persistent local state: host flag + last client code.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { useEffect, useState } from "react";

const K_HOST = "gymcode:isHost";
const K_LAST_CODE = "gymcode:lastCode";
const K_HOST_VERIFIED = "gymcode.host.verified.v1";

let hostState = false;
const hostListeners = new Set<(v: boolean) => void>();

export async function loadHostState() {
  try {
    const v = await AsyncStorage.getItem(K_HOST);
    hostState = v === "1";
    hostListeners.forEach((l) => l(hostState));
  } catch {}
}

export function setIsHost(v: boolean) {
  hostState = v;
  AsyncStorage.setItem(K_HOST, v ? "1" : "0").catch(() => {});
  hostListeners.forEach((l) => l(hostState));
}

export function useIsHost() {
  const [v, setV] = useState(hostState);
  useEffect(() => {
    const l = (nv: boolean) => setV(nv);
    hostListeners.add(l);
    return () => {
      hostListeners.delete(l);
    };
  }, []);
  return v;
}

export async function saveLastCode(code: string) {
  await AsyncStorage.setItem(K_LAST_CODE, code);
}

export async function getLastCode(): Promise<string | null> {
  return AsyncStorage.getItem(K_LAST_CODE);
}

export async function clearLastCode() {
  await AsyncStorage.removeItem(K_LAST_CODE);
}

// ---- Host verified (password gate) ----
export async function getHostVerified(): Promise<boolean> {
  const v = Platform.OS === "web"
    ? await AsyncStorage.getItem(K_HOST_VERIFIED)
    : await SecureStore.getItemAsync(K_HOST_VERIFIED);
  return v === "1";
}

export async function setHostVerified() {
  if (Platform.OS === "web") await AsyncStorage.setItem(K_HOST_VERIFIED, "1");
  else await SecureStore.setItemAsync(K_HOST_VERIFIED, "1");
}

export async function clearHostVerified() {
  if (Platform.OS === "web") await AsyncStorage.removeItem(K_HOST_VERIFIED);
  else await SecureStore.deleteItemAsync(K_HOST_VERIFIED);
}

// ---- Client-side per-exercise overrides (weight delta + client notes) ----
export type ExerciseOverride = { weight?: string; reps?: string; clientNotes?: string };
export type SessionOverrides = Record<string, ExerciseOverride>; // exerciseId -> override

function overrideKey(code: string) { return `gymcode:overrides:${code}`; }

export async function getSessionOverrides(code: string): Promise<SessionOverrides> {
  try {
    const raw = await AsyncStorage.getItem(overrideKey(code));
    if (!raw) return {};
    return JSON.parse(raw) as SessionOverrides;
  } catch {
    return {};
  }
}

export async function saveSessionOverrides(code: string, overrides: SessionOverrides) {
  await AsyncStorage.setItem(overrideKey(code), JSON.stringify(overrides));
}
