import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LucideIcon from "@react-native-vector-icons/lucide";

import { makeStyles, useTheme } from "@/src/theme";
import { Header } from "@/src/components/header";
import { Button } from "@/src/components/ui";
import { api, type LibraryExercise } from "@/src/api";
import { useIsHost } from "@/src/state";

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  card: {
    borderWidth: 2, borderColor: c.borderStrong, padding: 14, marginTop: -2, backgroundColor: c.surface,
  },
  name: { color: c.onSurface, fontSize: 15, fontWeight: "800", letterSpacing: 0.5 },
  muscle: { color: c.brandPrimary, fontSize: 10, letterSpacing: 3, marginTop: 4, textTransform: "uppercase" },
  desc: { color: c.muted, fontSize: 12, marginTop: 6, lineHeight: 18 },
  addBox: {
    borderWidth: 2, borderColor: c.borderStrong, borderStyle: "dashed", padding: 12, gap: 8, marginTop: 12,
  },
  input: {
    borderWidth: 1, borderColor: c.border, paddingHorizontal: 10, paddingVertical: 8, color: c.onSurface, fontSize: 14, backgroundColor: c.surface,
  },
  headerLabel: { color: c.muted, fontSize: 11, letterSpacing: 3, textTransform: "uppercase", marginTop: 20, marginBottom: 12 },
}));

export default function Library() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isHost = useIsHost();

  const [items, setItems] = useState<LibraryExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(""); const [muscle, setMuscle] = useState(""); const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => { const r = await api.get<LibraryExercise[]>("/exercises"); setItems(r.data); setLoading(false); };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim() || !muscle.trim()) { Alert.alert("Dati mancanti", "Nome e gruppo muscolare"); return; }
    setSaving(true);
    try {
      await api.post("/exercises", { name: name.trim(), muscle_group: muscle.trim(), description: desc.trim() });
      setName(""); setMuscle(""); setDesc(""); await load();
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
      <Header title="Libreria" subtitle={`${items.length} esercizi`} back />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={colors.brandPrimary} />
        ) : (
          <>
            <Text style={styles.headerLabel}>Esercizi</Text>
            {items.map((it) => (
              <View key={it.id} style={styles.card}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{it.name}</Text>
                    <Text style={styles.muscle}>{it.muscle_group}</Text>
                  </View>
                  {isHost ? (
                    <Pressable onPress={() => del(it.id)} hitSlop={8} style={{ padding: 4 }} testID={`library-delete-${it.id}`}>
                      <LucideIcon name="trash-2" size={18} color={colors.onSurface} />
                    </Pressable>
                  ) : null}
                </View>
                {it.description ? <Text style={styles.desc}>{it.description}</Text> : null}
              </View>
            ))}
            {isHost ? (
              <View style={styles.addBox}>
                <Text style={{ color: colors.onSurface, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", fontSize: 12 }}>Aggiungi Esercizio</Text>
                <TextInput testID="lib-name-input" value={name} onChangeText={setName} placeholder="Nome" placeholderTextColor={colors.muted} style={styles.input} />
                <TextInput testID="lib-muscle-input" value={muscle} onChangeText={setMuscle} placeholder="Gruppo muscolare" placeholderTextColor={colors.muted} style={styles.input} />
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
