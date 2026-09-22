import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import LucideIcon from "@react-native-vector-icons/lucide";

import { makeStyles, useTheme } from "@/src/theme";
import { Header } from "@/src/components/header";
import { api, type Scheda, type CheckInStats, type CheckIn, type WarmupTemplate, isPaidThisMonth } from "@/src/api";
import { clearLastCode } from "@/src/state";

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
  sessionRow: {
    borderWidth: 2, borderColor: c.borderStrong, marginBottom: -2,
    padding: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface,
  },
  sessionNum: {
    width: 44, height: 44, backgroundColor: c.brandPrimary,
    alignItems: "center", justifyContent: "center",
  },
  sessionNumText: { color: c.onBrandPrimary, fontWeight: "800", fontSize: 20 },
  sessionName: { color: c.onSurface, fontSize: 16, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  sessionMeta: { color: c.muted, fontSize: 11, letterSpacing: 1, marginTop: 2 },
  chartRow: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 60, marginTop: 12 },
  bar: { flex: 1, backgroundColor: c.brandPrimary, minHeight: 2 },
  barMuted: { flex: 1, backgroundColor: c.surfaceTertiary, minHeight: 2 },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 8, borderTopWidth: 2, borderTopColor: c.borderStrong, backgroundColor: c.surface },
  historyItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.divider, flexDirection: "row", justifyContent: "space-between" },
  historyText: { color: c.onSurface, fontSize: 13 },
  paidPill: {
    marginTop: 16, alignSelf: "flex-start", borderWidth: 2,
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  paidPillText: {
    fontSize: 12, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase",
  },
}));

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ClientDashboard() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();

  const [scheda, setScheda] = useState<Scheda | null>(null);
  const [warmup, setWarmup] = useState<WarmupTemplate | null>(null);
  const [stats, setStats] = useState<CheckInStats | null>(null);
  const [history, setHistory] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, w, st, h] = await Promise.all([
        api.get<Scheda>(`/schede/${code}`),
        api.get<WarmupTemplate>(`/warmup`).catch(() => ({ data: { exercises: [], updated_at: "" } as WarmupTemplate })),
        api.get<CheckInStats>(`/checkins/${code}/stats`),
        api.get<CheckIn[]>(`/checkins/${code}?limit=8`),
      ]);
      setScheda(s.data); setWarmup(w.data); setStats(st.data); setHistory(h.data);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [code]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const exit = async () => { await clearLastCode(); router.replace("/"); };

  if (loading || !scheda || !stats) {
    return (
      <View style={styles.root}>
        <Header title="Scheda" back />
        <ActivityIndicator style={{ marginTop: 48 }} color={colors.brandPrimary} />
      </View>
    );
  }

  const maxBar = Math.max(1, ...stats.weekly_history.map((w) => w.count));

  return (
    <View style={styles.root}>
      <Header
        title={scheda.client_name}
        subtitle={scheda.name}
        right={
          <View style={{ flexDirection: "row", gap: 4 }}>
            <Pressable
              testID="client-open-settings"
              onPress={() => router.push("/settings")}
              style={{ padding: 8 }}
              hitSlop={8}
            >
              <LucideIcon name="settings" size={20} color={colors.onSurface} />
            </Pressable>
            <Pressable testID="client-exit-button" onPress={exit} style={{ padding: 8 }} hitSlop={8}>
              <LucideIcon name="log-out" size={20} color={colors.onSurface} />
            </Pressable>
          </View>
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />
        }
      >
        <View style={styles.statsGrid}>
          <View style={[styles.statCell, styles.statCellDivider]}>
            <Text style={styles.statLabel}>Settimana</Text>
            <Text style={styles.statValue} testID="week-count">{stats.week}</Text>
          </View>
          <View style={[styles.statCell, styles.statCellDivider]}>
            <Text style={styles.statLabel}>Mese</Text>
            <Text style={styles.statValue} testID="month-count">{stats.month}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Anno</Text>
            <Text style={styles.statValue}>{stats.year}</Text>
          </View>
        </View>

        {(() => {
          const paid = isPaidThisMonth(scheda.paid_month);
          return (
            <View
              testID="client-paid-status"
              style={[styles.paidPill, { backgroundColor: paid ? colors.success : colors.brandTertiary, borderColor: paid ? colors.success : colors.brandPrimary }]}
            >
              <LucideIcon name="flag" size={14} color={paid ? colors.onSuccess : colors.brandPrimary} />
              <Text style={[styles.paidPillText, { color: paid ? colors.onSuccess : colors.onBrandTertiary }]}>
                {paid ? "Mensile pagato" : "Mensile da pagare"}
              </Text>
            </View>
          );
        })()}

        <Text style={styles.sectionLabel}>Ultime 12 Settimane</Text>
        <View style={styles.chartRow}>
          {stats.weekly_history.map((w, i) => {
            const h = Math.max(2, (w.count / maxBar) * 60);
            return <View key={i} style={[w.count > 0 ? styles.bar : styles.barMuted, { height: h }]} />;
          })}
        </View>

        <Text style={styles.sectionLabel}>Le Tue Sessioni</Text>
        {warmup && warmup.exercises.length > 0 ? (
          <Pressable
            testID="open-session-warmup"
            style={[styles.sessionRow, { borderColor: colors.brandPrimary }]}
            onPress={() => router.push({ pathname: "/client/[code]/session/[day]", params: { code: code!, day: "warmup" } })}
          >
            <View style={[styles.sessionNum, { backgroundColor: colors.brandPrimary }]}>
              <LucideIcon name="flame" size={20} color={colors.onBrandPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sessionName} numberOfLines={1}>Riscaldamento</Text>
              <Text style={styles.sessionMeta}>{warmup.exercises.length} esercizi · sempre attivo</Text>
            </View>
            <LucideIcon name="chevron-right" size={22} color={colors.onSurface} />
          </Pressable>
        ) : null}
        {scheda.sessions.map((s, idx) => (
          <Pressable
            key={s.id}
            testID={`open-session-${idx}`}
            style={styles.sessionRow}
            onPress={() => router.push({ pathname: "/client/[code]/session/[day]", params: { code: code!, day: String(idx) } })}
          >
            <View style={styles.sessionNum}>
              <Text style={styles.sessionNumText}>{idx + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sessionName} numberOfLines={1}>{s.name}</Text>
              <Text style={styles.sessionMeta}>{s.exercises.length} esercizi</Text>
            </View>
            <LucideIcon name="chevron-right" size={22} color={colors.onSurface} />
          </Pressable>
        ))}

        {history.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Ultimi Ingressi</Text>
            {history.map((h) => (
              <View key={h.id} style={styles.historyItem}>
                <Text style={styles.historyText}>{fmtDate(h.timestamp)}</Text>
                <Text style={[styles.historyText, { color: colors.muted }]}>{h.session_name ?? "—"}</Text>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
