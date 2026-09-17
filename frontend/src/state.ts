// Persistent local state: host flag + last client code.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const K_HOST = "gymcode:isHost";
const K_LAST_CODE = "gymcode:lastCode";

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
