import type { TypedEventBus } from "@moment/event-bus";
import type { BetCloseTrigger, EngineEventMap } from "@moment/shared";

export interface TriggerCloseOptions {
  reason?: string;
  closer_key?: string;
}

export class MockBetCloserService {
  private readonly bus: TypedEventBus<EngineEventMap>;

  constructor(bus: TypedEventBus<EngineEventMap>) {
    this.bus = bus;
  }

  triggerClose(marketId: string, options: TriggerCloseOptions = {}): BetCloseTrigger {
    const payload: BetCloseTrigger = {
      market_id: marketId,
      reason: options.reason ?? "watcher_signal",
      triggered_at_ms: Date.now(),
      closer_key: options.closer_key ?? "mock_closer_v1",
    };

    this.bus.emit("closer.triggered", payload);
    return payload;
  }

  scheduleClose(marketId: string, delayMs: number, options: TriggerCloseOptions = {}): NodeJS.Timeout {
    return setTimeout(() => {
      this.triggerClose(marketId, { ...options, reason: options.reason ?? "scheduled_timeout" });
    }, delayMs);
  }
}
