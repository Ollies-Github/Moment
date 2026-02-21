import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../services/api";
import { colors } from "../theme/tokens";
import type { BetQuote, Market, Selection } from "../types/contracts";

type Props = {
  visible: boolean;
  market?: Market;
  selection?: Selection;
  userId: string;
  onClose: () => void;
  onDone: () => Promise<void>;
};

const stakes = [1, 2, 5, 10];

export function StakeModal({ visible, market, selection, userId, onClose, onDone }: Props) {
  const [stake, setStake] = useState(2);
  const [quote, setQuote] = useState<BetQuote>();
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!visible || !market || !selection) return;

    let dead = false;
    const run = async () => {
      setLoadingQuote(true);
      setError(undefined);
      try {
        const q = await api.quote({ user_id: userId, market_id: market.market_id, selection, stake });
        if (!dead) setQuote(q);
      } catch (e) {
        if (!dead) setError(e instanceof Error ? e.message : "Quote failed");
      } finally {
        if (!dead) setLoadingQuote(false);
      }
    };

    void run();
    return () => {
      dead = true;
    };
  }, [visible, market, selection, userId, stake]);

  const onConfirm = async () => {
    if (!market || !selection) return;
    setSubmitting(true);
    setError(undefined);

    try {
      await api.placeBet({ user_id: userId, market_id: market.market_id, selection, stake });
      await onDone();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bet failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Quick Stake</Text>
          <Text style={styles.subtitle}>{market?.question ?? "No market"}</Text>
          <Text style={styles.selection}>{selection ?? ""}</Text>

          <View style={styles.row}>
            {stakes.map((s) => (
              <Pressable key={s} style={[styles.pill, stake === s && styles.pillActive]} onPress={() => setStake(s)}>
                <Text style={styles.pillText}>{s}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.quoteBox}>
            {loadingQuote ? (
              <ActivityIndicator color={colors.accent} />
            ) : quote ? (
              <>
                <Text style={styles.quoteText}>Price: {(quote.estimated_price * 100).toFixed(1)}%</Text>
                <Text style={styles.quoteText}>Payout: {quote.potential_payout.toFixed(2)}</Text>
                <Text style={styles.quoteText}>Fee: {quote.fee.toFixed(2)}</Text>
              </>
            ) : (
              <Text style={styles.quoteText}>No quote.</Text>
            )}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.row}>
            <Pressable style={[styles.action, styles.cancel]} onPress={onClose}>
              <Text style={styles.actionText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.action, styles.confirm]} onPress={onConfirm} disabled={submitting || !quote}>
              <Text style={styles.actionText}>{submitting ? "Placing..." : "Confirm"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
  },
  selection: {
    color: colors.good,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#0f172a",
  },
  pillActive: {
    borderColor: colors.accent,
    backgroundColor: "#17324f",
  },
  pillText: {
    color: colors.text,
    fontWeight: "700",
  },
  quoteBox: {
    minHeight: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    justifyContent: "center",
    gap: 4,
  },
  quoteText: {
    color: colors.text,
  },
  error: {
    color: colors.bad,
  },
  action: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  cancel: {
    backgroundColor: "#243041",
  },
  confirm: {
    backgroundColor: colors.good,
  },
  actionText: {
    color: "#fff",
    fontWeight: "800",
  },
});
