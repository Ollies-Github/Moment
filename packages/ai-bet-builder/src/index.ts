import { randomUUID } from "node:crypto";

import type { BetStarterEvent, MarketOpenPayload, MarketType, Sport } from "@moment/shared";

interface MarketTemplate {
  marketType: MarketType;
  question: (event: BetStarterEvent) => string;
  context: (event: BetStarterEvent) => Record<string, unknown>;
}

const bySportTemplate: Record<Sport, Record<string, MarketTemplate>> = {
  F1: {
    overtake_attempt: {
      marketType: "binary_yes_no",
      question: () => "Will Norris overtake Verstappen this lap?",
      context: (event) => ({
        driver_a: "Norris",
        driver_b: "Verstappen",
        lap_window: "current",
        source_event_type: event.event_type,
      }),
    },
    pit_window_call: {
      marketType: "binary_higher_lower",
      question: () => "Will this pit stop be under 2.5s?",
      context: (event) => ({
        threshold_seconds: 2.5,
        source_event_type: event.event_type,
      }),
    },
    safety_car_restart: {
      marketType: "binary_yes_no",
      question: () => "Will there be contact on restart?",
      context: (event) => ({
        source_event_type: event.event_type,
      }),
    },
    drs_activation_window: {
      marketType: "binary_higher_lower",
      question: () => "Will the gap drop below 1.0s in this DRS window?",
      context: (event) => ({
        threshold_seconds: 1,
        source_event_type: event.event_type,
      }),
    },
  },
  Football: {
    goal_disallowed_candidate: {
      marketType: "binary_yes_no",
      question: () => "Will this goal be disallowed by VAR?",
      context: (event) => ({
        check_type: "foul_or_offside",
        source_event_type: event.event_type,
      }),
    },
    penalty_awarded: {
      marketType: "binary_yes_no",
      question: () => "Will the penalty go in?",
      context: (event) => ({
        source_event_type: event.event_type,
      }),
    },
    var_review: {
      marketType: "binary_yes_no",
      question: () => "Will the referee overturn the decision after review?",
      context: (event) => ({
        source_event_type: event.event_type,
      }),
    },
    set_piece_chance: {
      marketType: "binary_higher_lower",
      question: () => "Will this set piece generate xG above 0.15?",
      context: (event) => ({
        threshold_xg: 0.15,
        source_event_type: event.event_type,
      }),
    },
  },
};

const fallbackTemplate: MarketTemplate = {
  marketType: "binary_yes_no",
  question: (event) => `Will ${event.event_type.replaceAll("_", " ")} resolve in favor of YES?`,
  context: (event) => ({ source_event_type: event.event_type }),
};

const hashToProbability = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  const normalized = (hash % 31) / 100;
  return Math.min(0.65, Math.max(0.35, 0.5 + normalized - 0.15));
};

export interface MockBetBuilderOptions {
  defaultVirtualLiquidity?: number;
  defaultFeeBps?: number;
  closerKey?: string;
}

export class MockBetBuilderService {
  private readonly defaultVirtualLiquidity: number;
  private readonly defaultFeeBps: number;
  private readonly closerKey: string;

  constructor(options: MockBetBuilderOptions = {}) {
    this.defaultVirtualLiquidity = options.defaultVirtualLiquidity ?? 1000;
    this.defaultFeeBps = options.defaultFeeBps ?? 120;
    this.closerKey = options.closerKey ?? "mock_closer_v1";
  }

  buildMarketPayload(starterEvent: BetStarterEvent): MarketOpenPayload {
    const template =
      bySportTemplate[starterEvent.sport]?.[starterEvent.event_type] ??
      bySportTemplate[starterEvent.sport]?.[Object.keys(bySportTemplate[starterEvent.sport])[0]] ??
      fallbackTemplate;

    const marketId = `mkt_${starterEvent.sport.toLowerCase()}_${starterEvent.timestamp_ms}_${randomUUID().slice(0, 8)}`;

    return {
      market_id: marketId,
      sport: starterEvent.sport,
      session_id: starterEvent.session_id,
      market_type: template.marketType,
      question: template.question(starterEvent),
      context: {
        ...template.context(starterEvent),
        starter_context: starterEvent.context,
        generated_by: "mock_llm_builder",
      },
      open_at_ms: starterEvent.timestamp_ms,
      settlement_key: `${starterEvent.sport.toLowerCase()}_${starterEvent.event_type}`,
      starter_event_id: starterEvent.starter_event_id,
      market_making: {
        model: "binary_amm",
        initial_probability_yes: hashToProbability(starterEvent.starter_event_id),
        virtual_liquidity: this.defaultVirtualLiquidity,
        fee_bps: this.defaultFeeBps,
      },
      close_control: {
        mode: "backend_signal",
        closer_key: this.closerKey,
      },
    };
  }
}
