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
import { clearHostToken } from "@/src/authStorage";

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
  statTile: { flex: 1, padding: 16, gap: 4 },
  statCellDivider: { borderRightWidth: 2, borderRightColor: c.borderStrong },
  statLabel: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: c.muted },
  statValue: { color: c.onSurface, fontSize: 32, fontWeight: "800", letterSpacing: -1, marginTop: 4 },
  statHint: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginTop: 2, opacity: 0.85 },
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
  const [archivedCount, setArchivedCount] = useState(0);
  const [autoArchivedInfo, setAutoArchivedInfo] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // Auto-archivia in silenzio le schede senza check-in da 60+ giorni.
      // Fire-and-forget con guardia: se fallisce non blocca il caricamento.
      let justArchived = 0;
      try {
        const auto = await api.post<{ count: number }>("/schede/auto-archive", { days: 60 });
        justArchived = auto?.data?.count ?? 0;
      } catch {}
      const [active, archived] = await Promise.all([
        api.get<Scheda[]>("/schede", { params: { archived: "false" } }),
        api.get<Scheda[]>("/schede", { params: { archived: "true" } }),
      ]);
      setItems(active.data);
      setArchivedCount(archived.data.length);
      if (justArchived > 0) setAutoArchivedInfo(justArchived);
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
              testID="host-open-settings"
              onPress={() => router.push("/settings")}
              style={{ padding: 8 }}
              hitSlop={8}
            >
              <LucideIcon name="settings" size={20} color={colors.onSurface} />
            </Pressable>
            <Pressable
              testID="host-logout-button"
              onPress={async () => { await clearHostToken(); await clearHostVerified(); setIsHost(false); router.replace("/"); }}
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
              <Pressable
                testID="paid-tile"
                onPress={() => router.push({ pathname: "/host/payments/[status]", params: { status: "paid" } })}
                style={[styles.statTile, styles.statCellDivider, { backgroundColor: colors.success }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <LucideIcon name="flag" size={14} color={colors.onSuccess} />
                  <Text style={[styles.statLabel, { color: colors.onSuccess }]}>Pagato</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.onSuccess }]}>
                  {items.filter((x) => isPaidThisMonth(x.paid_month)).length}
                </Text>
                <Text style={[styles.statHint, { color: colors.onSuccess }]}>Vedi lista</Text>
              </Pressable>
              <Pressable
                testID="unpaid-tile"
                onPress={() => router.push({ pathname: "/host/payments/[status]", params: { status: "unpaid" } })}
                style={[styles.statTile, { backgroundColor: colors.brandPrimary }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <LucideIcon name="flag" size={14} color={colors.onBrandPrimary} />
                  <Text style={[styles.statLabel, { color: colors.onBrandPrimary }]}>Da pagare</Text>
                </View>
                <Text style={[styles.statValue, { color: colors.onBrandPrimary }]}>
                  {items.filter((x) => !isPaidThisMonth(x.paid_month)).length}
                </Text>
                <Text style={[styles.statHint, { color: colors.onBrandPrimary }]}>Vedi lista</Text>
              </Pressable>
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
            <Pressable
              testID="host-archive-tile"
              onPress={() => router.push("/host/archive")}
              style={[styles.libraryTile, { marginTop: -2 }]}
            >
              <View style={styles.libraryTileLeft}>
                <LucideIcon name="archive" size={22} color={colors.brandPrimary} />
                <View>
                  <Text style={styles.libraryTileTitle}>Archivio</Text>
                  <Text style={styles.libraryTileSub}>
                    {archivedCount === 0
                      ? "Nessuna scheda archiviata"
                      : `${archivedCount} ${archivedCount === 1 ? "scheda archiviata" : "schede archiviate"}`}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {archivedCount > 0 ? (
                  <View testID="archive-badge" style={{
                    backgroundColor: colors.brandPrimary,
                    paddingHorizontal: 8, paddingVertical: 2,
                    minWidth: 22, alignItems: "center",
                  }}>
                    <Text style={{ color: colors.onBrandPrimary, fontSize: 12, fontWeight: "800", letterSpacing: 1 }}>
                      {archivedCount}
                    </Text>
                  </View>
                ) : null}
                <LucideIcon name="chevron-right" size={22} color={colors.onSurface} />
              </View>
            </Pressable>
            {autoArchivedInfo !== null ? (
              <Pressable
                testID="auto-archive-banner"
                onPress={() => { setAutoArchivedInfo(null); router.push("/host/archive"); }}
                style={{
                  marginTop: 16,
                  borderWidth: 2, borderColor: colors.borderStrong,
                  padding: 12, flexDirection: "row", gap: 10, alignItems: "center",
                  backgroundColor: colors.surfaceSecondary,
                }}
              >
                <LucideIcon name="archive" size={18} color={colors.brandPrimary} />
                <Text style={{ flex: 1, color: colors.onSurface, fontSize: 12, letterSpacing: 1 }}>
                  {autoArchivedInfo === 1
                    ? "1 scheda inattiva da 60+ giorni è stata archiviata."
                    : `${autoArchivedInfo} schede inattive da 60+ giorni sono state archiviate.`}
                </Text>
                <Text style={{ color: colors.brandPrimary, fontSize: 11, letterSpacing: 2, fontWeight: "800", textTransform: "uppercase" }}>
                  Apri
                </Text>
              </Pressable>
            ) : null}
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
