import axios from "axios";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL ?? "";

export const api = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 15000,
});

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
  created_at: string;
  updated_at: string;
};

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
