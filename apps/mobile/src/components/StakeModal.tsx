import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { api } from "../services/api";
import { colors, layout } from "../theme/tokens";
import type { Market, Selection } from "../types/contracts";

type Props = {
  visible: boolean;
  market?: Market;
  selection?: Selection;
  userId: string;
  onClose: () => void;
  onDone: () => Promise<void>;
};

const PRESETS = [1, 5, 10] as const;

export function StakeModal({ visible, market, selection, userId, onClose, onDone }: Props) {
  const [amountInput, setAmountInput] = useState("1");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(1);
  const [submitState, setSubmitState] = useState<"idle" | "pending" | "rejected">("idle");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!visible) return;
    setAmountInput("1");
    setSelectedPreset(1);
    setError(undefined);
    setSubmitState("idle");
  }, [visible]);

  const onSelectPreset = (preset: number) => {
    setSelectedPreset(preset);
    setAmountInput(String(preset));
    setError(undefined);
  };

  const onChangeCustomAmount = (next: string) => {
    setAmountInput(next);
    const n = Number(next);
    setSelectedPreset(PRESETS.includes(n as (typeof PRESETS)[number]) ? n : null);
    setError(undefined);
  };

  const onConfirm = async () => {
    if (!market || !selection) return;
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setSubmitState("pending");
    setError(undefined);

    try {
      await api.placeBet({ user_id: userId, market_id: market.market_id, selection, stake: amount });
      await onDone();
      onClose();
    } catch (e) {
      setSubmitState("rejected");
      setError(e instanceof Error ? e.message : "Pick failed");
    }
  };

  const actionLabel = submitState === "pending" ? "Placing..." : submitState === "rejected" ? "Retry" : "Confirm";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Pick {selection ?? ""}</Text>

          <View style={styles.row}>
            {PRESETS.map((preset) => (
              <Pressable
                key={preset}
                style={[styles.preset, selectedPreset === preset && styles.presetSelected]}
                onPress={() => onSelectPreset(preset)}
              >
                <Text style={styles.presetText}>€{preset}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.amountWrap}>
            <Text style={styles.amountLabel}>Custom</Text>
            <View style={styles.amountRow}>
              <Text style={styles.euro}>€</Text>
              <TextInput
                value={amountInput}
                onChangeText={onChangeCustomAmount}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={styles.amountInput}
              />
            </View>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.row}>
            <Pressable style={[styles.action, styles.cancel]} onPress={onClose}>
              <Text style={styles.actionText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.action, styles.confirm]}
              onPress={onConfirm}
              disabled={submitState === "pending"}
            >
              <Text style={styles.actionText}>{actionLabel}</Text>
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
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: "rgba(3,7,13,0.75)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: layout.radiusLg,
    borderWidth: 1,
    borderColor: colors.border,
    width: "100%",
    maxWidth: 480,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  preset: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.radiusSm,
    backgroundColor: colors.bgElevated,
    paddingVertical: 10,
    alignItems: "center",
  },
  presetSelected: {
    borderColor: colors.accentBlue,
    backgroundColor: "#17304a",
  },
  presetText: {
    color: colors.text,
    fontWeight: "800",
  },
  amountWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: layout.radiusMd,
    padding: 10,
    gap: 6,
    backgroundColor: colors.bgElevated,
  },
  amountLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  euro: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  amountInput: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    paddingVertical: 0,
    flex: 1,
  },
  error: {
    color: colors.bad,
    fontSize: 12,
    fontWeight: "700",
  },
  action: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: layout.radiusSm,
    alignItems: "center",
  },
  cancel: {
    backgroundColor: "#1d2a3f",
  },
  confirm: {
    backgroundColor: "#1f5f8f",
  },
  actionText: {
    color: "#fff",
    fontWeight: "800",
  },
});
