import { useCallback } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { Selection } from "@moment/shared";

import { MarketCard } from "../components/MarketCard";
import { QuickStakeModal } from "../components/QuickStakeModal";
import { api } from "../services/api";
import { useAppStore } from "../store/useAppStore";
import { colors, spacing } from "../theme/tokens";

interface LiveFeedScreenProps {
  onOpenMarketDetail: (marketId: string) => void;
}

export function LiveFeedScreen({ onOpenMarketDetail }: LiveFeedScreenProps) {
  const {
    marketsById,
    marketIds,
    marketDirections,
    ui,
    userId,
    connectionStatus,
    setMarkets,
    openStakeModal,
    closeStakeModal,
    setBets,
    setWallet,
  } = useAppStore();

  const refresh = useCallback(async () => {
    const [markets, bets, wallet] = await Promise.all([
      api.getLiveMarkets(),
      api.getBets(userId),
      api.getWallet(userId),
    ]);

    setMarkets(markets);
    setBets(bets);
    setWallet(wallet);
  }, [setBets, setMarkets, setWallet, userId]);

  const selectedMarket = ui.selectedMarketId ? marketsById[ui.selectedMarketId] : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>Live Feed</Text>
        <Text style={styles.connection}>{connectionStatus.toUpperCase()}</Text>
      </View>

      <FlatList
        data={marketIds}
        keyExtractor={(id) => id}
        renderItem={({ item }) => {
          const market = marketsById[item];
          if (!market) {
            return null;
          }

          return (
            <MarketCard
              market={market}
              direction={marketDirections[item]}
              onOpenDetails={onOpenMarketDetail}
              onSelect={(marketId, selection: Selection) => openStakeModal(marketId, selection)}
            />
          );
        }}
        pagingEnabled
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={colors.accentBlue} refreshing={false} onRefresh={refresh} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No live markets yet</Text>
            <Pressable style={styles.emptyButton} onPress={() => api.triggerStarterEvent()}>
              <Text style={styles.emptyButtonText}>Trigger starter event</Text>
            </Pressable>
          </View>
        }
      />

      <QuickStakeModal
        visible={ui.stakeModalOpen}
        market={selectedMarket}
        selection={ui.selectedSelection}
        userId={userId}
        onClose={closeStakeModal}
        onPlaced={refresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: spacing.md,
  },
  topBar: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
  },
  connection: {
    color: colors.accentBlue,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyWrap: {
    marginTop: 120,
    alignItems: "center",
    gap: spacing.md,
  },
  emptyTitle: {
    color: colors.textSecondary,
  },
  emptyButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: "#163052",
  },
  emptyButtonText: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
});
