import { useState } from "react";
import {
  View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LucideIcon from "@react-native-vector-icons/lucide";

import { makeStyles, useTheme } from "@/src/theme";
import { Button } from "@/src/components/ui";
import { api } from "@/src/api";
import { setIsHost, setHostVerified } from "@/src/state";

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  headline: {
    color: c.onSurface, fontSize: 34, fontWeight: "800", letterSpacing: -1,
    marginTop: 32, textTransform: "uppercase", lineHeight: 38,
  },
  accent: { color: c.brandPrimary },
  sub: {
    color: c.muted, fontSize: 12, letterSpacing: 2, marginTop: 12, textTransform: "uppercase",
  },
  label: {
    color: c.muted, fontSize: 10, letterSpacing: 3, textTransform: "uppercase",
    marginTop: 40, marginBottom: 6,
  },
  inputWrap: {
    borderWidth: 2, borderColor: c.borderStrong, backgroundColor: c.surfaceSecondary,
    flexDirection: "row", alignItems: "center",
  },
  input: {
    flex: 1, color: c.onSurface, fontSize: 18, fontWeight: "700", letterSpacing: 4,
    paddingVertical: 16, paddingHorizontal: 16,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  inputError: { borderColor: c.brandPrimary },
  eyeBtn: { paddingHorizontal: 14, paddingVertical: 12 },
  errorText: {
    color: c.brandPrimary, marginTop: 12, letterSpacing: 2, fontSize: 12,
    fontWeight: "700", textTransform: "uppercase",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24 },
  brandDot: { width: 12, height: 12, backgroundColor: c.brandPrimary },
  brandText: {
    color: c.onSurface, fontSize: 11, letterSpacing: 4, fontWeight: "700", textTransform: "uppercase",
  },
  helper: {
    borderWidth: 1, borderColor: c.border, padding: 12, marginTop: 24,
    flexDirection: "row", gap: 10, alignItems: "flex-start",
  },
  helperText: { color: c.muted, fontSize: 11, letterSpacing: 1, flex: 1, lineHeight: 16 },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 8, borderTopWidth: 2, borderTopColor: c.borderStrong, backgroundColor: c.surface },
}));

export default function HostUnlock() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reveal, setReveal] = useState(false);

  const submit = async () => {
    if (!password) return;
    setLoading(true); setError(null);
    try {
      await api.post("/host/verify", { password });
      await setHostVerified();
      setIsHost(true);
      router.replace("/host");
    } catch (e: any) {
      if (e?.response?.status === 429) {
        setError("Troppi tentativi. Riprova tra un minuto.");
      } else {
        setError("Password non valida");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>Area Riservata Host</Text>
        </View>

        <Text style={styles.headline}>
          Password<Text style={styles.accent}>.</Text>{"\n"}Modalità Host
        </Text>
        <Text style={styles.sub}>Solo l'host può accedere al pannello</Text>

        <Text style={styles.label}>Password</Text>
        <View style={[styles.inputWrap, error ? styles.inputError : null]}>
          <TextInput
            testID="host-password-input"
            value={password}
            onChangeText={(v) => { setPassword(v); setError(null); }}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry={!reveal}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <Pressable testID="host-password-toggle-reveal" onPress={() => setReveal((r) => !r)} style={styles.eyeBtn} hitSlop={8}>
            <LucideIcon name={reveal ? "eye-off" : "eye"} size={18} color={colors.onSurface} />
          </Pressable>
        </View>
        {error ? <Text style={styles.errorText} testID="host-password-error">{error}</Text> : null}

        <View style={styles.helper}>
          <LucideIcon name="info" size={14} color={colors.muted} />
          <Text style={styles.helperText}>
            La password è configurata lato server dall'amministratore. Se non la conosci, chiedila al gestore della palestra.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          testID="host-password-submit"
          label="Sblocca"
          onPress={submit}
          loading={loading}
          disabled={!password}
        />
        <Pressable onPress={() => router.back()} testID="host-password-cancel">
          <View style={{ paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>Annulla</Text>
          </View>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
