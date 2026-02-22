import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { BetQuoteResponse, Market, Selection } from "@moment/shared";

import { api, ApiError } from "../services/api";
import { colors, radii, spacing } from "../theme/tokens";

interface QuickStakeModalProps {
  visible: boolean;
  market?: Market;
  selection?: Selection;
  userId: string;
  onClose: () => void;
  onPlaced: () => Promise<void>;
}

const presets = [1, 2, 5, 10];

export function QuickStakeModal({
  visible,
  market,
  selection,
  userId,
  onClose,
  onPlaced,
}: QuickStakeModalProps) {
  const [stake, setStake] = useState<number>(2);
  const [quote, setQuote] = useState<BetQuoteResponse | undefined>();
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const canQuote = Boolean(market && selection && visible);

  useEffect(() => {
    if (!canQuote || !market || !selection) {
      return;
    }

    let disposed = false;

    const loadQuote = async () => {
      setQuoting(true);
      setError(undefined);
      try {
        const nextQuote = await api.quote({
          user_id: userId,
          market_id: market.market_id,
          selection,
          stake,
        });
        if (!disposed) {
          setQuote(nextQuote);
        }
      } catch (err) {
        if (!disposed) {
          setQuote(undefined);
          setError(err instanceof Error ? err.message : "Failed to quote");
        }
      } finally {
        if (!disposed) {
          setQuoting(false);
        }
      }
    };

    void loadQuote();

    return () => {
      disposed = true;
    };
  }, [canQuote, market, selection, stake, userId]);

  const submitDisabled = useMemo(() => !quote || submitting || quoting, [quote, submitting, quoting]);

  const onConfirm = async () => {
    if (!market || !selection || !quote) {
      return;
    }

    setSubmitting(true);
    setError(undefined);

    try {
      const result = await api.placeBet({
        user_id: userId,
        market_id: market.market_id,
        selection,
        stake,
      });

      if (result.status === "rejected") {
        setError(result.rejection_reason ?? "Bet rejected");
        return;
      }

      await onPlaced();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to place bet");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Quick Stake</Text>
          <Text style={styles.subtitle}>{market?.question ?? "No market selected"}</Text>
          <Text style={styles.selection}>{selection ? `Selection: ${selection}` : ""}</Text>

          <View style={styles.presetRow}>
            {presets.map((preset) => (
              <Pressable
                key={preset}
                style={[styles.presetButton, stake === preset && styles.presetButtonActive]}
                onPress={() => setStake(preset)}
              >
                <Text style={styles.presetLabel}>{preset}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.quoteCard}>
            {quoting ? (
              <ActivityIndicator color={colors.accentBlue} />
            ) : quote ? (
              <>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Current Price</Text>
                  <Text style={styles.quoteValue}>{(quote.estimated_price * 100).toFixed(1)}%</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Potential Payout</Text>
                  <Text style={styles.quoteValue}>{quote.potential_payout.toFixed(2)}</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>Fee</Text>
                  <Text style={styles.quoteValue}>{quote.fee.toFixed(2)}</Text>
                </View>
              </>
            ) : (
              <Text style={styles.quoteLabel}>No quote available</Text>
            )}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actionsRow}>
            <Pressable style={[styles.actionBtn, styles.cancelBtn]} onPress={onClose}>
              <Text style={styles.actionText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtn, styles.confirmBtn, submitDisabled && styles.disabledBtn]}
              disabled={submitDisabled}
              onPress={onConfirm}
            >
              <Text style={styles.actionText}>{submitting ? "Pending..." : "Confirm"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2,6,11,0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontSize: 14,
  },
  selection: {
    color: colors.accentGreen,
    marginTop: spacing.sm,
    fontWeight: "700",
  },
  presetRow: {
    marginTop: spacing.lg,
    flexDirection: "row",
    gap: spacing.sm,
  },
  presetButton: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  presetButtonActive: {
    borderColor: colors.accentBlue,
    backgroundColor: "#152745",
  },
  presetLabel: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  quoteCard: {
    marginTop: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    backgroundColor: colors.bgCard,
    minHeight: 96,
    justifyContent: "center",
  },
  quoteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  quoteLabel: {
    color: colors.textSecondary,
  },
  quoteValue: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  errorText: {
    color: colors.danger,
    marginTop: spacing.sm,
  },
  actionsRow: {
    marginTop: spacing.lg,
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: "center",
  },
  cancelBtn: {
    backgroundColor: "#1c2637",
  },
  confirmBtn: {
    backgroundColor: colors.accentGreen,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  actionText: {
    color: "#f8fbff",
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
