import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { useAppStore } from "../store/useAppStore";
import { colors, radii, spacing } from "../theme/tokens";

type BetFilter = "open" | "settled";

export function MyBetsScreen() {
  const [filter, setFilter] = useState<BetFilter>("open");
  const { bets, wallet, marketsById } = useAppStore();

  const filtered = useMemo(() => {
    if (filter === "open") {
      return bets.filter((bet) => bet.status === "accepted");
    }

    return bets.filter((bet) =>
      ["settled_won", "settled_lost", "voided"].includes(bet.status),
    );
  }, [bets, filter]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bets</Text>
        <Text style={styles.balance}>Balance: {wallet?.balance.toFixed(2) ?? "--"}</Text>
      </View>

      <View style={styles.filters}>
        <Pressable
          style={[styles.filterButton, filter === "open" && styles.filterActive]}
          onPress={() => setFilter("open")}
        >
          <Text style={styles.filterText}>Open</Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, filter === "settled" && styles.filterActive]}
          onPress={() => setFilter("settled")}
        >
          <Text style={styles.filterText}>Settled</Text>
        </Pressable>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.bet_id}
        renderItem={({ item }) => {
          const question = marketsById[item.market_id]?.question ?? item.market_id;
          return (
            <View style={styles.betCard}>
              <Text style={styles.betQuestion}>{question}</Text>
              <Text style={styles.betMeta}>Side: {item.selection}</Text>
              <Text style={styles.betMeta}>Stake: {item.stake.toFixed(2)}</Text>
              <Text style={styles.betMeta}>Accepted Price: {(item.accepted_price * 100).toFixed(1)}%</Text>
              <Text style={styles.betStatus}>{item.status.toUpperCase()}</Text>
              {item.status !== "accepted" ? (
                <Text style={styles.betPayout}>Payout: {(item.payout ?? 0).toFixed(2)}</Text>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No bets for this filter.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
  },
  balance: {
    color: colors.accentGreen,
    fontWeight: "700",
    fontSize: 14,
    marginTop: 8,
  },
  filters: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.bgElevated,
  },
  filterActive: {
    backgroundColor: "#16365a",
    borderColor: colors.accentBlue,
  },
  filterText: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  betCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  betQuestion: {
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: 4,
  },
  betMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  betStatus: {
    marginTop: spacing.sm,
    color: colors.accentBlue,
    fontWeight: "700",
  },
  betPayout: {
    marginTop: 6,
    color: colors.accentGreen,
    fontWeight: "700",
  },
  empty: {
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 50,
  },
});
