import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LucideIcon from "@react-native-vector-icons/lucide";

import { makeStyles, useTheme } from "@/src/theme";
import { Header } from "@/src/components/header";
import { Button } from "@/src/components/ui";
import { api, type Scheda, type SessionItem, type ExerciseItem, type LibraryExercise, type ClientState, type ClientStateHistory, isPaidThisMonth } from "@/src/api";
import { useUnsavedChangesWarning } from "@/src/hooks/useUnsavedChangesWarning";

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  label: { color: c.muted, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", marginTop: 20, marginBottom: 6 },
  input: {
    borderWidth: 2, borderColor: c.borderStrong, backgroundColor: c.surface,
    color: c.onSurface, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, fontWeight: "600",
  },
  sessionCard: {
    borderWidth: 2, borderColor: c.borderStrong, marginTop: 12, backgroundColor: c.surface,
  },
  sessionHeader: {
    flexDirection: "row", alignItems: "center", padding: 12, gap: 8,
    borderBottomWidth: 2, borderBottomColor: c.borderStrong, backgroundColor: c.surfaceSecondary,
  },
  sessionTitleInput: {
    flex: 1, color: c.onSurface, fontSize: 16, fontWeight: "800",
    letterSpacing: 1, textTransform: "uppercase",
  },
  sessionBody: { padding: 12, gap: 10 },
  exerciseRow: {
    borderWidth: 1, borderColor: c.border, padding: 10, backgroundColor: c.surfaceSecondary,
  },
  exTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  exName: {
    flex: 1, color: c.onSurface, fontSize: 15, fontWeight: "700",
    borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: 6,
  },
  exSmallRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  exSmallInput: {
    flex: 1, borderWidth: 1, borderColor: c.border, paddingHorizontal: 8, paddingVertical: 6,
    color: c.onSurface, fontSize: 13, fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
  exSmallLabel: { color: c.muted, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 },
  smallBtn: {
    borderWidth: 2, borderColor: c.borderStrong, paddingHorizontal: 10, paddingVertical: 6,
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  smallBtnText: {
    color: c.onSurface, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase",
  },
  sessionActions: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  addSessionBtn: {
    borderWidth: 2, borderColor: c.borderStrong, borderStyle: "dashed",
    padding: 16, marginTop: 12, alignItems: "center", gap: 4,
  },
  addSessionText: { color: c.onSurface, fontSize: 13, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 8, borderTopWidth: 2, borderTopColor: c.borderStrong, backgroundColor: c.surface },
  codeBanner: {
    marginTop: 16, borderWidth: 2, borderColor: c.brandPrimary, padding: 16, backgroundColor: c.brandTertiary,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  codeBannerText: { color: c.onBrandTertiary, fontWeight: "800", letterSpacing: 4, fontSize: 26 },
  // modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: c.surface, borderTopWidth: 2, borderTopColor: c.borderStrong, maxHeight: "80%" },
  modalHeader: { padding: 16, borderBottomWidth: 2, borderBottomColor: c.borderStrong, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { color: c.onSurface, fontWeight: "800", fontSize: 16, letterSpacing: 2, textTransform: "uppercase" },
  libItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: c.divider },
  libName: { color: c.onSurface, fontWeight: "700", fontSize: 15 },
  libMuscle: { color: c.brandPrimary, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginTop: 2 },
  libDesc: { color: c.muted, fontSize: 12, marginTop: 4 },
  // Client feedback block (visible to host inside each exercise)
  feedbackBox: {
    marginTop: 8, borderWidth: 2, borderColor: c.brandPrimary,
    backgroundColor: c.brandTertiary, padding: 8, gap: 4,
  },
  feedbackHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  feedbackTitle: {
    color: c.onBrandTertiary, flex: 1, fontSize: 11, fontWeight: "800",
    letterSpacing: 2, textTransform: "uppercase",
  },
  feedbackDate: {
    color: c.onBrandTertiary, fontSize: 10, letterSpacing: 1, textTransform: "uppercase",
  },
  feedbackLabel: { color: c.onBrandTertiary, fontWeight: "800", fontSize: 12 },
  feedbackLine: { color: c.onBrandTertiary, fontSize: 12, lineHeight: 16 },
  historyBtn: {
    marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-start", paddingVertical: 4,
  },
  historyBtnText: {
    color: c.brandPrimary, fontSize: 11, fontWeight: "800",
    letterSpacing: 2, textTransform: "uppercase",
  },
  historyBtnGhost: {
    marginTop: 6, flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-start", paddingVertical: 4,
  },
  historyBtnGhostText: {
    color: c.muted, fontSize: 11, fontWeight: "700",
    letterSpacing: 2, textTransform: "uppercase",
  },
  historyRow: { padding: 14, borderBottomWidth: 1, borderBottomColor: c.divider },
  historyDate: {
    color: c.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase",
  },
  historyWeight: { color: c.onSurface, fontWeight: "800", fontSize: 22, marginTop: 4, letterSpacing: -0.5 },
  historySession: { color: c.brandPrimary, fontSize: 11, letterSpacing: 2, marginTop: 2, textTransform: "uppercase" },
  historyNote: { color: c.onSurfaceSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
  paidRow: {
    marginTop: 20, borderWidth: 2, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  paidRowTitle: {
    fontSize: 14, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase",
  },
  paidRowSub: {
    fontSize: 10, letterSpacing: 1, marginTop: 2, textTransform: "uppercase",
  },
  ingressiRow: {
    marginTop: -2, borderWidth: 2, borderColor: c.borderStrong,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: c.surface,
  },
  ingressiTitle: {
    color: c.onSurface, fontSize: 14, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase",
  },
  ingressiSub: {
    color: c.muted, fontSize: 10, letterSpacing: 1, marginTop: 2, textTransform: "uppercase",
  },
}));

function newExercise(name = ""): ExerciseItem {
  return { id: uid(), name, sets: 3, reps: "10", weight: "", rest_seconds: 60, notes: "" };
}
function newSession(name: string): SessionItem {
  return { id: uid(), name, exercises: [newExercise()] };
}

export default function SchedaEditor() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";

  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [sessions, setSessions] = useState<SessionItem[]>([newSession("Giorno A")]);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [pickerFor, setPickerFor] = useState<{ sIdx: number; eIdx: number } | null>(null);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [clientState, setClientState] = useState<Record<string, ClientState>>({});
  const [historyFor, setHistoryFor] = useState<{ exId: string; exName: string } | null>(null);
  const [historyItems, setHistoryItems] = useState<ClientStateHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [paidMonth, setPaidMonth] = useState<string | null>(null);
  const [togglingPaid, setTogglingPaid] = useState(false);
  const [dirty, setDirty] = useState(false);

  const markDirty = () => setDirty(true);

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

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const r = await api.get<Scheda>(`/schede/${id}`);
        setName(r.data.name);
        setClientName(r.data.client_name);
        setCode(r.data.code);
        setPaidMonth(r.data.paid_month ?? null);
        const cs = await api.get<ClientState[]>(`/schede/${id}/client-state`).catch(() => ({ data: [] as ClientState[] }));
        const map: Record<string, ClientState> = {};
        cs.data.forEach((c) => { map[c.exercise_id] = c; });
        setClientState(map);
        // Merge client's current weight into sessions so the host input reflects it.
        const parseNum = (s: string) => {
          const m = (s || "").match(/(-?\d+(?:[.,]\d+)?)/);
          return m ? m[1].replace(",", ".") : "";
        };
        const merged = r.data.sessions.length ? r.data.sessions.map((s) => ({
          ...s,
          exercises: s.exercises.map((ex) => {
            const clientWeight = map[ex.id]?.weight;
            return { ...ex, weight: clientWeight ? parseNum(clientWeight) : parseNum(ex.weight) };
          }),
        })) : [newSession("Giorno A")];
        setSessions(merged);
      } catch {
        Alert.alert("Errore", "Impossibile caricare la scheda");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew, router]);

  useEffect(() => { api.get<LibraryExercise[]>("/exercises").then((r) => setLibrary(r.data)).catch(() => {}); }, []);

  const addSession = () => {
    if (sessions.length >= 5) return;
    const letters = ["A", "B", "C", "D", "E"];
    setSessions((s) => [...s, newSession(`Giorno ${letters[s.length]}`)]);
    markDirty();
  };
  const removeSession = (idx: number) => {
    if (sessions.length <= 1) return;
    setSessions((s) => s.filter((_, i) => i !== idx));
    markDirty();
  };
  const updateSession = (idx: number, patch: Partial<SessionItem>) => {
    setSessions((s) => s.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
    markDirty();
  };
  const addExercise = (sIdx: number, name = "") =>
    updateSession(sIdx, { exercises: [...sessions[sIdx].exercises, newExercise(name)] });
  const removeExercise = (sIdx: number, eIdx: number) =>
    updateSession(sIdx, { exercises: sessions[sIdx].exercises.filter((_, i) => i !== eIdx) });
  const updateExercise = (sIdx: number, eIdx: number, patch: Partial<ExerciseItem>) =>
    updateSession(sIdx, {
      exercises: sessions[sIdx].exercises.map((x, i) => (i === eIdx ? { ...x, ...patch } : x)),
    });

  const togglePaid = async () => {
    if (!code) return;
    const nextPaid = !isPaidThisMonth(paidMonth);
    setTogglingPaid(true);
    try {
      const r = await api.put<Scheda>(`/schede/${code}/paid`, { paid: nextPaid });
      setPaidMonth(r.data.paid_month ?? null);
    } catch {
      Alert.alert("Errore", "Impossibile aggiornare lo stato pagamento");
    } finally {
      setTogglingPaid(false);
    }
  };

  const unsaved = useUnsavedChangesWarning(dirty && !isNew, { onSave: async () => { await save(); } });

  const save = async () => {
    if (!name.trim() || !clientName.trim()) {
      Alert.alert("Dati mancanti", "Nome scheda e nome cliente sono obbligatori");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const r = await api.post<Scheda>("/schede", {
          name: name.trim(), client_name: clientName.trim(), sessions,
        });
        setCode(r.data.code);
      } else {
        await api.put<Scheda>(`/schede/${id}`, { name: name.trim(), client_name: clientName.trim(), sessions });
        // Realign client-state weight to the values the host just prescribed
        // so on the next session the client sees the updated weight.
        const targetCode = code || (typeof id === "string" ? id : "");
        if (targetCode) {
          await Promise.all(sessions.flatMap((s) => s.exercises.map(async (ex) => {
            const existing = clientState[ex.id];
            if (existing && existing.weight !== ex.weight) {
              try {
                await api.put(`/schede/${targetCode}/client-state/${ex.id}`, {
                  notes: existing.notes || "",
                  weight: ex.weight || "",
                });
              } catch {}
            }
          })));
        }
        setDirty(false);
        unsaved.markSaved();
        router.back();
      }
    } catch {
      Alert.alert("Errore", "Impossibile salvare la scheda");
    } finally {
      setSaving(false);
    }
  };

  const del = () => {
    if (isNew || !code) return;
    Alert.alert("Elimina scheda", "L'operazione è irreversibile. Continuare?", [
      { text: "Annulla", style: "cancel" },
      { text: "Elimina", style: "destructive", onPress: async () => {
        try { await api.delete(`/schede/${code}`); router.back(); } catch { Alert.alert("Errore", "Impossibile eliminare"); }
      } },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title="Scheda" back />
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.brandPrimary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header
        title={isNew ? "Nuova Scheda" : "Modifica"}
        back
        subtitle={code ? `Codice ${code}` : undefined}
        right={!isNew ? (
          <Pressable testID="delete-scheda-button" onPress={del} style={{ padding: 8 }} hitSlop={8}>
            <LucideIcon name="trash-2" size={20} color={colors.brandPrimary} />
          </Pressable>
        ) : undefined}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {code && isNew ? (
          <View style={styles.codeBanner}>
            <LucideIcon name="check-circle" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.onBrandTertiary, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>Codice cliente</Text>
              <Text style={styles.codeBannerText}>{code}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.label}>Nome Cliente</Text>
        <TextInput
          testID="input-client-name"
          value={clientName}
          onChangeText={(v) => { setClientName(v); markDirty(); }}
          placeholder="Es. Marco Rossi"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        <Text style={styles.label}>Nome Scheda</Text>
        <TextInput
          testID="input-scheda-name"
          value={name}
          onChangeText={(v) => { setName(v); markDirty(); }}
          placeholder="Es. Ipertrofia Mese 1"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />

        {!isNew ? (() => {
          const paid = isPaidThisMonth(paidMonth);
          return (
            <>
              <Pressable
                testID="toggle-paid-button"
                onPress={togglePaid}
                disabled={togglingPaid}
                style={[styles.paidRow, { backgroundColor: paid ? colors.success : colors.brandTertiary, borderColor: paid ? colors.success : colors.brandPrimary }]}
              >
                <LucideIcon name="flag" size={18} color={paid ? colors.onSuccess : colors.brandPrimary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.paidRowTitle, { color: paid ? colors.onSuccess : colors.onBrandTertiary }]}>
                    {paid ? "Mensile pagato" : "Mensile da pagare"}
                  </Text>
                  <Text style={[styles.paidRowSub, { color: paid ? colors.onSuccess : colors.onBrandTertiary }]}>
                    {paid ? "Tocca per revocare il pagamento" : "Tocca per registrare il pagamento del mese"}
                  </Text>
                </View>
                {togglingPaid ? (
                  <ActivityIndicator color={paid ? colors.onSuccess : colors.brandPrimary} />
                ) : (
                  <LucideIcon name={paid ? "check-circle" : "circle"} size={20} color={paid ? colors.onSuccess : colors.brandPrimary} />
                )}
              </Pressable>
              <Pressable
                testID="open-ingressi-button"
                onPress={() => code && router.push({ pathname: "/host/ingressi/[code]", params: { code } })}
                style={styles.ingressiRow}
              >
                <LucideIcon name="calendar-check" size={18} color={colors.onSurface} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ingressiTitle}>Ingressi</Text>
                  <Text style={styles.ingressiSub}>Statistiche e storico presenze</Text>
                </View>
                <LucideIcon name="chevron-right" size={20} color={colors.onSurface} />
              </Pressable>
            </>
          );
        })() : null}

        <Text style={styles.label}>Sessioni ({sessions.length}/5)</Text>
        {sessions.map((s, sIdx) => (
          <View key={s.id} style={styles.sessionCard}>
            <View style={styles.sessionHeader}>
              <LucideIcon name="dumbbell" size={18} color={colors.brandPrimary} />
              <TextInput
                testID={`session-name-input-${sIdx}`}
                value={s.name}
                onChangeText={(v) => updateSession(sIdx, { name: v })}
                style={styles.sessionTitleInput}
                placeholder="Nome sessione"
                placeholderTextColor={colors.muted}
              />
              {sessions.length > 1 ? (
                <Pressable testID={`remove-session-${sIdx}`} onPress={() => removeSession(sIdx)} hitSlop={8}>
                  <LucideIcon name="x" size={20} color={colors.onSurface} />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.sessionBody}>
              {s.exercises.map((ex, eIdx) => (
                <View key={ex.id} style={styles.exerciseRow}>
                  <View style={styles.exTopRow}>
                    <TextInput
                      testID={`exercise-name-${sIdx}-${eIdx}`}
                      value={ex.name}
                      onChangeText={(v) => updateExercise(sIdx, eIdx, { name: v })}
                      placeholder="Nome esercizio"
                      placeholderTextColor={colors.muted}
                      style={styles.exName}
                    />
                    <Pressable
                      testID={`pick-exercise-${sIdx}-${eIdx}`}
                      onPress={() => setPickerFor({ sIdx, eIdx })}
                      hitSlop={6}
                      style={{ padding: 4 }}
                    >
                      <LucideIcon name="library" size={18} color={colors.brandPrimary} />
                    </Pressable>
                    <Pressable onPress={() => removeExercise(sIdx, eIdx)} hitSlop={6} style={{ padding: 4 }}>
                      <LucideIcon name="trash-2" size={16} color={colors.onSurface} />
                    </Pressable>
                  </View>
                  <View style={styles.exSmallRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exSmallLabel}>Serie</Text>
                      <TextInput
                        value={String(ex.sets)}
                        onChangeText={(v) => updateExercise(sIdx, eIdx, { sets: Math.max(1, parseInt(v || "0", 10) || 0) })}
                        keyboardType="number-pad"
                        style={styles.exSmallInput}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exSmallLabel}>Reps</Text>
                      <TextInput
                        value={ex.reps}
                        onChangeText={(v) => updateExercise(sIdx, eIdx, { reps: v })}
                        style={styles.exSmallInput}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exSmallLabel}>Peso (kg)</Text>
                      <TextInput
                        value={ex.weight}
                        onChangeText={(v) => updateExercise(sIdx, eIdx, { weight: v.replace(/[^0-9.,]/g, "").replace(",", ".") })}
                        placeholder="—"
                        placeholderTextColor={colors.muted}
                        keyboardType="numeric"
                        style={styles.exSmallInput}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exSmallLabel}>Rec (s)</Text>
                      <TextInput
                        value={String(ex.rest_seconds)}
                        onChangeText={(v) => updateExercise(sIdx, eIdx, { rest_seconds: Math.max(0, parseInt(v || "0", 10) || 0) })}
                        keyboardType="number-pad"
                        style={styles.exSmallInput}
                      />
                    </View>
                  </View>
                  <Text style={styles.exSmallLabel}>Note</Text>
                  <TextInput
                    value={ex.notes}
                    onChangeText={(v) => updateExercise(sIdx, eIdx, { notes: v })}
                    placeholder="Es. tempo lento in eccentrica"
                    placeholderTextColor={colors.muted}
                    style={[styles.exSmallInput, { flex: undefined, marginTop: 2 }]}
                  />
                  {clientState[ex.id] && (clientState[ex.id].notes || clientState[ex.id].weight) ? (
                    <View style={styles.feedbackBox} testID={`client-feedback-${ex.id}`}>
                      <View style={styles.feedbackHeader}>
                        <LucideIcon name="message-circle" size={12} color={colors.brandPrimary} />
                        <Text style={styles.feedbackTitle}>Feedback cliente</Text>
                        <Text style={styles.feedbackDate}>
                          {new Date(clientState[ex.id].updated_at).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                        </Text>
                      </View>
                      {clientState[ex.id].weight && clientState[ex.id].weight !== ex.weight ? (
                        <Text style={styles.feedbackLine}>
                          <Text style={styles.feedbackLabel}>Peso attuale: </Text>
                          {clientState[ex.id].weight}
                        </Text>
                      ) : null}
                      {clientState[ex.id].notes ? (
                        <Text style={styles.feedbackLine}>
                          <Text style={styles.feedbackLabel}>Note: </Text>
                          {clientState[ex.id].notes}
                        </Text>
                      ) : null}
                      <Pressable
                        testID={`open-history-${ex.id}`}
                        onPress={() => openHistory(ex.id, ex.name || "Esercizio")}
                        style={styles.historyBtn}
                        hitSlop={6}
                      >
                        <LucideIcon name="line-chart" size={12} color={colors.brandPrimary} />
                        <Text style={styles.historyBtnText}>Storico progressione</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      testID={`open-history-empty-${ex.id}`}
                      onPress={() => openHistory(ex.id, ex.name || "Esercizio")}
                      style={styles.historyBtnGhost}
                      hitSlop={6}
                    >
                      <LucideIcon name="line-chart" size={12} color={colors.muted} />
                      <Text style={styles.historyBtnGhostText}>Storico progressione</Text>
                    </Pressable>
                  )}
                </View>
              ))}
              <View style={styles.sessionActions}>
                <Pressable
                  testID={`add-exercise-${sIdx}`}
                  onPress={() => addExercise(sIdx)}
                  style={styles.smallBtn}
                >
                  <LucideIcon name="plus" size={14} color={colors.onSurface} />
                  <Text style={styles.smallBtnText}>Esercizio</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        {sessions.length < 5 ? (
          <Pressable testID="add-session-button" onPress={addSession} style={styles.addSessionBtn}>
            <LucideIcon name="plus" size={22} color={colors.brandPrimary} />
            <Text style={styles.addSessionText}>Aggiungi Sessione</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button
          testID="save-scheda-button"
          label={isNew ? (code ? "Chiudi" : "Genera Scheda") : "Salva Modifiche"}
          onPress={code && isNew ? () => router.back() : save}
          loading={saving}
        />
      </View>

      <Modal visible={!!pickerFor} transparent animationType="slide" onRequestClose={() => setPickerFor(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Libreria Esercizi</Text>
              <Pressable onPress={() => setPickerFor(null)} hitSlop={8}>
                <LucideIcon name="x" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            <ScrollView>
              {library.map((it) => (
                <Pressable
                  key={it.id}
                  testID={`library-pick-${it.id}`}
                  style={styles.libItem}
                  onPress={() => {
                    if (pickerFor) updateExercise(pickerFor.sIdx, pickerFor.eIdx, { name: it.name });
                    setPickerFor(null);
                  }}
                >
                  <Text style={styles.libName}>{it.name}</Text>
                  <Text style={styles.libMuscle}>{it.muscle_group}</Text>
                  <Text style={styles.libDesc} numberOfLines={2}>{it.description}</Text>
                </Pressable>
              ))}
            </ScrollView>
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
                    <View key={h.id} style={styles.historyRow} testID={`history-item-${i}`}>
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
    </KeyboardAvoidingView>
  );
}
