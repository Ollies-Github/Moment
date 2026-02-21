import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/tokens";
import type { Market, Selection } from "../types/contracts";

type Props = {
  market: Market;
  onPick: (market: Market, selection: Selection) => void;
};

const labels = (type: Market["market_type"]) =>
  type === "binary_higher_lower" ? { a: "HIGHER", b: "LOWER" } : { a: "YES", b: "NO" };

const selections = (type: Market["market_type"]) =>
  type === "binary_higher_lower"
    ? ({ a: "HIGHER", b: "LOWER" } as const)
    : ({ a: "YES", b: "NO" } as const);

export function MarketCard({ market, onPick }: Props) {
  const l = labels(market.market_type);
  const s = selections(market.market_type);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.sport}>{market.sport}</Text>
        <Text style={styles.status}>{market.status.toUpperCase()}</Text>
      </View>

      <Text style={styles.question}>{market.question}</Text>

      <View style={styles.row}>
        <Pressable style={[styles.side, styles.sideA]} onPress={() => onPick(market, s.a)}>
          <Text style={styles.sideLabel}>{l.a}</Text>
          <Text style={styles.sidePrice}>{Math.round(market.prices.yes * 100)}%</Text>
        </Pressable>
        <Pressable style={[styles.side, styles.sideB]} onPress={() => onPick(market, s.b)}>
          <Text style={styles.sideLabel}>{l.b}</Text>
          <Text style={styles.sidePrice}>{Math.round(market.prices.no * 100)}%</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  sport: {
    color: colors.accent,
    fontWeight: "700",
  },
  status: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  question: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 20,
    lineHeight: 26,
  },
  side: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  sideA: {
    backgroundColor: "#0f2f2c",
    borderColor: "#1a635d",
  },
  sideB: {
    backgroundColor: "#1a2438",
    borderColor: "#2b3f65",
  },
  sideLabel: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 12,
  },
  sidePrice: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 24,
    marginTop: 4,
  },
});
