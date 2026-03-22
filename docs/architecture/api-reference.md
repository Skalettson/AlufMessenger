# API Reference — Aluf Messenger

This repository includes **machine-readable API descriptions** for understanding how the product behaves. Public deployments use operator-specific endpoints; those are **not** documented here.

## REST API

- **OpenAPI 3.0:** [`docs/api/openapi.yaml`](../api/openapi.yaml)

Use this file to understand resources, request/response shapes, and authentication expectations at a high level.

## Bot API

- **OpenAPI 3.0:** [`docs/api/bot-api.yaml`](../api/bot-api.yaml)

Bot HTTP methods follow a Telegram Bot API–style surface (e.g. `getMe`, `sendMessage`, webhooks). Tokens are issued in the client app; treat them as secrets.

## gRPC

- **Protobuf definitions:** [`packages/proto/`](../../packages/proto/)

Service and message names describe internal boundaries between components. Wire addresses and ports depend on deployment and are not part of this publication.

## WebSocket

The realtime layer exchanges JSON envelopes with an `event` name and a `data` payload. Typical directions:

| Event (examples) | Direction | Purpose |
|------------------|-----------|---------|
| `auth` | Client → Server | Session establishment |
| `message.send` / `message.new` | Both | Messaging |
| `typing` | Both | Typing indicators |
| `presence` / `presence.update` | Both | Online status |
| `call.signal` | Both | WebRTC signaling metadata |

Exact URLs and authentication flows are defined by the environment running the software.

## Source maps in code

- HTTP routes: [`apps/api-gateway/src/routes/`](../../apps/api-gateway/src/routes/)
- WebSocket gateway: [`apps/realtime-service/src/gateway/`](../../apps/realtime-service/src/gateway/)
