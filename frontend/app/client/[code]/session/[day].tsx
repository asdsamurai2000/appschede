import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Modal, TextInput } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LucideIcon from "@react-native-vector-icons/lucide";

import { makeStyles, useTheme } from "@/src/theme";
import { Header } from "@/src/components/header";
import { Button } from "@/src/components/ui";
import { api, type Scheda, type SessionItem, type ClientState, type WarmupTemplate, type ClientStateHistory } from "@/src/api";
import { getSessionOverrides, saveSessionOverrides, type SessionOverrides } from "@/src/state";

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  card: {
    borderWidth: 2, borderColor: c.borderStrong, marginTop: 12, backgroundColor: c.surface,
  },
  cardHeader: {
    padding: 14, borderBottomWidth: 2, borderBottomColor: c.borderStrong,
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surfaceSecondary,
  },
  exNum: {
    width: 32, height: 32, backgroundColor: c.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  exNumText: { color: c.onBrandPrimary, fontWeight: "800", fontSize: 14 },
  exName: { flex: 1, color: c.onSurface, fontWeight: "800", fontSize: 16, letterSpacing: 0.5, textTransform: "uppercase" },
  metaGrid: { flexDirection: "row" },
  metaCell: { flex: 1, padding: 12 },
  metaDiv: { borderRightWidth: 1, borderRightColor: c.divider },
  metaLabel: { color: c.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" },
  metaValue: { color: c.onSurface, fontSize: 22, fontWeight: "800", marginTop: 4, letterSpacing: -0.5 },
  weightBlock: {
    paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.divider,
  },
  weightRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 6, gap: 12,
  },
  weightStepper: {
    width: 44, height: 44, borderWidth: 2, borderColor: c.borderStrong,
    alignItems: "center", justifyContent: "center",
  },
  weightValue: {
    color: c.onSurface, fontSize: 28, fontWeight: "800", letterSpacing: -0.5,
    flex: 1, textAlign: "center",
  },
  notesRow: { padding: 12, borderTopWidth: 1, borderTopColor: c.divider },
  notesLabel: {
    color: c.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6,
  },
  hostNotes: { color: c.onSurface, fontSize: 13, lineHeight: 18, fontStyle: "italic", marginBottom: 10 },
  clientNoteInput: {
    borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSecondary,
    color: c.onSurface, fontSize: 13, paddingHorizontal: 10, paddingVertical: 8, minHeight: 44,
  },
  historyBtn: {
    marginTop: 10, borderWidth: 2, borderColor: c.brandPrimary, backgroundColor: c.brandTertiary,
    paddingVertical: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  historyBtnText: {
    color: c.brandPrimary, fontWeight: "800", letterSpacing: 2,
    textTransform: "uppercase", fontSize: 12,
  },
  // history modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: c.surface, borderTopWidth: 2, borderTopColor: c.borderStrong, maxHeight: "80%" },
  modalHeader: {
    padding: 16, borderBottomWidth: 2, borderBottomColor: c.borderStrong,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  modalTitle: { color: c.onSurface, fontWeight: "800", fontSize: 16, letterSpacing: 2, textTransform: "uppercase" },
  historyRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: c.divider },
  historyDate: { color: c.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" },
  historyWeight: { color: c.onSurface, fontWeight: "800", fontSize: 22, marginTop: 4, letterSpacing: -0.5 },
  historySession: { color: c.brandPrimary, fontSize: 11, letterSpacing: 2, marginTop: 2, textTransform: "uppercase" },
  historyNote: { color: c.onSurfaceSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
  setsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: c.divider },
  setChip: {
    width: 44, height: 44, borderWidth: 2, borderColor: c.borderStrong,
    alignItems: "center", justifyContent: "center",
  },
  setChipDone: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  setChipText: { color: c.onSurface, fontWeight: "800", fontSize: 14 },
  setChipTextDone: { color: c.onBrandPrimary, fontWeight: "800", fontSize: 14 },
  timerRestBtn: {
    marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 2, borderColor: c.brandPrimary, paddingVertical: 10,
  },
  timerRestBtnText: {
    color: c.brandPrimary, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", fontSize: 12,
  },
  // timer modal
  timerBackdrop: { flex: 1, backgroundColor: c.surface, alignItems: "center", justifyContent: "center" },
  timerLabel: { color: c.muted, fontSize: 12, letterSpacing: 4, textTransform: "uppercase" },
  timerBig: { color: c.brandPrimary, fontSize: 140, fontWeight: "800", letterSpacing: -6, lineHeight: 140 },
  timerBar: { height: 8, backgroundColor: c.surfaceTertiary, alignSelf: "stretch", marginHorizontal: 32, marginTop: 24 },
  timerBarFill: { height: 8, backgroundColor: c.brandPrimary },
  timerActions: { flexDirection: "row", gap: 12, marginTop: 40, paddingHorizontal: 32 },
  timerBtn: { flex: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 2, borderTopColor: c.borderStrong, backgroundColor: c.surface, gap: 8 },
}));

type SetStatus = Record<string, number>; // exerciseId -> completed count

// Parse a weight string into { num, unit }. Non-numeric returns num=null.
function parseWeight(raw: string): { num: number | null; unit: string } {
  const s = (raw || "").trim();
  const m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return { num: null, unit: s };
  const num = parseFloat(m[1].replace(",", "."));
  return { num: Number.isFinite(num) ? num : null, unit: (m[2] || "kg").trim() };
}
function formatWeight(num: number | null, unit: string): string {
  if (num === null) return unit || "—";
  const n = Number.isInteger(num) ? num.toString() : num.toFixed(1);
  return unit ? `${n} ${unit}` : n;
}

export default function ActiveSession() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { code, day } = useLocalSearchParams<{ code: string; day: string }>();

  const [scheda, setScheda] = useState<Scheda | null>(null);
  const [warmupSession, setWarmupSession] = useState<SessionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<SetStatus>({});
  const [checkingIn, setCheckingIn] = useState(false);
  const [overrides, setOverrides] = useState<SessionOverrides>({});
  const [historyFor, setHistoryFor] = useState<{ exId: string; exName: string } | null>(null);
  const [historyItems, setHistoryItems] = useState<ClientStateHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const openHistory = async (exId: string, exName: string) => {
    setHistoryFor({ exId, exName });
    setHistoryItems([]);
    setHistoryLoading(true);
    try {
      const r = await api.get<ClientStateHistory[]>(`/schede/${code}/client-state/${exId}/history?limit=30`);
      setHistoryItems(r.data);
    } catch {}
    finally { setHistoryLoading(false); }
  };

  const isWarmup = day === "warmup";

  // Rest timer
  const [restOpen, setRestOpen] = useState(false);
  const [restTotal, setRestTotal] = useState(60);
  const [restLeft, setRestLeft] = useState(60);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (isWarmup) {
          const [w, s] = await Promise.all([
            api.get<WarmupTemplate>(`/warmup`),
            api.get<ClientState[]>(`/schede/${code}/client-state`).catch(() => ({ data: [] as ClientState[] })),
          ]);
          setWarmupSession({ id: "warmup", name: "Riscaldamento", exercises: w.data.exercises });
          const local = await getSessionOverrides(code!);
          const merged: SessionOverrides = { ...local };
          for (const cs of s.data) {
            merged[cs.exercise_id] = {
              weight: cs.weight || merged[cs.exercise_id]?.weight,
              reps: cs.reps || merged[cs.exercise_id]?.reps,
              clientNotes: cs.notes || merged[cs.exercise_id]?.clientNotes,
            };
          }
          setOverrides(merged);
        } else {
          const [r, s] = await Promise.all([
            api.get<Scheda>(`/schede/${code}`),
            api.get<ClientState[]>(`/schede/${code}/client-state`).catch(() => ({ data: [] as ClientState[] })),
          ]);
          setScheda(r.data);
          const local = await getSessionOverrides(code!);
          const merged: SessionOverrides = { ...local };
          for (const cs of s.data) {
            merged[cs.exercise_id] = {
              weight: cs.weight || merged[cs.exercise_id]?.weight,
              reps: cs.reps || merged[cs.exercise_id]?.reps,
              clientNotes: cs.notes || merged[cs.exercise_id]?.clientNotes,
            };
          }
          setOverrides(merged);
        }
      } finally { setLoading(false); }
    })();
  }, [code, isWarmup]);

  // Persist overrides locally + push to backend (debounced per exercise).
  const savedRef = useRef(false);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastSentRef = useRef<SessionOverrides>({});

  useEffect(() => {
    if (!savedRef.current) {
      savedRef.current = true;
      lastSentRef.current = overrides;
      return;
    }
    if (!code) return;
    saveSessionOverrides(code, overrides).catch(() => {});
    // Diff & schedule per-exercise sync
    for (const [exId, cur] of Object.entries(overrides)) {
      const prev = lastSentRef.current[exId];
      if (prev?.weight === cur.weight && prev?.reps === cur.reps && prev?.clientNotes === cur.clientNotes) continue;
      if (debounceRef.current[exId]) clearTimeout(debounceRef.current[exId]);
      debounceRef.current[exId] = setTimeout(() => {
        api.put(`/schede/${code}/client-state/${exId}`, {
          notes: cur.clientNotes ?? "",
          weight: cur.weight ?? "",
          reps: cur.reps ?? "",
        }).catch(() => {});
        lastSentRef.current = { ...lastSentRef.current, [exId]: { ...cur } };
      }, 800);
    }
  }, [overrides, code]);

  useEffect(() => () => {
    const timers = debounceRef.current;
    Object.values(timers).forEach((t) => clearTimeout(t));
  }, []);

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  const session = isWarmup ? warmupSession : scheda?.sessions[parseInt(day || "0", 10)];

  const startRest = (seconds: number) => {
    if (tickRef.current) clearInterval(tickRef.current);
    setRestTotal(seconds); setRestLeft(seconds); setRestOpen(true);
    tickRef.current = setInterval(() => {
      setRestLeft((n) => {
        if (n <= 1) {
          if (tickRef.current) clearInterval(tickRef.current);
          setRestOpen(false);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  };

  const cancelRest = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    setRestOpen(false);
  };

  const toggleSet = (exId: string, maxSets: number, restSecs: number) => {
    const cur = done[exId] ?? 0;
    const next = cur >= maxSets ? 0 : cur + 1;
    setDone((s) => ({ ...s, [exId]: next }));
    if (next > 0 && next < maxSets && restSecs > 0) startRest(restSecs);
  };

  const finishSession = async () => {
    if (isWarmup) {
      // Riscaldamento non registra un ingresso: si chiude e basta.
      router.back();
      return;
    }
    setCheckingIn(true);
    try {
      await api.post("/checkins", { code, session_id: session?.id, session_name: session?.name });
      router.back();
    } finally { setCheckingIn(false); }
  };

  if (loading || !session) {
    return (
      <View style={styles.root}>
        <Header title="Sessione" back />
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.brandPrimary} />
      </View>
    );
  }

  const totalExercises = session.exercises.length;
  const completed = session.exercises.filter((e) => (done[e.id] ?? 0) >= e.sets).length;

  const mm = String(Math.floor(restLeft / 60)).padStart(2, "0");
  const ss = String(restLeft % 60).padStart(2, "0");

  return (
    <View style={styles.root}>
      <Header title={session.name} subtitle={`${completed}/${totalExercises} completati`} back />
      <ScrollView contentContainerStyle={styles.content}>
        {session.exercises.map((ex, idx) => {
          const doneSets = done[ex.id] ?? 0;
          return (
            <View key={ex.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.exNum}><Text style={styles.exNumText}>{idx + 1}</Text></View>
                <Text style={styles.exName} numberOfLines={1}>{ex.name || `Esercizio ${idx + 1}`}</Text>
              </View>
              <View style={styles.metaGrid}>
                <View style={[styles.metaCell, styles.metaDiv]}>
                  <Text style={styles.metaLabel}>Serie</Text>
                  <Text style={styles.metaValue}>{ex.sets}</Text>
                </View>
                <View style={isWarmup ? styles.metaCell : [styles.metaCell, styles.metaDiv]}>
                  <Text style={styles.metaLabel}>{isWarmup ? "Durata" : "Reps"}</Text>
                  <Text style={styles.metaValue}>{ex.reps || "—"}</Text>
                </View>
                {!isWarmup ? (
                  <View style={styles.metaCell}>
                    <Text style={styles.metaLabel}>Rec</Text>
                    <Text style={styles.metaValue}>{ex.rest_seconds}s</Text>
                  </View>
                ) : null}
              </View>
              {!isWarmup ? (() => {
                const raw = overrides[ex.id]?.weight ?? ex.weight ?? "";
                const { num, unit } = parseWeight(raw);
                const canStep = num !== null;
                const step = (delta: number) => {
                  const cur = num ?? 0;
                  const next = Math.max(0, cur + delta);
                  const newWeight = formatWeight(next, unit || "kg");
                  setOverrides((o) => ({ ...o, [ex.id]: { ...o[ex.id], weight: newWeight } }));
                };
                return (
                  <View style={styles.weightBlock}>
                    <Text style={styles.metaLabel}>Peso</Text>
                    <View style={styles.weightRow}>
                      <Pressable
                        testID={`weight-minus-${ex.id}`}
                        onPress={() => step(-1)}
                        disabled={!canStep}
                        style={[styles.weightStepper, !canStep ? { opacity: 0.35 } : null]}
                        hitSlop={8}
                      >
                        <LucideIcon name="minus" size={18} color={colors.onSurface} />
                      </Pressable>
                      <Text style={styles.weightValue} numberOfLines={1} testID={`weight-value-${ex.id}`}>
                        {raw ? formatWeight(num, unit) : "—"}
                      </Text>
                      <Pressable
                        testID={`weight-plus-${ex.id}`}
                        onPress={() => step(1)}
                        style={styles.weightStepper}
                        hitSlop={8}
                      >
                        <LucideIcon name="plus" size={18} color={colors.onSurface} />
                      </Pressable>
                    </View>
                  </View>
                );
              })() : null}
              {!isWarmup ? (() => {
                const raw = overrides[ex.id]?.reps ?? "";
                const num = raw ? parseInt(raw.replace(/[^0-9]/g, ""), 10) : NaN;
                const cur = Number.isFinite(num) ? num : 0;
                const stepReps = (delta: number) => {
                  const next = Math.max(0, cur + delta);
                  setOverrides((o) => ({ ...o, [ex.id]: { ...o[ex.id], reps: String(next) } }));
                };
                return (
                  <View style={styles.weightBlock}>
                    <Text style={styles.metaLabel}>Ripetizioni fatte</Text>
                    <View style={styles.weightRow}>
                      <Pressable
                        testID={`reps-minus-${ex.id}`}
                        onPress={() => stepReps(-1)}
                        style={styles.weightStepper}
                        hitSlop={8}
                      >
                        <LucideIcon name="minus" size={18} color={colors.onSurface} />
                      </Pressable>
                      <Text style={styles.weightValue} numberOfLines={1} testID={`reps-value-${ex.id}`}>
                        {raw ? String(cur) : "—"}
                      </Text>
                      <Pressable
                        testID={`reps-plus-${ex.id}`}
                        onPress={() => stepReps(1)}
                        style={styles.weightStepper}
                        hitSlop={8}
                      >
                        <LucideIcon name="plus" size={18} color={colors.onSurface} />
                      </Pressable>
                    </View>
                    <Pressable
                      testID={`client-open-history-${ex.id}`}
                      onPress={() => openHistory(ex.id, ex.name || "Esercizio")}
                      style={styles.historyBtn}
                    >
                      <LucideIcon name="line-chart" size={14} color={colors.brandPrimary} />
                      <Text style={styles.historyBtnText}>Storico progressione</Text>
                    </Pressable>
                  </View>
                );
              })() : null}
              <View style={styles.notesRow}>
                {ex.notes ? (
                  <>
                    <Text style={styles.notesLabel}>Note del coach</Text>
                    <Text style={styles.hostNotes}>{ex.notes}</Text>
                  </>
                ) : null}
                <Text style={styles.notesLabel}>Le tue note</Text>
                <TextInput
                  testID={`client-notes-${ex.id}`}
                  value={overrides[ex.id]?.clientNotes ?? ""}
                  onChangeText={(v) => setOverrides((o) => ({ ...o, [ex.id]: { ...o[ex.id], clientNotes: v } }))}
                  placeholder="Aggiungi appunti (sensazioni, peso raggiunto…)"
                  placeholderTextColor={colors.muted}
                  multiline
                  style={styles.clientNoteInput}
                />
              </View>
              <View style={styles.setsRow}>
                {Array.from({ length: ex.sets }).map((_, s) => {
                  const isDone = s < doneSets;
                  return (
                    <Pressable
                      key={s}
                      testID={`set-chip-${ex.id}-${s}`}
                      onPress={() => toggleSet(ex.id, ex.sets, ex.rest_seconds)}
                      style={[styles.setChip, isDone ? styles.setChipDone : null]}
                    >
                      <Text style={isDone ? styles.setChipTextDone : styles.setChipText}>{s + 1}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {!isWarmup && ex.rest_seconds > 0 ? (
                <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                  <Pressable
                    testID={`start-rest-${ex.id}`}
                    onPress={() => startRest(ex.rest_seconds)}
                    style={styles.timerRestBtn}
                  >
                    <LucideIcon name="timer" size={16} color={colors.brandPrimary} />
                    <Text style={styles.timerRestBtnText}>Recupero {ex.rest_seconds}s</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          testID="finish-session-button"
          label={isWarmup ? "Fatto" : "Termina & Registra"}
          onPress={finishSession}
          loading={checkingIn}
        />
      </View>

      <Modal visible={restOpen} animationType="fade" onRequestClose={cancelRest}>
        <View style={styles.timerBackdrop}>
          <Text style={styles.timerLabel}>Recupero</Text>
          <Text style={styles.timerBig}>{mm}:{ss}</Text>
          <View style={styles.timerBar}>
            <View
              style={[
                styles.timerBarFill,
                { width: `${Math.max(0, Math.min(100, (restLeft / Math.max(1, restTotal)) * 100))}%` } as any,
              ]}
            />
          </View>
          <View style={styles.timerActions}>
            <View style={styles.timerBtn}>
              <Button testID="rest-skip-button" label="Salta" variant="secondary" onPress={cancelRest} />
            </View>
            <View style={styles.timerBtn}>
              <Button testID="rest-add-button" label="+30s" onPress={() => setRestLeft((n) => n + 30)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!historyFor} transparent animationType="slide" onRequestClose={() => setHistoryFor(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Storico</Text>
                <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 2, marginTop: 2, textTransform: "uppercase" }} numberOfLines={1}>
                  {historyFor?.exName}
                </Text>
              </View>
              <Pressable onPress={() => setHistoryFor(null)} hitSlop={8}>
                <LucideIcon name="x" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            <ScrollView>
              {historyLoading ? (
                <ActivityIndicator style={{ marginTop: 32 }} color={colors.brandPrimary} />
              ) : historyItems.length === 0 ? (
                <View style={{ padding: 32, alignItems: "center", gap: 8 }}>
                  <LucideIcon name="line-chart" size={28} color={colors.muted} />
                  <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", textAlign: "center" }}>
                    Nessuna sessione registrata{"\n"}per questo esercizio
                  </Text>
                </View>
              ) : (
                historyItems.map((h, i) => {
                  const prev = historyItems[i + 1];
                  const parseKg = (s: string) => {
                    const m = (s || "").match(/(-?\d+(?:[.,]\d+)?)/);
                    return m ? parseFloat(m[1].replace(",", ".")) : null;
                  };
                  const curKg = parseKg(h.weight);
                  const prevKg = prev ? parseKg(prev.weight) : null;
                  const delta = curKg !== null && prevKg !== null ? curKg - prevKg : null;
                  return (
                    <View key={h.id} style={styles.historyRow} testID={`client-history-item-${i}`}>
                      <Text style={styles.historyDate}>
                        {new Date(h.timestamp).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
                        <Text style={styles.historyWeight}>{h.weight || "—"}</Text>
                        {delta !== null && delta !== 0 ? (
                          <Text style={{
                            color: delta > 0 ? colors.success : colors.brandPrimary,
                            fontSize: 12, fontWeight: "800", letterSpacing: 1,
                          }}>
                            {delta > 0 ? "+" : ""}{Number.isInteger(delta) ? delta : delta.toFixed(1)} kg
                          </Text>
                        ) : null}
                        {h.reps ? (
                          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700", letterSpacing: 1 }}>
                            · {h.reps} reps
                          </Text>
                        ) : null}
                      </View>
                      {h.session_name ? <Text style={styles.historySession}>{h.session_name}</Text> : null}
                      {h.notes ? <Text style={styles.historyNote}>“{h.notes}”</Text> : null}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
