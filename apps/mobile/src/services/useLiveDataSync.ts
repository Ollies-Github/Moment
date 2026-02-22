import { useEffect } from "react";

import type { Market } from "@moment/shared";

import { api } from "./api";
import { createSocketClient } from "./socket";
import { useAppStore } from "../store/useAppStore";

const mockSeededMarkets = (): Market[] => {
  const now = Date.now();
  return [
    {
      market_id: "mock-fallback-1",
      sport: "Football",
      session_id: "fallback",
      market_type: "binary_yes_no",
      question: "Will this goal stand after review?",
      context: { mode: "fallback" },
      open_at_ms: now,
      settlement_key: "fallback_goal_review",
      starter_event_id: "fallback-1",
      market_making: {
        model: "binary_amm",
        initial_probability_yes: 0.58,
        virtual_liquidity: 1000,
        fee_bps: 120,
      },
      close_control: {
        mode: "backend_signal",
        closer_key: "fallback",
      },
      status: "open",
      amm_state: {
        yes_pool: 580,
        no_pool: 420,
        virtual_liquidity: 1000,
        fee_bps: 120,
        total_fees_collected: 0,
        total_volume: 0,
        trade_count: 0,
      },
      prices: {
        yes: 0.58,
        no: 0.42,
      },
      timestamps: {
        open_at_ms: now,
        updated_at_ms: now,
      },
      safety: {
        max_open_duration_ms: 90_000,
        expires_at_ms: now + 90_000,
        timeout_triggered: false,
      },
    },
  ];
};

export const useLiveDataSync = (): void => {
  const {
    userId,
    useMockFallback,
    setMarkets,
    setBets,
    setWallet,
    setConnectionState,
    upsertMarket,
    upsertBet,
    setBetRejection,
    setDataMode,
  } = useAppStore();

  useEffect(() => {
    let disposed = false;

    const bootstrap = async () => {
      setConnectionState("connecting");
      try {
        const [markets, wallet, bets] = await Promise.all([
          api.getLiveMarkets(),
          api.getWallet(userId),
          api.getBets(userId),
        ]);

        if (disposed) return;

        setMarkets(markets);
        setWallet(wallet);
        setBets(bets);
        setDataMode("backend");
      } catch {
        if (disposed) return;
        if (useMockFallback) {
          setMarkets(mockSeededMarkets());
          setConnectionState("disconnected");
          setDataMode("mock");
        } else {
          setConnectionState("disconnected");
        }
      }
    };

    void bootstrap();

    if (useMockFallback) {
      return () => {
        disposed = true;
      };
    }

    const socket = createSocketClient({
      onConnectState: (payload) => setConnectionState(payload.state),
      onMarketOpened: (market) => upsertMarket(market),
      onMarketUpdated: (market) => upsertMarket(market),
      onMarketClosed: (market) => upsertMarket(market),
      onMarketSettled: async (market) => {
        upsertMarket(market);
        try {
          const [wallet, bets] = await Promise.all([api.getWallet(userId), api.getBets(userId)]);
          if (!disposed) {
            setWallet(wallet);
            setBets(bets);
          }
        } catch {
          // Non-blocking refresh path.
        }
      },
      onMarketSuspended: (market) => upsertMarket(market),
      onBetAccepted: (bet) => {
        if (bet.user_id === userId) {
          upsertBet(bet);
        }
      },
      onBetRejected: (payload) => {
        if (payload.user_id === userId) {
          setBetRejection(payload);
        }
      },
      onWalletUpdated: (wallet) => {
        if (wallet.user_id === userId) {
          setWallet(wallet);
        }
      },
    });

    return () => {
      disposed = true;
      socket.disconnect();
    };
  }, [
    setBets,
    setBetRejection,
    setConnectionState,
    setDataMode,
    setMarkets,
    setWallet,
    upsertBet,
    upsertMarket,
    useMockFallback,
    userId,
  ]);
};
