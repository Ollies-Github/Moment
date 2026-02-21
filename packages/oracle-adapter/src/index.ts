import type { OracleSettlementResult, Selection } from "@moment/shared";

export interface OracleAdapter {
  confirmOutcome(marketId: string, proposedOutcome: Selection): Promise<OracleSettlementResult>;
}

export interface MockOracleAdapterOptions {
  reliability?: number;
  latencyMs?: number;
  random?: () => number;
}

export class MockOracleAdapter implements OracleAdapter {
  private readonly reliability: number;
  private readonly latencyMs: number;
  private readonly random: () => number;

  constructor(options: MockOracleAdapterOptions = {}) {
    this.reliability = options.reliability ?? 0.95;
    this.latencyMs = options.latencyMs ?? 500;
    this.random = options.random ?? Math.random;
  }

  async confirmOutcome(marketId: string, proposedOutcome: Selection): Promise<OracleSettlementResult> {
    await new Promise((resolve) => setTimeout(resolve, this.latencyMs));

    const confirmed = this.random() <= this.reliability;

    return {
      market_id: marketId,
      proposed_outcome: proposedOutcome,
      confirmed,
      outcome: confirmed ? proposedOutcome : undefined,
      settled_at_ms: Date.now(),
      source: "mock_oracle_adapter",
      reliability: this.reliability,
    };
  }
}
