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
| `POST /v1/assets` | Implemented with non-durable in-memory storage |
| `POST /v1/timeshifts` | Implemented with Comfy asset upload + job submission and local projection |
| `POST /v1/director` | Validates inputs, then reports the deployment boundary |
| `GET /v1/jobs/:jobId` | Implemented with provider poll synchronization when available |
| `POST /v1/jobs/:jobId/cancel` | Implemented with provider cancellation synchronization when available |
| Director 3D composition | **Not live.** Reports `DIRECTOR_WORKFLOW_NOT_DEPLOYED` until a verified compositing workflow exists. |

## Requirements

- Node.js 22+
- A Comfy Cloud account and API key when the provider integration is added in LTM-003

## Local setup

```bash
npm install
cp .dev.vars.example .dev.vars   # keep secrets local and out of source control
npm run dev                      # wrangler dev
```

The dev server listens on `http://localhost:8787` by default.

```bash
curl -s http://localhost:8787/health
# {"ok":true,"service":"landscape-time-machine","version":"0.1.0"}
```

Provider credentials remain server-only and are never returned in API responses.

## Versioned HTTP contract

Successful responses use `{ "ok": true, ... }`. Errors always use this shape:

```json
{
  "ok": false,
  "error": {
    "code": "STABLE_ERROR_CODE",
    "message": "Human-readable summary.",
    "details": {}
  }
}
```

`details` is optional. Responses never include uploaded bytes, secret values,
stack traces, or raw internal errors. Known routes return `405` for unsupported
methods; unknown routes return a JSON `404`.

### `POST /v1/assets`

Send `multipart/form-data` containing exactly one `file` field. The file must:

- be non-empty;
- declare `image/jpeg` or `image/png` as its MIME type;
- contain the matching JPEG or PNG signature; and
- be no larger than **20 MiB** (`20 * 1024 * 1024` bytes).

The filename and extension are not trusted or retained. A successful request
returns `201` with bounded metadata:

```json
{
  "ok": true,
  "asset": {
    "id": "ast_...",
    "mediaType": "image/png",
    "sizeBytes": 12345,
    "createdAt": "2026-10-16T12:00:00.000Z"
  }
}
```

### `POST /v1/timeshifts`

Send JSON with an existing asset ID, a trimmed prompt of 1–2000 characters,
and the v1 duration of exactly 20 seconds:

```json
{
  "assetId": "ast_...",
  "prompt": "Clouds race across the valley from dawn to dusk.",
  "durationSeconds": 20
}
```

The response is `202` with an `ltm_...` job in `queued` state. The route uploads
the stored image to Comfy (`POST /api/v2/assets`), submits the versioned LTX
workflow (`POST /api/v2/jobs`), and persists provider identity internally for
poll/cancel synchronization. Provider URLs and IDs are never exposed in public
job payloads.

### `POST /v1/director`

Send `{ "jobIds": ["ltm_..."] }` with one to three distinct IDs. Every job must
exist, be a TimeShift job, and have status `succeeded`. After those checks pass,
the endpoint returns `501` with `DIRECTOR_WORKFLOW_NOT_DEPLOYED`. It does not
create a Director job or claim that composition ran.

### Job lookup and cancellation

`GET /v1/jobs/:jobId` returns the stored job or `404`. For TimeShift jobs with
provider identity, the API polls provider status and synchronizes local state
without regressing terminal states. Public jobs use kind
`timeshift | director` and status `queued | running | succeeded | failed | cancelled`.

`POST /v1/jobs/:jobId/cancel` cancels through the provider when identity is
present, maps provider `canceled` to local `cancelled`, and updates `updatedAt`.
Without provider identity it falls back to local cancellation of `queued` and
`running` jobs. Missing jobs return `404`. Terminal jobs return `409` with
`JOB_NOT_CANCELLABLE`.

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

LTM-002 uses injected **in-memory adapters** for asset bytes and jobs. Production
defaults are deliberately isolate-scoped behind those adapter interfaces. This
state can disappear on restart or eviction and is not shared consistently across
isolates, so it is suitable only for local development and tests. Cloudflare R2
(assets) and durable job storage must replace it before production use without
changing the HTTP contract.

## Not implemented yet

- Director composition. It is intentionally blocked rather than faked.
- Durable asset and job persistence.
