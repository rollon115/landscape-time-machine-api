# Landscape Time Machine API

A developer-facing HTTP API that turns a single landscape image into a validated
20-second LTX time-lapse, and exposes a future-ready Director stage for
assembling one to three approved clips.

Runs on **Cloudflare Workers**. Generation is delegated to the **Comfy
Developer Platform**.

## Status

| Capability | State |
| --- | --- |
| `GET /health` | Implemented |
| `POST /v1/assets` | Not implemented yet (LTM-002) |
| `POST /v1/timeshifts` | Not implemented yet (LTM-002) |
| `POST /v1/director` | Not implemented yet (LTM-002) |
| `GET /v1/jobs/:jobId` | Not implemented yet (LTM-002) |
| `POST /v1/jobs/:jobId/cancel` | Not implemented yet (LTM-002) |
| Director 3D composition | **Not live.** Reports `DIRECTOR_WORKFLOW_NOT_DEPLOYED` until a verified compositing workflow exists. |

## Requirements

- Node.js 22+
- A Comfy Cloud account and API key

## Local setup

```bash
npm install
cp .dev.vars.example .dev.vars   # then put your real key in .dev.vars
npm run dev                      # wrangler dev
```

The dev server listens on `http://localhost:8787` by default.

```bash
curl -s http://localhost:8787/health
# {"ok":true,"service":"landscape-time-machine","version":"0.1.0"}
```

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run cf-typegen  # regenerate worker-configuration.d.ts
```

## Configuration

| Name | Kind | Notes |
| --- | --- | --- |
| `COMFY_BASE_URL` | plain var | Defaults to `https://api.comfy.org`. |
| `COMFY_API_KEY` | **secret** | Server-only. Never logged, never returned in a response. |

Set the deployed secret with:

```bash
npx wrangler secret put COMFY_API_KEY
```

## Deployment

```bash
npm run deploy
```

## Storage

LTM-002 will introduce **in-memory adapters** for assets and jobs. They will be
sufficient for local development and tests but will not survive a Worker
restart. Their interfaces will stay deliberately narrow so Cloudflare R2
(assets) and D1 (job state) can replace them later without changing the HTTP
contract.

## Not implemented yet

- The `/v1/*` routes and their request/response contracts.
- The live Comfy provider adapter.
- Director composition. It is intentionally blocked rather than faked.
