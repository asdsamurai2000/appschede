import { useCallback, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import LucideIcon from "@react-native-vector-icons/lucide";

import { makeStyles, useTheme } from "@/src/theme";
import { Header } from "@/src/components/header";
import { api, type Scheda, isPaidThisMonth } from "@/src/api";

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  banner: {
    marginTop: 16, padding: 16, borderWidth: 2,
  },
  bannerLabel: { fontSize: 10, letterSpacing: 2, textTransform: "uppercase" },
  bannerValue: { fontSize: 40, fontWeight: "800", letterSpacing: -1, marginTop: 4 },
  bannerHint: { fontSize: 11, letterSpacing: 1, marginTop: 4, textTransform: "uppercase", opacity: 0.85 },
  row: {
    borderWidth: 2, borderColor: c.borderStrong, marginBottom: -2,
    padding: 16, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface,
  },
  rowLeft: { flex: 1 },
  clientName: { color: c.onSurface, fontSize: 18, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  schedaName: { color: c.muted, fontSize: 12, letterSpacing: 1, marginTop: 2, textTransform: "uppercase" },
  codePill: {
    backgroundColor: c.brandPrimary, paddingHorizontal: 10, paddingVertical: 6,
  },
  codeText: { color: c.onBrandPrimary, fontWeight: "800", letterSpacing: 2, fontSize: 13 },
  empty: {
    borderWidth: 2, borderColor: c.borderStrong, padding: 24, marginTop: 24,
    alignItems: "center", gap: 8,
  },
  emptyTitle: {
    color: c.onSurface, fontSize: 18, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase",
  },
  emptyBody: { color: c.muted, fontSize: 12, letterSpacing: 1, textAlign: "center" },
}));

export default function PaymentsList() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { status } = useLocalSearchParams<{ status: string }>();

  const paidFilter = status === "paid";
  const title = paidFilter ? "Paganti" : "Da Pagare";
  const bannerBg = paidFilter ? colors.success : colors.brandPrimary;
  const bannerFg = paidFilter ? colors.onSuccess : colors.onBrandPrimary;

  const [items, setItems] = useState<Scheda[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get<Scheda[]>("/schede");
      setItems(r.data);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = items.filter((x) => isPaidThisMonth(x.paid_month) === paidFilter);

  return (
    <View style={styles.root}>
      <Header title={title} subtitle={`Mese corrente`} back />
      <FlatList
        data={filtered}
        keyExtractor={(x) => x.id}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />
        }
        ListHeaderComponent={
          <View style={[styles.banner, { backgroundColor: bannerBg, borderColor: bannerBg }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <LucideIcon name="flag" size={14} color={bannerFg} />
              <Text style={[styles.bannerLabel, { color: bannerFg }]}>
                {paidFilter ? "Mensile pagato" : "Mensile da pagare"}
              </Text>
            </View>
            <Text style={[styles.bannerValue, { color: bannerFg }]}>{filtered.length}</Text>
            <Text style={[styles.bannerHint, { color: bannerFg }]}>
              {paidFilter ? "Clienti in regola questo mese" : "Clienti da sollecitare"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`payment-row-${item.code}`}
            style={styles.row}
            onPress={() => router.push({ pathname: "/host/scheda/[id]", params: { id: item.code } })}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.clientName} numberOfLines={1}>{item.client_name}</Text>
              <Text style={styles.schedaName} numberOfLines={1}>{item.name}</Text>
            </View>
            <View style={styles.codePill}>
              <Text style={styles.codeText}>{item.code}</Text>
            </View>
            <LucideIcon name="chevron-right" size={22} color={colors.onSurface} />
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={colors.brandPrimary} />
          ) : (
            <View style={styles.empty} testID="empty-list">
              <LucideIcon name="check-circle" size={32} color={paidFilter ? colors.brandPrimary : colors.success} />
              <Text style={styles.emptyTitle}>
                {paidFilter ? "Nessun pagante" : "Tutti in regola"}
              </Text>
              <Text style={styles.emptyBody}>
                {paidFilter ? "Segna un pagamento dalla scheda cliente." : "Nessun cliente in sospeso questo mese."}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}
