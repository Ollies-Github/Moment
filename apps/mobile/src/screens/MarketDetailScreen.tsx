import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useAppStore } from "../store/useAppStore";
import { colors, radii, spacing } from "../theme/tokens";

interface MarketDetailScreenProps {
  marketId: string;
}

export function MarketDetailScreen({ marketId }: MarketDetailScreenProps) {
  const market = useAppStore((state) => state.marketsById[marketId]);

  if (!market) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Market not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sport}>{market.sport}</Text>
      <Text style={styles.question}>{market.question}</Text>
      <Text style={styles.status}>Status: {market.status.toUpperCase()}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Prices</Text>
        <Text style={styles.cardValue}>YES: {(market.prices.yes * 100).toFixed(1)}%</Text>
        <Text style={styles.cardValue}>NO: {(market.prices.no * 100).toFixed(1)}%</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Rules</Text>
        <Text style={styles.cardText}>
          Backend-controlled close mode only. No client close time. Outcome settled via oracle adapter confirmation.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Price History</Text>
        <Text style={styles.cardText}>TODO: hook live sparkline + candle snapshots.</Text>
      </View>

      {__DEV__ ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dev Debug</Text>
          <Text style={styles.debug}>Market ID: {market.market_id}</Text>
          <Text style={styles.debug}>Session ID: {market.session_id}</Text>
          <Text style={styles.debug}>Starter Event: {market.starter_event_id}</Text>
          <Text style={styles.debug}>Updated: {market.timestamps.updated_at_ms}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  empty: {
    color: colors.textSecondary,
  },
  sport: {
    color: colors.accentBlue,
    fontSize: 12,
    textTransform: "uppercase",
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  question: {
    color: colors.textPrimary,
    fontSize: 30,
    fontWeight: "800",
    marginTop: spacing.sm,
    lineHeight: 36,
  },
  status: {
    marginTop: spacing.md,
    color: colors.accentGreen,
    fontWeight: "700",
  },
  card: {
    marginTop: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    padding: spacing.md,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 6,
  },
  cardValue: {
    color: colors.textSecondary,
    marginBottom: 4,
  },
  cardText: {
    color: colors.textSecondary,
    lineHeight: 20,
  },
  debug: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 2,
  },
});
