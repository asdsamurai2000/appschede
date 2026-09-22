import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LucideIcon from "@react-native-vector-icons/lucide";

import { makeStyles, useTheme } from "@/src/theme";
import { Header } from "@/src/components/header";
import { Button } from "@/src/components/ui";
import { api, type LibraryExercise } from "@/src/api";
import { useIsHost } from "@/src/state";

const MUSCLE_GROUPS = ["PETTO", "DORSO", "SPALLE", "BICIPITI", "TRICIPITI", "ADDOME", "GAMBE", "CORPO LIBERO"] as const;
type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  groupCard: {
    borderWidth: 2, borderColor: c.borderStrong, marginTop: -2, backgroundColor: c.surface,
  },
  groupHeader: {
    padding: 14, flexDirection: "row", alignItems: "center", gap: 10,
  },
  groupHeaderActive: {
    borderBottomWidth: 2, borderBottomColor: c.borderStrong, backgroundColor: c.surfaceSecondary,
  },
  groupTitle: {
    color: c.onSurface, fontSize: 15, fontWeight: "800", letterSpacing: 2,
    textTransform: "uppercase", flex: 1,
  },
  groupCount: {
    color: c.brandPrimary, fontWeight: "800", fontSize: 12, letterSpacing: 2,
  },
  emptyGroup: {
    padding: 14, borderTopWidth: 2, borderTopColor: c.borderStrong, backgroundColor: c.surfaceSecondary,
  },
  emptyGroupText: {
    color: c.muted, fontSize: 12, letterSpacing: 1, textAlign: "center",
  },
  item: {
    padding: 14, borderTopWidth: 1, borderTopColor: c.divider, flexDirection: "row", alignItems: "flex-start", gap: 10,
  },
  itemBody: { flex: 1 },
  itemName: { color: c.onSurface, fontWeight: "700", fontSize: 15 },
  itemDesc: { color: c.muted, fontSize: 12, marginTop: 4, lineHeight: 16 },
  addBox: {
    borderWidth: 2, borderColor: c.borderStrong, borderStyle: "dashed",
    padding: 12, gap: 8, marginTop: 20,
  },
  addTitle: {
    color: c.onSurface, fontWeight: "800", letterSpacing: 2,
    textTransform: "uppercase", fontSize: 12,
  },
  input: {
    borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 8,
    color: c.onSurface, fontSize: 14, backgroundColor: c.surface,
  },
  categoryChipsRow: {
    flexDirection: "row", flexWrap: "wrap", gap: 6,
  },
  categoryChip: {
    borderWidth: 2, borderColor: c.borderStrong, paddingHorizontal: 10, paddingVertical: 6,
  },
  categoryChipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  categoryChipText: {
    color: c.onSurface, fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase",
  },
  categoryChipTextActive: { color: c.onBrandPrimary },
  headerLabel: { color: c.muted, fontSize: 11, letterSpacing: 3, textTransform: "uppercase", marginTop: 20, marginBottom: 8 },
}));

export default function Library() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isHost = useIsHost();

  const [items, setItems] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup>("PETTO");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Record<MuscleGroup, boolean>>(() =>
    Object.fromEntries(MUSCLE_GROUPS.map((g, i) => [g, i === 0])) as Record<MuscleGroup, boolean>,
  );

  const load = async () => {
    const r = await api.get<LibraryExercise[]>("/exercises");
    setItems(r.data);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const map: Record<string, LibraryExercise[]> = {};
    for (const g of MUSCLE_GROUPS) map[g] = [];
    for (const it of items) {
      const key = (MUSCLE_GROUPS as readonly string[]).includes(it.muscle_group)
        ? it.muscle_group
        : "CORPO LIBERO";
      map[key].push(it);
    }
    for (const g of MUSCLE_GROUPS) map[g].sort((a, b) => a.name.localeCompare(b.name, "it"));
    return map;
  }, [items]);

  const toggle = (g: MuscleGroup) => setExpanded((e) => ({ ...e, [g]: !e[g] }));

  const add = async () => {
    if (!name.trim()) { Alert.alert("Dati mancanti", "Nome esercizio"); return; }
    setSaving(true);
    try {
      await api.post("/exercises", { name: name.trim(), muscle_group: muscle, description: desc.trim() });
      setName(""); setDesc("");
      setExpanded((e) => ({ ...e, [muscle]: true }));
      await load();
    } finally { setSaving(false); }
  };

  const del = (id: string) => {
    Alert.alert("Elimina esercizio?", "", [
      { text: "Annulla", style: "cancel" },
      { text: "Elimina", style: "destructive", onPress: async () => { await api.delete(`/exercises/${id}`); await load(); } },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title="Libreria" subtitle={`${items.length} esercizi · ${MUSCLE_GROUPS.length} gruppi`} back />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={colors.brandPrimary} />
        ) : (
          <>
            <Text style={styles.headerLabel}>Gruppi Muscolari</Text>
            {MUSCLE_GROUPS.map((g) => {
              const list = grouped[g];
              const open = expanded[g];
              return (
                <View key={g} style={styles.groupCard}>
                  <Pressable
                    testID={`group-toggle-${g}`}
                    onPress={() => toggle(g)}
                    style={[styles.groupHeader, open ? styles.groupHeaderActive : null]}
                  >
                    <LucideIcon name="dumbbell" size={16} color={colors.brandPrimary} />
                    <Text style={styles.groupTitle}>{g}</Text>
                    <Text style={styles.groupCount}>{list.length}</Text>
                    <LucideIcon name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.onSurface} />
                  </Pressable>
                  {open ? (
                    list.length === 0 ? (
                      <View style={styles.emptyGroup}>
                        <Text style={styles.emptyGroupText}>Nessun esercizio in questo gruppo</Text>
                      </View>
                    ) : (
                      list.map((it) => (
                        <View key={it.id} style={styles.item} testID={`library-exercise-${it.id}`}>
                          <View style={styles.itemBody}>
                            <Text style={styles.itemName}>{it.name}</Text>
                            {it.description ? <Text style={styles.itemDesc}>{it.description}</Text> : null}
                          </View>
                          {isHost ? (
                            <Pressable onPress={() => del(it.id)} hitSlop={8} style={{ padding: 4 }} testID={`library-delete-${it.id}`}>
                              <LucideIcon name="trash-2" size={18} color={colors.onSurface} />
                            </Pressable>
                          ) : null}
                        </View>
                      ))
                    )
                  ) : null}
                </View>
              );
            })}

            {isHost ? (
              <View style={styles.addBox}>
                <Text style={styles.addTitle}>Aggiungi Esercizio</Text>
                <TextInput testID="lib-name-input" value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor={colors.muted} style={styles.input} />
                <Text style={{ color: colors.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginTop: 4 }}>Gruppo</Text>
                <View style={styles.categoryChipsRow}>
                  {MUSCLE_GROUPS.map((g) => {
                    const active = muscle === g;
                    return (
                      <Pressable
                        key={g}
                        testID={`lib-group-${g}`}
                        onPress={() => setMuscle(g)}
                        style={[styles.categoryChip, active ? styles.categoryChipActive : null]}
                      >
                        <Text style={[styles.categoryChipText, active ? styles.categoryChipTextActive : null]}>
                          {g}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <TextInput testID="lib-desc-input" value={desc} onChangeText={setDesc} placeholder="Descrizione" placeholderTextColor={colors.muted} style={[styles.input, { minHeight: 60 }]} multiline />
                <Button testID="lib-add-btn" label="Aggiungi" onPress={add} loading={saving} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
