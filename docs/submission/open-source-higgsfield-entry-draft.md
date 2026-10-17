# Open Source Higgsfield — Entry Draft

Use this as a copy/paste base for the submission form.

## Project

- **Project name**: Landscape Time Machine API
- **Tagline**: Turn one landscape image into a 20-second cinematic time-lapse through a stable developer API.

## One-paragraph summary

Landscape Time Machine is a Cloudflare Workers API that accepts a single JPEG/PNG landscape image and produces an asynchronous TimeShift generation workflow using Comfy API v2. The system exposes a versioned HTTP contract, validates all inputs, keeps provider internals out of public payloads, and synchronizes provider status/cancellation into stable local job states. Director orchestration is intentionally blocked behind an explicit capability boundary (`DIRECTOR_WORKFLOW_NOT_DEPLOYED`) until a verified composition workflow is deployed.

## What is implemented

- `POST /v1/assets`: bounded multipart upload, MIME/signature checks, 20 MiB cap.
- `POST /v1/timeshifts`: validates input, uploads image to Comfy, submits a versioned LTX workflow, stores provider identity internally.
- `GET /v1/jobs/:jobId`: polls provider for synced jobs and maps provider statuses to stable local statuses.
- `POST /v1/jobs/:jobId/cancel`: cancels through provider when identity exists and syncs local state.
- `POST /v1/director`: validates one-to-three succeeded TimeShift jobs, returns explicit not-deployed boundary.

## Reliability and safety notes

- Server-only API key handling (`COMFY_API_KEY` never returned in API responses).
- Reject-on-duplicate `Idempotency-Key` behavior respected; ambiguous provider mutations are not blindly retried.
- Compare-and-set storage updates prevent stale overwrites during poll/cancel races.
- Terminal local states are preserved against conflicting provider transitions.

## Verification performed

- `npm run typecheck`
- `npm test` (86 passing)
- `npm run cf-typegen`
- `npx wrangler deploy --dry-run`

## Links to fill before submit

- **Repository URL**: `<ADD_PUBLIC_REPO_URL>`
- **Demo video URL**: `<ADD_DEMO_VIDEO_URL>`
- **Optional architecture/notes URL**: `<ADD_OPTIONAL_LINK>`

## Honest limitations

- Director composition workflow is not deployed yet.
- Persistence is currently in-memory adapter based; durable storage is the next production milestone.
