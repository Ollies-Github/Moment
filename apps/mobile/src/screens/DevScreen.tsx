import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { api } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import { colors } from "../theme/tokens";

export function DevScreen() {
  const { markets, connection, setMarkets } = useAppStore();

  const firstOpen = markets.find((m) => m.status === "open");
  const firstClosed = markets.find((m) => m.status === "closed");

  const refresh = async () => {
    setMarkets(await api.getLiveMarkets());
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 14, gap: 10 }}>
      <Text style={styles.title}>Dev</Text>
      <Text style={styles.meta}>Connection: {connection}</Text>
      <Text style={styles.meta}>Markets: {markets.length}</Text>

      <Pressable style={styles.btn} onPress={() => api.triggerStarter()}>
        <Text style={styles.btnText}>Trigger Starter Event</Text>
      </Pressable>

      <Pressable style={styles.btn} onPress={() => firstOpen && api.closeMarket(firstOpen.market_id)}>
        <Text style={styles.btnText}>Close First Open Market</Text>
      </Pressable>

      <Pressable
        style={styles.btn}
        onPress={() => {
          const target = firstClosed ?? firstOpen;
          if (target) api.settleMarket(target.market_id);
        }}
      >
        <Text style={styles.btnText}>Settle First Closed/Open Market</Text>
      </Pressable>

      <Pressable style={styles.btn} onPress={() => api.reset()}>
        <Text style={styles.btnText}>Reset Simulation</Text>
      </Pressable>

      <Pressable style={styles.btn} onPress={refresh}>
        <Text style={styles.btnText}>Refresh Markets</Text>
      </Pressable>

      <View style={styles.block}>
        {markets.map((m) => (
          <View key={m.market_id} style={styles.row}>
            <Text style={styles.rowText}>{m.question}</Text>
            <Text style={styles.rowMeta}>{m.status}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  meta: {
    color: colors.muted,
  },
  btn: {
    backgroundColor: "#17324f",
    padding: 12,
    borderRadius: 10,
  },
  btnText: {
    color: colors.text,
    fontWeight: "700",
  },
  block: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    marginTop: 8,
  },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: 10,
  },
  rowText: {
    color: colors.text,
    fontWeight: "600",
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 12,
  },
});
