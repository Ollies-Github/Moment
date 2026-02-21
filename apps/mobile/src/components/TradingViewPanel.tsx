import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

import { colors } from "../theme/tokens";

type Props = {
  symbol: string;
  height?: number;
};

const buildChartUrl = (symbol: string): string => {
  const config = {
    symbol: `NASDAQ:${symbol}`,
    width: "100%",
    height: "100%",
    locale: "en",
    dateRange: "1D",
    colorTheme: "dark",
    trendLineColor: "#38d2ff",
    underLineColor: "rgba(61, 255, 157, 0.22)",
    underLineBottomColor: "rgba(61, 255, 157, 0.02)",
    isTransparent: false,
    autosize: true,
    largeChartUrl: "",
  };
  const hash = encodeURIComponent(JSON.stringify(config));
  return `https://www.tradingview.com/embed-widget/mini-symbol-overview/?locale=en#${hash}`;
};

export function TradingViewPanel({ symbol, height = 280 }: Props) {
  const chartUrl = useMemo(() => buildChartUrl(symbol), [symbol]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.wrap}>
      {failed ? (
        <View style={[styles.errorWrap, { height }]}>
          <Text style={styles.errorText}>Unable to load TradingView in WebView.</Text>
          <Text style={styles.errorHint}>Check network and try reloading the app.</Text>
        </View>
      ) : (
        <View style={{ height }}>
          {loading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={colors.accentBlue} />
            </View>
          ) : null}
          <WebView
            source={{ uri: chartUrl }}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            scrollEnabled={false}
            bounces={false}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => setFailed(true)}
            onHttpError={() => setFailed(true)}
            style={styles.webview}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1d2b3f",
    backgroundColor: "#090f1a",
  },
  webview: {
    flex: 1,
    backgroundColor: "#090f1a",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(9,15,26,0.45)",
  },
  errorWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 4,
    backgroundColor: colors.bgElevated,
  },
  errorText: {
    color: colors.text,
    fontWeight: "700",
    textAlign: "center",
  },
  errorHint: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
  },
});
