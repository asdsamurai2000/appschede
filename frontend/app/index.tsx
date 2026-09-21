import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import LucideIcon from "@react-native-vector-icons/lucide";

import { makeStyles, useTheme } from "@/src/theme";
import { Button } from "@/src/components/ui";
import { api } from "@/src/api";
import { setIsHost, useIsHost, saveLastCode, getLastCode, getHostVerified } from "@/src/state";

const LOGO_LIGHT = require("../assets/images/brand-logo.png");
const LOGO_DARK = require("../assets/images/brand-logo-dark.png");

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 24,
  },
  brandLogo: { width: 44, height: 44 },
  brandText: {
    color: c.onSurface,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  brandSubtitle: {
    color: c.muted,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "600",
    marginTop: 4,
    textTransform: "uppercase",
  },
  headline: {
    color: c.onSurface,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
    marginTop: 48,
    textTransform: "uppercase",
    lineHeight: 42,
  },
  accent: { color: c.brandPrimary },
  sub: {
    color: c.muted,
    fontSize: 13,
    letterSpacing: 1,
    marginTop: 12,
    textTransform: "uppercase",
  },
  inputWrap: {
    marginTop: 40,
    borderWidth: 2,
    borderColor: c.borderStrong,
    backgroundColor: c.surfaceSecondary,
  },
  input: {
    color: c.onSurface,
    fontSize: 40,
    fontWeight: "700",
    letterSpacing: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
    textAlign: "center",
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },
  inputError: { borderColor: c.brandPrimary },
  errorText: {
    color: c.brandPrimary,
    marginTop: 12,
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  footer: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  hostToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 2,
    borderColor: c.borderStrong,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  hostToggleLabel: {
    color: c.onSurface,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  hostToggleState: {
    color: c.brandPrimary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  quickRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickText: { color: c.muted, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  quickBtn: {
    borderWidth: 2,
    borderColor: c.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickBtnText: {
    color: c.onSurface,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
}));

export default function Index() {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isHost = useIsHost();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  useEffect(() => {
    getLastCode().then(setLast);
  }, []);

  const goHost = async () => {
    setIsHost(true);
    const verified = await getHostVerified();
    if (verified) router.push("/host");
    else router.push("/host-unlock");
  };

  const submit = async () => {
    if (isHost) {
      goHost();
      return;
    }
    if (code.length !== 6) {
      setError("Inserisci un codice a 6 cifre");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.get(`/schede/${code}`);
      await saveLastCode(code);
      router.replace({ pathname: "/client/[code]", params: { code } });
    } catch {
      setError("Codice non valido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Image source={scheme === "dark" ? LOGO_DARK : LOGO_LIGHT} style={styles.brandLogo} resizeMode="contain" />
            <View>
              <Text style={styles.brandText}>A.S.D. Samurai 2000</Text>
              <Text style={styles.brandSubtitle}>Schede Personalizzate</Text>
            </View>
          </View>

          <Text style={styles.headline}>
            {isHost ? (<>Accedi<Text style={styles.accent}>.</Text>{"\n"}Modalità Host</>) : (<>Inserisci{"\n"}Il <Text style={styles.accent}>Codice</Text></>)}
          </Text>
          <Text style={styles.sub}>
            {isHost ? "Gestisci le schede dei tuoi clienti" : "Il tuo coach ti ha dato un codice a 6 cifre"}
          </Text>

          {!isHost && (
            <View style={[styles.inputWrap, error ? styles.inputError : null]}>
              <TextInput
                testID="access-code-input"
                value={code}
                onChangeText={(v) => {
                  setCode(v.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                placeholder="000000"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
                returnKeyType="go"
                onSubmitEditing={submit}
              />
            </View>
          )}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!isHost && last && last.length === 6 && last !== code ? (
            <View style={styles.quickRow}>
              <Text style={styles.quickText}>Ultimo codice</Text>
              <Pressable testID="last-code-chip" onPress={() => setCode(last)} style={styles.quickBtn}>
                <Text style={styles.quickBtnText}>{last}</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </TouchableWithoutFeedback>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          testID="submit-access-button"
          label={isHost ? "Vai al pannello host" : "Entra"}
          onPress={submit}
          loading={loading}
        />
        <Pressable
          testID="toggle-host-mode-button"
          onPress={() => setIsHost(!isHost)}
          style={styles.hostToggleRow}
          hitSlop={4}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <LucideIcon name="shield" size={16} color={colors.onSurface} />
            <Text style={styles.hostToggleLabel}>Modalità Host</Text>
          </View>
          <Text style={styles.hostToggleState}>{isHost ? "On" : "Off"}</Text>
        </Pressable>
        <Pressable testID="open-settings-link" onPress={() => router.push("/settings")}>
          <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 8 }}>
            <LucideIcon name="settings" size={14} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" }}>Impostazioni</Text>
          </View>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
