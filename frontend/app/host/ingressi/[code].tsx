import { useCallback, useState } from "react";
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";

import { makeStyles, useTheme } from "@/src/theme";
import { Header } from "@/src/components/header";
import { api, type CheckInStats, type CheckIn, type Scheda } from "@/src/api";

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  bigNumber: {
    fontSize: 96, fontWeight: "800", color: c.onSurface, letterSpacing: -4, lineHeight: 96,
  },
  bigLabel: { color: c.muted, fontSize: 12, letterSpacing: 3, textTransform: "uppercase" },
  statsGrid: {
    flexDirection: "row", borderWidth: 2, borderColor: c.borderStrong, marginTop: 16,
  },
  statCell: { flex: 1, padding: 14 },
  statCellDivider: { borderRightWidth: 2, borderRightColor: c.borderStrong },
  statValue: { color: c.onSurface, fontSize: 28, fontWeight: "800", letterSpacing: -1, marginTop: 2 },
  statLabel: { color: c.muted, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" },
  sectionLabel: {
    color: c.muted, fontSize: 11, letterSpacing: 3, textTransform: "uppercase", marginTop: 24, marginBottom: 12,
  },
  chartRow: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 60, marginTop: 12 },
  bar: { flex: 1, backgroundColor: c.brandPrimary, minHeight: 2 },
  barMuted: { flex: 1, backgroundColor: c.surfaceTertiary, minHeight: 2 },
  historyItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.divider, flexDirection: "row", justifyContent: "space-between" },
  historyText: { color: c.onSurface, fontSize: 13 },
  empty: {
    borderWidth: 2, borderColor: c.borderStrong, padding: 24, marginTop: 12,
    alignItems: "center", gap: 8,
  },
  emptyText: { color: c.muted, fontSize: 12, letterSpacing: 1, textAlign: "center", textTransform: "uppercase" },
}));

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function HostIngressi() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { code } = useLocalSearchParams<{ code: string }>();

  const [scheda, setScheda] = useState<Scheda | null>(null);
  const [stats, setStats] = useState<CheckInStats | null>(null);
  const [history, setHistory] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, st, h] = await Promise.all([
        api.get<Scheda>(`/schede/${code}`),
        api.get<CheckInStats>(`/checkins/${code}/stats`),
        api.get<CheckIn[]>(`/checkins/${code}?limit=30`),
      ]);
      setScheda(s.data); setStats(st.data); setHistory(h.data);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [code]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading || !scheda || !stats) {
    return (
      <View style={styles.root}>
        <Header title="Ingressi" back />
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.brandPrimary} />
      </View>
    );
  }

  const maxBar = Math.max(1, ...stats.weekly_history.map((w) => w.count));

  return (
    <View style={styles.root}>
      <Header title="Ingressi" subtitle={scheda.client_name} back />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />
        }
      >
        <View style={{ marginTop: 16 }}>
          <Text style={styles.bigLabel}>Ingressi Questa Settimana</Text>
          <Text style={styles.bigNumber} testID="host-week-count">{stats.week}</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statCell, styles.statCellDivider]}>
            <Text style={styles.statLabel}>Mese</Text>
            <Text style={styles.statValue}>{stats.month}</Text>
          </View>
          <View style={[styles.statCell, styles.statCellDivider]}>
            <Text style={styles.statLabel}>Anno</Text>
            <Text style={styles.statValue}>{stats.year}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Totale</Text>
            <Text style={styles.statValue}>{stats.total}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Ultime 12 Settimane</Text>
        <View style={styles.chartRow}>
          {stats.weekly_history.map((w, i) => {
            const h = Math.max(2, (w.count / maxBar) * 60);
            return <View key={i} style={[w.count > 0 ? styles.bar : styles.barMuted, { height: h }]} />;
          })}
        </View>

        <Text style={styles.sectionLabel}>Storico Ingressi</Text>
        {history.length === 0 ? (
          <View style={styles.empty} testID="host-ingressi-empty">
            <Text style={styles.emptyText}>Nessun ingresso registrato</Text>
          </View>
        ) : (
          history.map((h) => (
            <View key={h.id} style={styles.historyItem} testID={`host-ingresso-${h.id}`}>
              <Text style={styles.historyText}>{fmtDate(h.timestamp)}</Text>
              <Text style={[styles.historyText, { color: colors.muted }]}>{h.session_name ?? "—"}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
