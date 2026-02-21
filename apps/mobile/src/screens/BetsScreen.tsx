import { FlatList, StyleSheet, Text, View } from "react-native";

import { useAppStore } from "../store/useAppStore";
import { colors } from "../theme/tokens";

export function BetsScreen() {
  const { bets, wallet, markets } = useAppStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Bets</Text>
      <Text style={styles.balance}>Balance: {wallet?.balance.toFixed(2) ?? "--"}</Text>

      <FlatList
        data={bets}
        keyExtractor={(item) => item.bet_id}
        contentContainerStyle={{ paddingTop: 10, gap: 10 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.question}>
              {markets.find((m) => m.market_id === item.market_id)?.question ?? item.market_id}
            </Text>
            <Text style={styles.meta}>Side: {item.selection}</Text>
            <Text style={styles.meta}>Stake: {item.stake.toFixed(2)}</Text>
            <Text style={styles.meta}>Price: {(item.accepted_price * 100).toFixed(1)}%</Text>
            <Text style={styles.status}>{item.status.toUpperCase()}</Text>
            {item.status !== "accepted" ? (
              <Text style={styles.payout}>Payout: {(item.payout ?? 0).toFixed(2)}</Text>
            ) : null}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No bets yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 14,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  balance: {
    color: colors.good,
    fontWeight: "700",
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  question: {
    color: colors.text,
    fontWeight: "700",
    marginBottom: 6,
  },
  meta: {
    color: colors.muted,
    fontSize: 12,
  },
  status: {
    marginTop: 6,
    color: colors.accent,
    fontWeight: "700",
  },
  payout: {
    color: colors.good,
    fontWeight: "700",
    marginTop: 4,
  },
  empty: {
    color: colors.muted,
    textAlign: "center",
    marginTop: 50,
  },
});
