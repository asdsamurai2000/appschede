import { Pressable, Text, View, ActivityIndicator, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { makeStyles, useTheme } from "@/src/theme";

type Variant = "primary" | "secondary" | "danger" | "ghost";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  fullWidth?: boolean;
};

const useStyles = makeStyles((c) => ({
  base: {
    height: 56,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    borderRadius: 0,
  },
  primary: {
    backgroundColor: c.brandPrimary,
    borderColor: c.brandPrimary,
  },
  secondary: {
    backgroundColor: c.surface,
    borderColor: c.borderStrong,
  },
  danger: {
    backgroundColor: c.surface,
    borderColor: c.brandPrimary,
  },
  ghost: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  labelPrimary: { color: c.onBrandPrimary, fontSize: 15, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  labelSecondary: { color: c.onSurface, fontSize: 15, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  labelDanger: { color: c.brandPrimary, fontSize: 15, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" },
  labelGhost: { color: c.onSurface, fontSize: 14, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase" },
  disabled: { opacity: 0.4 },
}));

export function Button({ label, onPress, variant = "primary", disabled, loading, testID, fullWidth }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const containerStyle = [
    styles.base,
    variant === "primary" && styles.primary,
    variant === "secondary" && styles.secondary,
    variant === "danger" && styles.danger,
    variant === "ghost" && styles.ghost,
    (disabled || loading) && styles.disabled,
    fullWidth ? { alignSelf: "stretch" as const } : null,
  ];
  const labelStyle =
    variant === "primary" ? styles.labelPrimary :
    variant === "secondary" ? styles.labelSecondary :
    variant === "danger" ? styles.labelDanger :
    styles.labelGhost;

  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [containerStyle, pressed ? { opacity: 0.85 } : null]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.onBrandPrimary : colors.brandPrimary} />
      ) : (
        <Text style={labelStyle}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth * 4, backgroundColor: colors.borderStrong }} />;
}
