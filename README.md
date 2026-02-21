# Moment MVP (Clean Reset)

This is a clean rewrite with only:
- `apps/api` (Fastify + socket.io backend)
- `apps/mobile` (Expo SDK 54 app)

## 1) Install

From repo root:

```bash
pnpm install
pnpm setup
```

## 2) Run

Terminal A:

```bash
pnpm dev:api
```

Terminal B:

```bash
pnpm dev:mobile
```

## 3) iPhone (Expo Go)

- Install Expo Go (SDK 54 compatible version).
- Keep Mac + iPhone on same Wi-Fi.
- Scan QR from `pnpm dev:mobile`.

If API is not reachable from phone:

```bash
EXPO_PUBLIC_API_BASE_URL=http://<YOUR_MAC_LAN_IP>:4000 pnpm dev:mobile
```

## API endpoints

- `GET /health`
- `GET /markets/live`
- `GET /markets/:marketId`
- `POST /quotes`
- `POST /bets`
- `GET /bets/:userId`
- `GET /users/:userId/wallet`
- `GET /events/stream-status`
- `POST /dev/simulate/starter-event`
- `POST /dev/simulate/close-market`
- `POST /dev/simulate/settle-market`
- `POST /dev/simulate/reset`

## WebSocket events

- `market.opened`
- `market.updated`
- `market.closed`
- `market.settled`
- `market.suspended`
- `bet.accepted`
- `bet.rejected`
- `wallet.updated`
- `connection.state`
