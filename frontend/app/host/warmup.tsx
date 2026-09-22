import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LucideIcon from "@react-native-vector-icons/lucide";

import { makeStyles, useTheme } from "@/src/theme";
import { Header } from "@/src/components/header";
import { Button } from "@/src/components/ui";
import { api, type ExerciseItem, type WarmupTemplate } from "@/src/api";
import { useUnsavedChangesWarning } from "@/src/hooks/useUnsavedChangesWarning";

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function newStretch(): ExerciseItem {
  return { id: uid(), name: "", sets: 1, reps: "30s", weight: "", rest_seconds: 0, notes: "" };
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  intro: {
    marginTop: 16, borderWidth: 2, borderColor: c.brandPrimary, backgroundColor: c.brandTertiary,
    padding: 12, flexDirection: "row", gap: 10,
  },
  introText: {
    color: c.onBrandTertiary, fontSize: 12, letterSpacing: 1, flex: 1, lineHeight: 16,
  },
  card: {
    borderWidth: 1, borderColor: c.border, padding: 10, backgroundColor: c.surfaceSecondary,
    marginTop: 10,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  nameInput: {
    flex: 1, color: c.onSurface, fontSize: 15, fontWeight: "700",
    borderBottomWidth: 1, borderBottomColor: c.border, paddingVertical: 6,
  },
  smallLabel: {
    color: c.muted, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", marginTop: 8, marginBottom: 2,
  },
  input: {
    borderWidth: 1, borderColor: c.border, paddingHorizontal: 8, paddingVertical: 6,
    color: c.onSurface, fontSize: 13, backgroundColor: c.surface,
  },
  smallRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  addBtn: {
    borderWidth: 2, borderColor: c.borderStrong, borderStyle: "dashed",
    padding: 14, marginTop: 12, alignItems: "center", gap: 4,
  },
  addBtnText: { color: c.onSurface, fontSize: 13, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" },
  footer: {
    paddingHorizontal: 20, paddingTop: 12, gap: 8,
    borderTopWidth: 2, borderTopColor: c.borderStrong, backgroundColor: c.surface,
  },
}));

export default function WarmupEditor() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const markDirty = () => setDirty(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get<WarmupTemplate>("/warmup");
        setExercises(r.data.exercises.length ? r.data.exercises : [newStretch()]);
      } catch { Alert.alert("Errore", "Impossibile caricare il riscaldamento"); }
      finally { setLoading(false); }
    })();
  }, []);

  const upd = (i: number, patch: Partial<ExerciseItem>) => {
    setExercises((xs) => xs.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
    markDirty();
  };
  const remove = (i: number) => { setExercises((xs) => xs.filter((_, idx) => idx !== i)); markDirty(); };
  const add = () => { setExercises((xs) => [...xs, newStretch()]); markDirty(); };

  const save = async () => {
    setSaving(true);
    try {
      const clean = exercises.filter((e) => e.name.trim());
      await api.put("/warmup", { exercises: clean });
      setDirty(false);
      unsaved.markSaved();
      router.back();
    } catch {
      Alert.alert("Errore", "Impossibile salvare");
    } finally { setSaving(false); }
  };

  const unsaved = useUnsavedChangesWarning(dirty, { onSave: async () => { await save(); } });

  if (loading) {
    return (
      <View style={styles.root}>
        <Header title="Riscaldamento" back />
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.brandPrimary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title="Riscaldamento" back subtitle="Sessione iniziale · applicata a tutti" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <LucideIcon name="info" size={14} color={colors.brandPrimary} />
          <Text style={styles.introText}>
            Ogni modifica qui viene applicata automaticamente al riscaldamento di tutti i clienti.
          </Text>
        </View>

        {exercises.map((ex, i) => (
          <View key={ex.id} style={styles.card}>
            <View style={styles.topRow}>
              <LucideIcon name="flame" size={16} color={colors.brandPrimary} />
              <TextInput
                testID={`warmup-name-${i}`}
                value={ex.name}
                onChangeText={(v) => upd(i, { name: v })}
                placeholder="Nome esercizio"
                placeholderTextColor={colors.muted}
                style={styles.nameInput}
              />
              <Pressable onPress={() => remove(i)} hitSlop={8} testID={`warmup-remove-${i}`} style={{ padding: 4 }}>
                <LucideIcon name="trash-2" size={16} color={colors.onSurface} />
              </Pressable>
            </View>
            <View style={styles.smallRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.smallLabel}>Durata / Reps</Text>
                <TextInput
                  value={ex.reps}
                  onChangeText={(v) => upd(i, { reps: v })}
                  placeholder="30s"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.smallLabel}>Ripetizioni</Text>
                <TextInput
                  value={String(ex.sets)}
                  onChangeText={(v) => upd(i, { sets: Math.max(1, parseInt(v || "1", 10) || 1) })}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </View>
            </View>
            <Text style={styles.smallLabel}>Descrizione / Istruzioni</Text>
            <TextInput
              value={ex.notes}
              onChangeText={(v) => upd(i, { notes: v })}
              placeholder="Come eseguire l'esercizio"
              placeholderTextColor={colors.muted}
              style={[styles.input, { minHeight: 44 }]}
              multiline
            />
          </View>
        ))}

        <Pressable testID="warmup-add-exercise" onPress={add} style={styles.addBtn}>
          <LucideIcon name="plus" size={20} color={colors.brandPrimary} />
          <Text style={styles.addBtnText}>Aggiungi esercizio</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button testID="warmup-save" label="Salva Riscaldamento" onPress={save} loading={saving} />
      </View>
    </KeyboardAvoidingView>
  );
}
