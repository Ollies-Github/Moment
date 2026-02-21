import { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { MarketCard } from "../components/MarketCard";
import { StakeModal } from "../components/StakeModal";
import { api } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import { colors } from "../theme/tokens";

export function FeedScreen() {
  const {
    userId,
    markets,
    connection,
    modalOpen,
    modalMarket,
    modalSelection,
    openModal,
    closeModal,
    setMarkets,
    setBets,
    setWallet,
  } = useAppStore();

  const refresh = useCallback(async () => {
    const [nextMarkets, nextBets, nextWallet] = await Promise.all([
      api.getLiveMarkets(),
      api.getBets(userId),
      api.getWallet(userId),
    ]);

    setMarkets(nextMarkets);
    setBets(nextBets);
    setWallet(nextWallet);
  }, [setBets, setMarkets, setWallet, userId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Feed</Text>
        <Text style={styles.connection}>{connection.toUpperCase()}</Text>
      </View>

      <FlatList
        data={markets}
        keyExtractor={(item) => item.market_id}
        contentContainerStyle={{ padding: 14, gap: 10 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={colors.accent} />}
        renderItem={({ item }) => <MarketCard market={item} onPick={openModal} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No markets yet.</Text>
            <Pressable style={styles.emptyBtn} onPress={() => api.triggerStarter()}>
              <Text style={styles.emptyBtnText}>Trigger starter event</Text>
            </Pressable>
          </View>
        }
      />

      <StakeModal
        visible={modalOpen}
        market={modalMarket}
        selection={modalSelection}
        userId={userId}
        onClose={closeModal}
        onDone={refresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingTop: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  connection: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 12,
  },
  emptyWrap: {
    marginTop: 80,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    color: colors.muted,
  },
  emptyBtn: {
    backgroundColor: "#17324f",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnText: {
    color: colors.text,
    fontWeight: "700",
  },
});
