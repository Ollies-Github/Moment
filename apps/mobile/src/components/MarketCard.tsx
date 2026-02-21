import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { colors } from "../theme/tokens";
import type { Market, Selection } from "../types/contracts";

type Props = {
  market: Market;
  onPick: (market: Market, selection: Selection) => void;
  leftLabel?: string;
  rightLabel?: string;
  variant?: "f1" | "stocks";
  compact?: boolean;
  showSportTag?: boolean;
  positiveOnRight?: boolean;
  selectedSelection?: Selection;
};

const sideCopy = (
  type: Market["market_type"],
  leftLabel?: string,
  rightLabel?: string,
  positiveOnRight = false,
) => {
  const base =
    type === "binary_higher_lower"
      ? {
          positiveLabel: "HIGHER",
          negativeLabel: "LOWER",
          positiveSelection: "HIGHER" as const,
          negativeSelection: "LOWER" as const,
        }
      : {
          positiveLabel: "YES",
          negativeLabel: "NO",
          positiveSelection: "YES" as const,
          negativeSelection: "NO" as const,
        };

  if (positiveOnRight) {
    return {
      left: leftLabel ?? base.negativeLabel,
      right: rightLabel ?? base.positiveLabel,
      leftSelection: base.negativeSelection,
      rightSelection: base.positiveSelection,
    };
  }

  return {
    left: leftLabel ?? base.positiveLabel,
    right: rightLabel ?? base.negativeLabel,
    leftSelection: base.positiveSelection,
    rightSelection: base.negativeSelection,
  };
};

export function MarketCard({
  market,
  onPick,
  leftLabel,
  rightLabel,
  variant = "f1",
  compact = false,
  showSportTag = true,
  positiveOnRight = false,
  selectedSelection,
}: Props) {
  const copy = sideCopy(market.market_type, leftLabel, rightLabel, positiveOnRight);
  const freshnessMs = Date.now() - market.timestamps.updated_at_ms;
  const liveLabel = freshnessMs < 4_000 ? "LIVE" : freshnessMs < 15_000 ? "ACTIVE" : "";
  const liveColor = freshnessMs < 4_000 ? colors.accentGreen : freshnessMs < 15_000 ? colors.accentBlue : colors.muted;
  const prevYesRef = useRef(market.prices.yes);
  const [trend, setTrend] = useState<"up" | "down" | "flat">("flat");

  useEffect(() => {
    if (market.prices.yes > prevYesRef.current) setTrend("up");
    if (market.prices.yes < prevYesRef.current) setTrend("down");
    if (market.prices.yes === prevYesRef.current) setTrend("flat");
    prevYesRef.current = market.prices.yes;
  }, [market.prices.yes]);

  const gradient = useMemo(
    () =>
      variant === "stocks"
        ? (["#1b1326", "#0d121e"] as const)
        : (["#0f1f32", "#0a111b"] as const),
    [variant],
  );

  const trendText = trend === "up" ? "YES PRICE RISING" : trend === "down" ? "YES PRICE FALLING" : "PRICE STABLE";
  const leftSelected = selectedSelection === copy.leftSelection;
  const rightSelected = selectedSelection === copy.rightSelection;
  const leftPositive = copy.leftSelection === "YES" || copy.leftSelection === "HIGHER";
  const rightPositive = copy.rightSelection === "YES" || copy.rightSelection === "HIGHER";

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View style={styles.tagsRow}>
          {showSportTag ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{market.sport}</Text>
            </View>
          ) : null}
          <View style={[styles.tag, styles.tagStatus]}>
            <Text style={styles.tagText}>{market.status.toUpperCase()}</Text>
          </View>
        </View>
        {liveLabel ? (
          <View style={styles.liveWrap}>
            <View style={[styles.pulse, { backgroundColor: liveColor }]} />
            <Text style={[styles.liveText, { color: liveColor }]}>{liveLabel}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.question, compact && styles.questionCompact]}>{market.question}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{trendText}</Text>
        <Text style={styles.metaText}>{market.status.toUpperCase()}</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={[
            styles.sideBtn,
            leftPositive ? styles.sidePositive : styles.sideNegative,
            compact && styles.sideBtnCompact,
            leftSelected && styles.sideBtnSelected,
            leftSelected && (leftPositive ? styles.sideBtnSelectedPositive : styles.sideBtnSelectedNegative),
          ]}
          onPress={() => onPick(market, copy.leftSelection)}
        >
          <Text style={styles.sideLabel}>{copy.left}</Text>
          <Text style={[styles.sidePrice, compact && styles.sidePriceCompact]}>{Math.round(market.prices.yes * 100)}%</Text>
        </Pressable>

        <Pressable
          style={[
            styles.sideBtn,
            rightPositive ? styles.sidePositive : styles.sideNegative,
            compact && styles.sideBtnCompact,
            rightSelected && styles.sideBtnSelected,
            rightSelected && (rightPositive ? styles.sideBtnSelectedPositive : styles.sideBtnSelectedNegative),
          ]}
          onPress={() => onPick(market, copy.rightSelection)}
        >
          <Text style={styles.sideLabel}>{copy.right}</Text>
          <Text style={[styles.sidePrice, compact && styles.sidePriceCompact]}>{Math.round(market.prices.no * 100)}%</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tagsRow: {
    flexDirection: "row",
    gap: 8,
  },
  tag: {
    backgroundColor: "#1a2940",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagStatus: {
    backgroundColor: "#1a3a35",
  },
  tagText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  liveWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.accentGreen,
  },
  liveText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  question: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
  },
  questionCompact: {
    fontSize: 18,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  sideBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sideBtnCompact: {
    paddingVertical: 8,
  },
  sideBtnSelected: {
    transform: [{ scale: 1.04 }],
  },
  sideBtnSelectedPositive: {
    borderColor: "#4fe6aa",
    backgroundColor: "#134238",
  },
  sideBtnSelectedNegative: {
    borderColor: "#ff7c9a",
    backgroundColor: "#4a1f30",
  },
  sidePositive: {
    backgroundColor: "#0f3730",
    borderColor: "#2ca678",
  },
  sideNegative: {
    backgroundColor: "#3a1a26",
    borderColor: "#b74c69",
  },
  sideLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  sidePrice: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 2,
  },
  sidePriceCompact: {
    fontSize: 24,
  },
});
