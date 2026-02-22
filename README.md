# Moment

- `apps/api` (Fastify + socket.io)
- `apps/mobile` (Expo SDK 54)

## Install
From the project root:

```bash
pnpm run setup
```

## Run
Terminal A:

```bash
pnpm run dev
```

Optional API tuning:

```bash
AMM_VIRTUAL_LIQUIDITY=120 pnpm --dir apps/api dev
```

## iPhone (Expo Go)
1. Install Expo Go (SDK 54).
2. Keep iPhone and Mac on the same Wi-Fi.
3. Run `pnpm --dir apps/mobile dev` and scan the QR.

If phone cannot reach API:

```bash
EXPO_PUBLIC_API_BASE_URL=http://<YOUR_MAC_LAN_IP>:4000 pnpm --dir apps/mobile dev
```

## Current mobile tabs
- Sports
- Stocks
- Profile
- Dev

## API endpoints in use
- `POST /auth/register`
- `POST /auth/login`
- `GET /markets/live`
- `GET /markets/:marketId`
- `POST /quotes`
- `POST /picks`
- `GET /picks/:userId`
- `GET /users/:userId`
- `GET /users/:userId/wallet`
- `POST /users/:userId/funds/add`
- `POST /users/:userId/funds/withdraw`
- `GET /events/stream-status`
- `POST /dev/simulate/starter-event`
- `POST /dev/simulate/close-market`
- `POST /dev/simulate/settle-market`
- `POST /dev/simulate/reset`
- `POST /starter/events`
- `POST /scanner/events`
- `POST /closer/resolutions`

## Stock scanner JSON (supported)
You can post either direct signal JSON or lifecycle JSON to `POST /scanner/events`.

Direct stock create:

```json
{
  "event_id": "stk_evt_001",
  "signal_type": "create_bet",
  "sport": "Stocks",
  "session_id": "stocks-nyse-2026-02-22",
  "timestamp_ms": 1771758600000,
  "market_id": "mkt_stocks_tsla_001",
  "market_key": "tsla_intraday_5m",
  "symbol": "TSLA",
  "close_at_ms": 1771758900000,
  "confidence": 0.99,
  "cooldown_key": "stocks:TSLA:mkt_stocks_tsla_001"
}
```

Lifecycle format (`event_created`, `event_active`, `event_closed`) from scanner streams is also accepted.
For Stocks:
- market stays open and keeps updating on `event_active`
- market closes exactly at JSON close time (`close_at_ms` / `expires_at` / `settle_at`)
- once closed, server settles immediately (no delay, no random oracle path)

## WebSocket events
- `market.opened`
- `market.updated`
- `market.closed`
- `market.settled`
- `market.suspended`
- `bet.accepted`
- `bet.updated`
- `bet.rejected`
- `wallet.updated`
- `connection.state`
