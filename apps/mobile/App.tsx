import { useEffect } from "react";

import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppNavigator } from "./src/navigation/AppNavigator";
import { api } from "./src/services/api";
import { connectSocket } from "./src/services/socket";
import { useAppStore } from "./src/store/useAppStore";

export default function App() {
  const userId = useAppStore((s) => s.userId);
  const setMarkets = useAppStore((s) => s.setMarkets);
  const setBets = useAppStore((s) => s.setBets);
  const setWallet = useAppStore((s) => s.setWallet);
  const setConnection = useAppStore((s) => s.setConnection);
  const upsertMarket = useAppStore((s) => s.upsertMarket);
  const upsertBet = useAppStore((s) => s.upsertBet);

  useEffect(() => {
    let dead = false;

    const bootstrap = async () => {
      setConnection("connecting");
      try {
        const [markets, bets, wallet] = await Promise.all([
          api.getLiveMarkets(),
          api.getBets(userId),
          api.getWallet(userId),
        ]);
        if (dead) return;
        setMarkets(markets);
        setBets(bets);
        setWallet(wallet);
      } catch {
        if (!dead) setConnection("disconnected");
      }
    };

    void bootstrap();

    const socket = connectSocket({
      onConnection: (state) => setConnection(state),
      onMarket: (market) => upsertMarket(market),
      onBet: (bet) => {
        if (bet.user_id === userId) upsertBet(bet);
      },
      onWallet: (wallet) => {
        if (wallet.user_id === userId) setWallet(wallet);
      },
    });

    return () => {
      dead = true;
      socket.disconnect();
    };
  }, [setBets, setConnection, setMarkets, setWallet, upsertBet, upsertMarket, userId]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer theme={DarkTheme}>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
