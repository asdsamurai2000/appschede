import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import LucideIcon from "@react-native-vector-icons/lucide";

import { makeStyles, useTheme } from "@/src/theme";
import { Header } from "@/src/components/header";
import { api, type Scheda } from "@/src/api";

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  helper: {
    borderWidth: 1, borderColor: c.border, padding: 12, marginTop: 16,
    flexDirection: "row", gap: 10, alignItems: "flex-start",
  },
  helperText: { color: c.muted, fontSize: 11, letterSpacing: 1, flex: 1, lineHeight: 16 },
  sectionLabel: {
    color: c.muted, fontSize: 11, letterSpacing: 3, textTransform: "uppercase",
    marginTop: 20, marginBottom: 12,
  },
  card: {
    borderWidth: 2, borderColor: c.borderStrong, marginBottom: -2, padding: 16,
    backgroundColor: c.surface,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clientName: { color: c.onSurface, fontSize: 18, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  schedaName: { color: c.muted, fontSize: 12, letterSpacing: 1, marginTop: 4, textTransform: "uppercase" },
  codePill: { backgroundColor: c.surfaceSecondary, borderWidth: 2, borderColor: c.borderStrong, paddingHorizontal: 10, paddingVertical: 6 },
  codeText: { color: c.onSurface, fontWeight: "800", letterSpacing: 2, fontSize: 13 },
  metaRow: { flexDirection: "row", gap: 12, marginTop: 12, alignItems: "center", flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { color: c.muted, fontSize: 11, letterSpacing: 1 },
  actionsRow: { flexDirection: "row", gap: -2, marginTop: 14 },
  actionBtn: {
    flex: 1, borderWidth: 2, borderColor: c.borderStrong, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  restoreBtn: { backgroundColor: c.success },
  restoreText: { color: c.onSuccess, fontSize: 12, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" },
  deleteBtn: { backgroundColor: c.brandPrimary },
  deleteText: { color: c.onBrandPrimary, fontSize: 12, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" },
  emptyBox: {
    borderWidth: 2, borderColor: c.borderStrong, padding: 24, marginTop: 24, alignItems: "center", gap: 8,
  },
  emptyTitle: { color: c.onSurface, fontSize: 18, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  emptyBody: { color: c.muted, fontSize: 12, letterSpacing: 1, textAlign: "center" },
}));

function formatArchivedAt(iso?: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return "—"; }
}

export default function HostArchive() {
  const styles = useStyles();
  const { colors } = useTheme();

  const [items, setItems] = useState<Scheda[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.get<Scheda[]>("/schede", { params: { archived: "true" } });
      setItems(r.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const restore = (item: Scheda) => {
    Alert.alert(
      "Ripristina scheda",
      `Vuoi rendere di nuovo attiva la scheda di ${item.client_name}?`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Ripristina",
          onPress: async () => {
            setBusy(item.code);
            try {
              await api.put(`/schede/${item.code}/archive`, { archived: false });
              setItems((prev) => prev.filter((x) => x.code !== item.code));
            } catch {
              Alert.alert("Errore", "Impossibile ripristinare la scheda. Riprova.");
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const remove = (item: Scheda) => {
    Alert.alert(
      "Eliminare definitivamente?",
      `La scheda di ${item.client_name} e tutti i suoi check-in verranno eliminati per sempre. Questa azione è irreversibile.`,
      [
        { text: "Annulla", style: "cancel" },
        {
          text: "Elimina",
          style: "destructive",
          onPress: async () => {
            setBusy(item.code);
            try {
              await api.delete(`/schede/${item.code}`);
              setItems((prev) => prev.filter((x) => x.code !== item.code));
            } catch {
              Alert.alert("Errore", "Impossibile eliminare la scheda. Riprova.");
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <Header
        title="Archivio"
        subtitle="Schede inattive"
        back
      />
      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.brandPrimary}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.helper}>
              <LucideIcon name="info" size={14} color={colors.muted} />
              <Text style={styles.helperText}>
                Le schede senza check-in da 60+ giorni vengono archiviate in automatico. Il cliente col codice non le vede più. Puoi ripristinarle o eliminarle definitivamente.
              </Text>
            </View>
            {items.length > 0 ? (
              <Text style={styles.sectionLabel}>
                {items.length} {items.length === 1 ? "scheda" : "schede"}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const isBusy = busy === item.code;
          return (
            <View style={styles.card} testID={`archived-card-${item.code}`}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientName} numberOfLines={1}>{item.client_name}</Text>
                  <Text style={styles.schedaName} numberOfLines={1}>{item.name}</Text>
                </View>
                <View style={styles.codePill}>
                  <Text style={styles.codeText}>{item.code}</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <LucideIcon name="archive" size={12} color={colors.muted} />
                  <Text style={styles.metaText}>Archiviata il {formatArchivedAt(item.archived_at)}</Text>
                </View>
              </View>
              <View style={styles.actionsRow}>
                <Pressable
                  testID={`restore-${item.code}`}
                  disabled={isBusy}
                  onPress={() => restore(item)}
                  style={[styles.actionBtn, styles.restoreBtn, isBusy && { opacity: 0.5 }]}
                >
                  <LucideIcon name="undo-2" size={14} color={colors.onSuccess} />
                  <Text style={styles.restoreText}>Ripristina</Text>
                </Pressable>
                <Pressable
                  testID={`delete-${item.code}`}
                  disabled={isBusy}
                  onPress={() => remove(item)}
                  style={[styles.actionBtn, styles.deleteBtn, isBusy && { opacity: 0.5 }]}
                >
                  <LucideIcon name="trash-2" size={14} color={colors.onBrandPrimary} />
                  <Text style={styles.deleteText}>Elimina</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={colors.brandPrimary} />
          ) : (
            <View style={styles.emptyBox} testID="empty-archive">
              <LucideIcon name="archive" size={32} color={colors.brandPrimary} />
              <Text style={styles.emptyTitle}>Archivio vuoto</Text>
              <Text style={styles.emptyBody}>
                Nessuna scheda archiviata. Le inattive da 60+ giorni verranno spostate qui in automatico.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}
