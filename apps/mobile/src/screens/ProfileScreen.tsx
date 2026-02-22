import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import { colors, gradients, layout } from "../theme/tokens";

export function ProfileScreen() {
  const { userId, account, wallet, bets, setWallet } = useAppStore();
  const [updatingFunds, setUpdatingFunds] = useState(false);
  const [error, setError] = useState<string>();

  const metrics = useMemo(() => {
    const picks = bets.filter((pick) => pick.status !== "rejected");
    return {
      total: picks.length,
      won: picks.filter((pick) => pick.status === "settled_won").length,
      lost: picks.filter((pick) => pick.status === "settled_lost").length,
    };
  }, [bets]);

  const onAddFunds = async () => {
    if (!userId) return;
    setUpdatingFunds(true);
    setError(undefined);
    try {
      const result = await api.addFunds(userId, 10);
      setWallet(result.wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add funds");
    } finally {
      setUpdatingFunds(false);
    }
  };

  const onWithdrawFunds = async () => {
    if (!userId) return;
    setUpdatingFunds(true);
    setError(undefined);
    try {
      const result = await api.withdrawFunds(userId, 10);
      setWallet(result.wallet);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to withdraw funds");
    } finally {
      setUpdatingFunds(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.content}>
        <Text style={styles.username}>{account?.username ?? "User"}</Text>
        <Text style={styles.title}>Profile</Text>

        <LinearGradient colors={gradients.cardSports} style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>EUR {wallet?.balance.toFixed(2) ?? "0.00"}</Text>
        </LinearGradient>

        <View style={styles.metricsCard}>
          <Text style={styles.blockTitle}>Lifetime Metrics</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Total</Text>
              <Text style={styles.metricValue}>{metrics.total}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Won</Text>
              <Text style={[styles.metricValue, { color: colors.good }]}>{metrics.won}</Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Lost</Text>
              <Text style={[styles.metricValue, { color: colors.bad }]}>{metrics.lost}</Text>
            </View>
          </View>
        </View>

        <View style={styles.fundsCard}>
          <Text style={styles.blockTitle}>Funds</Text>
          <View style={styles.fundsRow}>
            <Pressable style={[styles.button, styles.addButton]} onPress={onAddFunds} disabled={updatingFunds}>
              <Text style={styles.buttonText}>{updatingFunds ? "Updating..." : "Add Funds"}</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.withdrawButton]} onPress={onWithdrawFunds} disabled={updatingFunds}>
              <Text style={styles.buttonText}>Withdraw Funds</Text>
            </Pressable>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: 14,
    gap: 14,
  },
  username: {
    color: colors.text,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  title: {
    color: colors.muted,
    fontSize: 30,
    fontWeight: "800",
  },
  totalCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.radiusLg,
    padding: 14,
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  totalLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  totalValue: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  metricsCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.radiusLg,
    padding: 14,
    backgroundColor: colors.card,
    gap: 10,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  metricBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.radiusSm,
    backgroundColor: colors.bgElevated,
    paddingVertical: 10,
    alignItems: "center",
    gap: 4,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  fundsCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.radiusLg,
    padding: 14,
    backgroundColor: colors.card,
    gap: 10,
  },
  fundsRow: {
    flexDirection: "row",
    gap: 8,
  },
  blockTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  button: {
    flex: 1,
    borderWidth: 1,
    borderRadius: layout.radiusSm,
    paddingVertical: 10,
    alignItems: "center",
  },
  addButton: {
    borderColor: "#439f76",
    backgroundColor: "#1d4637",
  },
  withdrawButton: {
    borderColor: "#b8566f",
    backgroundColor: "#4b2532",
  },
  buttonText: {
    color: colors.text,
    fontWeight: "800",
  },
  error: {
    color: colors.bad,
    fontSize: 12,
    fontWeight: "600",
  },
});
