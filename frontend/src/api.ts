import axios from "axios";
import { getHostToken, clearHostToken } from "./authStorage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";

export const api = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 15000,
});

// ---- Auth interceptors ----
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(h: UnauthorizedHandler | null) {
  onUnauthorized = h;
}

api.interceptors.request.use(async (config) => {
  const token = await getHostToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url ?? "");
    // A wrong host password is NOT a session-expiry event.
    if (status === 401 && !url.endsWith("/host/verify")) {
      await clearHostToken();
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);

export type ExerciseItem = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight: string;
  rest_seconds: number;
  notes: string;
};

export type SessionItem = {
  id: string;
  name: string;
  exercises: ExerciseItem[];
};

export type Scheda = {
  id: string;
  code: string;
  name: string;
  client_name: string;
  sessions: SessionItem[];
  paid_month?: string | null;
  created_at: string;
  updated_at: string;
};

export function isPaidThisMonth(paidMonth?: string | null): boolean {
  if (!paidMonth) return false;
  const now = new Date();
  const cur = `${now.getFullYear().toString().padStart(4, "0")}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
  return paidMonth === cur;
}

export type CheckIn = {
  id: string;
  code: string;
  session_id?: string | null;
  session_name?: string | null;
  timestamp: string;
};

export type CheckInStats = {
  week: number;
  month: number;
  year: number;
  total: number;
  weekly_history: { week_start: string; count: number }[];
};

export type LibraryExercise = {
  id: string;
  name: string;
  muscle_group: string;
  description: string;
};

export type ClientState = {
  code: string;
  exercise_id: string;
  notes: string;
  weight: string;
  reps: string;
  updated_at: string;
};

export type ClientStateHistory = {
  id: string;
  code: string;
  exercise_id: string;
  session_id?: string | null;
  session_name?: string | null;
  notes: string;
  weight: string;
  reps: string;
  timestamp: string;
};

export type WarmupTemplate = {
  exercises: ExerciseItem[];
  updated_at: string;
};
