import { randomUUID } from "node:crypto";

import type { TypedEventBus } from "@moment/event-bus";
import type { BetStarterEvent, EngineEventMap, Sport } from "@moment/shared";

export interface TriggerStarterOptions {
  sport?: Sport;
  event_type?: string;
  session_id?: string;
  context?: Record<string, unknown>;
}

export interface MockBetStarterOptions {
  intervalMs?: number;
}

const EVENT_TEMPLATES: Record<Sport, string[]> = {
  F1: [
    "overtake_attempt",
    "pit_window_call",
    "safety_car_restart",
    "drs_activation_window",
  ],
  Football: ["goal_disallowed_candidate", "penalty_awarded", "var_review", "set_piece_chance"],
};

const SPORTS: Sport[] = ["F1", "Football"];

const choose = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export class MockBetStarterService {
  private readonly bus: TypedEventBus<EngineEventMap>;
  private readonly intervalMs: number;
  private intervalHandle?: NodeJS.Timeout;

  constructor(bus: TypedEventBus<EngineEventMap>, options: MockBetStarterOptions = {}) {
    this.bus = bus;
    this.intervalMs = options.intervalMs ?? 0;
  }

  start(): void {
    if (this.intervalMs <= 0 || this.intervalHandle) {
      return;
    }

    this.intervalHandle = setInterval(() => {
      this.trigger();
    }, this.intervalMs);
  }

  stop(): void {
    if (!this.intervalHandle) {
      return;
    }

    clearInterval(this.intervalHandle);
    this.intervalHandle = undefined;
  }

  trigger(options: TriggerStarterOptions = {}): BetStarterEvent {
    const sport = options.sport ?? choose(SPORTS);
    const eventType = options.event_type ?? choose(EVENT_TEMPLATES[sport]);
    const starterEvent: BetStarterEvent = {
      starter_event_id: randomUUID(),
      sport,
      session_id: options.session_id ?? `${sport.toLowerCase()}-session-${Date.now()}`,
      event_type: eventType,
      timestamp_ms: Date.now(),
      context: {
        confidence: 0.82,
        source: "mock_cv_detector",
        ...options.context,
      },
    };

    this.bus.emit("starter.detected", starterEvent);
    return starterEvent;
  }
}
