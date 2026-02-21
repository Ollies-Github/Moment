import type { Bet, BetQuote, BetRequest, Market, Selection, Wallet } from "../types/contracts";
import { API_URL } from "../utils/network";

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const req = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Request failed", res.status);
  }

  return data as T;
};

export const api = {
  getLiveMarkets: () => req<Market[]>("/markets/live"),
  getMarket: (marketId: string) => req<Market>(`/markets/${marketId}`),
  getBets: (userId: string) => req<Bet[]>(`/bets/${userId}`),
  getWallet: (userId: string) => req<Wallet>(`/users/${userId}/wallet`),
  quote: (payload: BetRequest) =>
    req<BetQuote>("/quotes", { method: "POST", body: JSON.stringify(payload) }),
  placeBet: (payload: BetRequest) =>
    req<Bet>("/bets", { method: "POST", body: JSON.stringify(payload) }),
  triggerStarter: (payload?: {
    sport?: "F1" | "Stocks";
    event_type?: string;
    session_id?: string;
    context?: Record<string, unknown>;
  }) =>
    req("/dev/simulate/starter-event", {
      method: "POST",
      body: JSON.stringify(payload ?? {}),
    }),
  closeMarket: (marketId: string) =>
    req("/dev/simulate/close-market", { method: "POST", body: JSON.stringify({ market_id: marketId }) }),
  settleMarket: (marketId: string, outcome?: Selection) =>
    req("/dev/simulate/settle-market", {
      method: "POST",
      body: JSON.stringify({ market_id: marketId, outcome }),
    }),
  reset: () => req("/dev/simulate/reset", { method: "POST", body: "{}" }),
};

export { ApiError };
