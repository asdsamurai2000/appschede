import { useState } from "react";
import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LucideIcon from "@react-native-vector-icons/lucide";

import { makeStyles, useTheme, setColorScheme, type ColorScheme } from "@/src/theme";
import { Header } from "@/src/components/header";
import { useIsHost, setIsHost, clearLastCode, clearHostVerified } from "@/src/state";

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  sectionLabel: {
    color: c.muted, fontSize: 11, letterSpacing: 3, textTransform: "uppercase", marginTop: 24, marginBottom: 12,
  },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 2, borderColor: c.borderStrong, padding: 16, marginBottom: -2, backgroundColor: c.surface,
  },
  rowTitle: { color: c.onSurface, fontSize: 14, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  rowSub: { color: c.muted, fontSize: 11, letterSpacing: 1, marginTop: 2, textTransform: "uppercase" },
  themeChip: {
    borderWidth: 2, borderColor: c.borderStrong, paddingHorizontal: 10, paddingVertical: 6,
  },
  themeChipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  themeChipText: { color: c.onSurface, fontWeight: "800", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  themeChipTextActive: { color: c.onBrandPrimary, fontWeight: "800", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" },
  aboutText: { color: c.muted, fontSize: 12, letterSpacing: 1 },
}));

export default function Settings() {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isHost = useIsHost();

  const [_, force] = useState(0);
  const apply = (s: ColorScheme) => { setColorScheme(s); force((n) => n + 1); };

  return (
    <View style={styles.root}>
      <Header title="Impostazioni" back />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.sectionLabel}>Tema</Text>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>Aspetto</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Pressable
              testID="theme-light-btn"
              onPress={() => apply("light")}
              style={[styles.themeChip, scheme === "light" ? styles.themeChipActive : null]}
            >
              <Text style={scheme === "light" ? styles.themeChipTextActive : styles.themeChipText}>Light</Text>
            </Pressable>
            <Pressable
              testID="theme-dark-btn"
              onPress={() => apply("dark")}
              style={[styles.themeChip, scheme === "dark" ? styles.themeChipActive : null]}
            >
              <Text style={scheme === "dark" ? styles.themeChipTextActive : styles.themeChipText}>Dark</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Modalità</Text>
        <Pressable
          testID="settings-host-toggle"
          onPress={async () => {
            const next = !isHost;
            if (!next) await clearHostVerified();
            setIsHost(next);
          }}
          style={styles.row}
        >
          <View>
            <Text style={styles.rowTitle}>Modalità Host</Text>
            <Text style={styles.rowSub}>{isHost ? "Attiva — accedi al pannello" : "Disattiva — inserisci codice"}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <LucideIcon name={isHost ? "toggle-right" : "toggle-left"} size={28} color={isHost ? colors.brandPrimary : colors.muted} />
          </View>
        </Pressable>
        <Pressable
          testID="settings-open-library"
          onPress={() => router.push("/library")}
          style={styles.row}
        >
          <View>
            <Text style={styles.rowTitle}>Libreria Esercizi</Text>
            <Text style={styles.rowSub}>Elenco esercizi & descrizioni</Text>
          </View>
          <LucideIcon name="chevron-right" size={22} color={colors.onSurface} />
        </Pressable>
        <Pressable
          testID="settings-clear-code"
          onPress={() => {
            Alert.alert("Reset", "Cancellare l'ultimo codice memorizzato?", [
              { text: "Annulla", style: "cancel" },
              { text: "Cancella", style: "destructive", onPress: async () => { await clearLastCode(); } },
            ]);
          }}
          style={styles.row}
        >
          <View>
            <Text style={styles.rowTitle}>Reset Codice Salvato</Text>
            <Text style={styles.rowSub}>Rimuovi l'ultimo codice cliente</Text>
          </View>
          <LucideIcon name="rotate-ccw" size={22} color={colors.onSurface} />
        </Pressable>

        <Text style={styles.sectionLabel}>Info</Text>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowTitle}>GymCode</Text>
            <Text style={styles.aboutText}>Versione 1.0 · Schede su codice</Text>
          </View>
          <LucideIcon name="info" size={20} color={colors.onSurface} />
        </View>
      </ScrollView>
    </View>
  );
}
