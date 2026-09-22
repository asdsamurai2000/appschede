// Secure storage for the host JWT access token.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "gymcode.host.token.v1";

export async function getHostToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return await AsyncStorage.getItem(KEY);
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setHostToken(token: string): Promise<void> {
  if (Platform.OS === "web") await AsyncStorage.setItem(KEY, token);
  else await SecureStore.setItemAsync(KEY, token);
}

export async function clearHostToken(): Promise<void> {
  try {
    if (Platform.OS === "web") await AsyncStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {}
}
