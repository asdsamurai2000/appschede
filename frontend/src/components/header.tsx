import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import LucideIcon from "@react-native-vector-icons/lucide";
import { makeStyles, useTheme } from "@/src/theme";

type Props = {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
  testID?: string;
};

const useStyles = makeStyles((c) => ({
  container: {
    backgroundColor: c.surface,
    borderBottomWidth: 2,
    borderBottomColor: c.borderStrong,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -8,
  },
  titles: { flex: 1 },
  title: {
    color: c.onSurface,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  subtitle: {
    color: c.muted,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 2,
    textTransform: "uppercase",
  },
}));

export function Header({ title, subtitle, back, right, testID }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, paddingBottom: 12 }]} testID={testID}>
      <View style={styles.row}>
        {back ? (
          <Pressable testID="header-back-button" onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <LucideIcon name="arrow-left" size={24} color={colors.onSurface} />
          </Pressable>
        ) : null}
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}
