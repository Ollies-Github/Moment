import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { DevScreen } from "../screens/DevScreen";
import { F1Screen } from "../screens/F1Screen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { StocksScreen } from "../screens/StocksScreen";
import { colors } from "../theme/tokens";

const Tabs = createBottomTabNavigator();

export function AppNavigator() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgElevated,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accentBlue,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
        tabBarIcon: ({ color, size }) => {
          const name =
            route.name === "Sports"
              ? "speedometer"
              : route.name === "Stocks"
                ? "trending-up"
                : route.name === "Profile"
                  ? "person-circle"
                  : "construct";
          return <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="Sports" component={F1Screen} />
      <Tabs.Screen name="Stocks" component={StocksScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
      <Tabs.Screen name="Dev" component={DevScreen} />
    </Tabs.Navigator>
  );
}
