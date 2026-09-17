import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LucideIcon from "@react-native-vector-icons/lucide";

import { makeStyles, useTheme } from "@/src/theme";
import { Header } from "@/src/components/header";
import { Button } from "@/src/components/ui";
import { api, type Scheda } from "@/src/api";
import { setIsHost } from "@/src/state";

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  statsRow: {
    flexDirection: "row",
    borderWidth: 2,
    borderColor: c.borderStrong,
    marginTop: 16,
  },
  statCell: { flex: 1, padding: 16 },
  statCellDivider: { borderRightWidth: 2, borderRightColor: c.borderStrong },
  statLabel: { color: c.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" },
  statValue: { color: c.onSurface, fontSize: 32, fontWeight: "800", letterSpacing: -1, marginTop: 4 },
  sectionLabel: {
    color: c.muted,
    fontSize: 11,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginTop: 24,
    marginBottom: 12,
  },
  card: {
    borderWidth: 2,
    borderColor: c.borderStrong,
    marginBottom: -2,
    padding: 16,
    backgroundColor: c.surface,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  clientName: { color: c.onSurface, fontSize: 20, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  schedaName: { color: c.muted, fontSize: 12, letterSpacing: 1, marginTop: 4, textTransform: "uppercase" },
  codePill: {
    backgroundColor: c.brandPrimary,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  codeText: { color: c.onBrandPrimary, fontWeight: "800", letterSpacing: 2, fontSize: 13 },
  metaRow: { flexDirection: "row", gap: 16, marginTop: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { color: c.onSurface, fontSize: 12, letterSpacing: 1 },
  emptyBox: {
    borderWidth: 2,
    borderColor: c.borderStrong,
    padding: 24,
    marginTop: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: { color: c.onSurface, fontSize: 18, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  emptyBody: { color: c.muted, fontSize: 12, letterSpacing: 1, textAlign: "center" },
  fabWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: c.borderStrong,
    backgroundColor: c.surface,
  },
}));

export default function HostDashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [items, setItems] = useState<Scheda[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<Scheda[]>("/schede");
      setItems(r.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.root}>
      <Header
        title="Host"
        subtitle="Le tue schede"
        right={
          <Pressable
            testID="host-logout-button"
            onPress={() => { setIsHost(false); router.replace("/"); }}
            style={{ padding: 8 }}
            hitSlop={8}
          >
            <LucideIcon name="log-out" size={20} color={colors.onSurface} />
          </Pressable>
        }
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
            <View style={styles.statsRow}>
              <View style={[styles.statCell, styles.statCellDivider]}>
                <Text style={styles.statLabel}>Clienti</Text>
                <Text style={styles.statValue}>{items.length}</Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statLabel}>Sessioni Tot.</Text>
                <Text style={styles.statValue}>
                  {items.reduce((a, s) => a + s.sessions.length, 0)}
                </Text>
              </View>
            </View>
            <Text style={styles.sectionLabel}>Schede Attive</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`scheda-card-${item.code}`}
            style={styles.card}
            onPress={() => router.push({ pathname: "/host/scheda/[id]", params: { id: item.code } })}
          >
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
                <LucideIcon name="layers" size={14} color={colors.onSurface} />
                <Text style={styles.metaText}>{item.sessions.length} sessioni</Text>
              </View>
              <View style={styles.metaItem}>
                <LucideIcon name="dumbbell" size={14} color={colors.onSurface} />
                <Text style={styles.metaText}>
                  {item.sessions.reduce((a, s) => a + s.exercises.length, 0)} esercizi
                </Text>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={colors.brandPrimary} />
          ) : (
            <View style={styles.emptyBox} testID="empty-schede">
              <LucideIcon name="clipboard-list" size={32} color={colors.brandPrimary} />
              <Text style={styles.emptyTitle}>Nessuna Scheda</Text>
              <Text style={styles.emptyBody}>Crea la prima scheda per un tuo cliente.</Text>
            </View>
          )
        }
      />
      <View style={[styles.fabWrap, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          testID="create-scheda-button"
          label="Crea Scheda"
          onPress={() => router.push("/host/scheda/new")}
        />
      </View>
    </View>
  );
}
