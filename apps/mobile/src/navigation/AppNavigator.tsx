import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { BetsScreen } from "../screens/BetsScreen";
import { DevScreen } from "../screens/DevScreen";
import { FeedScreen } from "../screens/FeedScreen";
import { colors } from "../theme/tokens";

const Tabs = createBottomTabNavigator();

export function AppNavigator() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0f172a",
          borderTopColor: "#1f2937",
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarIcon: ({ color, size }) => {
          const name = route.name === "Feed" ? "flash" : route.name === "Bets" ? "stats-chart" : "construct";
          return <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Feed" component={FeedScreen} />
      <Tabs.Screen name="Bets" component={BetsScreen} />
      <Tabs.Screen name="Dev" component={DevScreen} />
    </Tabs.Navigator>
  );
}
