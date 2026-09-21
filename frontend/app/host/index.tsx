import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LucideIcon from "@react-native-vector-icons/lucide";

import { makeStyles, useTheme } from "@/src/theme";
import { Header } from "@/src/components/header";
import { Button } from "@/src/components/ui";
import { api, type Scheda, isPaidThisMonth } from "@/src/api";
import { setIsHost, clearHostVerified } from "@/src/state";

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
  metaRow: { flexDirection: "row", gap: 12, marginTop: 12, alignItems: "center", flexWrap: "wrap" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { color: c.onSurface, fontSize: 12, letterSpacing: 1 },
  paidFlag: {
    marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  paidFlagText: {
    fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase",
  },
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
  libraryTile: {
    marginTop: 24,
    borderWidth: 2,
    borderColor: c.borderStrong,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.surface,
  },
  libraryTileLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  libraryTileTitle: {
    color: c.onSurface, fontSize: 14, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase",
  },
  libraryTileSub: {
    color: c.muted, fontSize: 11, letterSpacing: 1, marginTop: 2, textTransform: "uppercase",
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
          <View style={{ flexDirection: "row", gap: 4 }}>
            <Pressable
              testID="host-open-library"
              onPress={() => router.push("/library")}
              style={{ padding: 8 }}
              hitSlop={8}
            >
              <LucideIcon name="library" size={20} color={colors.onSurface} />
            </Pressable>
            <Pressable
              testID="host-logout-button"
              onPress={async () => { await clearHostVerified(); setIsHost(false); router.replace("/"); }}
              style={{ padding: 8 }}
              hitSlop={8}
            >
              <LucideIcon name="log-out" size={20} color={colors.onSurface} />
            </Pressable>
          </View>
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
            <Pressable
              testID="host-library-tile"
              onPress={() => router.push("/library")}
              style={styles.libraryTile}
            >
              <View style={styles.libraryTileLeft}>
                <LucideIcon name="library" size={22} color={colors.brandPrimary} />
                <View>
                  <Text style={styles.libraryTileTitle}>Libreria Esercizi</Text>
                  <Text style={styles.libraryTileSub}>Aggiungi e gestisci gli esercizi</Text>
                </View>
              </View>
              <LucideIcon name="chevron-right" size={22} color={colors.onSurface} />
            </Pressable>
            <Pressable
              testID="host-warmup-tile"
              onPress={() => router.push("/host/warmup")}
              style={[styles.libraryTile, { marginTop: -2 }]}
            >
              <View style={styles.libraryTileLeft}>
                <LucideIcon name="flame" size={22} color={colors.brandPrimary} />
                <View>
                  <Text style={styles.libraryTileTitle}>Riscaldamento</Text>
                  <Text style={styles.libraryTileSub}>Applicato a tutti i clienti</Text>
                </View>
              </View>
              <LucideIcon name="chevron-right" size={22} color={colors.onSurface} />
            </Pressable>
            <Text style={styles.sectionLabel}>Schede Attive</Text>
          </View>
        }
        renderItem={({ item }) => {
          const paid = isPaidThisMonth(item.paid_month);
          return (
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
              <View style={[styles.paidFlag, { backgroundColor: paid ? colors.success : colors.brandPrimary }]} testID={`paid-flag-${item.code}`}>
                <LucideIcon name="flag" size={12} color={paid ? colors.onSuccess : colors.onBrandPrimary} />
                <Text style={[styles.paidFlagText, { color: paid ? colors.onSuccess : colors.onBrandPrimary }]}>
                  {paid ? "Pagato" : "Da pagare"}
                </Text>
              </View>
            </View>
          </Pressable>
          );
        }}
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
