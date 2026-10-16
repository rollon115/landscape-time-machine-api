# Landscape Time Machine API

## Objective

Build a developer-facing API that turns a supplied landscape image into a validated 20-second LTX time-lapse and exposes a future-ready Director orchestration stage for assembling one to three approved clips.

## Problem and why

The validated image-to-video workflow is currently operated manually in Comfy Cloud. Developers need a stable asynchronous API contract, durable job state, and honest capability boundaries before a cinematic montage layer can be offered.

## Authorized scope

- Cloudflare Workers + TypeScript service foundation using a module `fetch` handler.
- Comfy Developer Platform adapter boundary for TimeShift LTX submissions.
- Asset upload, TimeShift, Director, job-status, and cancellation contracts.
- Deterministic tests with fakes.
- Documentation for local setup and current Director limitation.

## Constraints

- Keep `COMFY_API_KEY` server-side and out of logs/responses.
- TimeShift accepts JPEG/PNG and exactly 20-second requests in v1.
- Director accepts one to three distinct succeeded TimeShift jobs only.
- Director must report `DIRECTOR_WORKFLOW_NOT_DEPLOYED` until a verified compositing workflow exists.
- Do not hardcode Cloud-template internals as a production workflow contract.
- No external API generation job is launched by implementation tests.

## Delivery strategy

- Strategy: ask-on-risk.
- Forecast: under 400 authored changed lines for the foundation slice, excluding generated lockfiles.
- Repository status: feature branch `feat/ltm-001-foundation` exists; the first work-unit commit is pending.

## Tasks

- [x] LTM-001 — Create the Cloudflare Workers scaffold, environment validation, and local run scripts.
  - Route: inline fallback after the delegated writer was unavailable; the writer trigger was recorded.
  - Acceptance: server starts with validated configuration and no secret is exposed.
  - Checks: `npm run typecheck` passed; `npm test` passed (5 tests across 2 files); `npx wrangler types --check` passed; `npx wrangler deploy --dry-run` bundled the Worker successfully.

- [ ] LTM-002 — Implement versioned API contracts and in-memory job/asset boundaries.
  - Route: delegated direct; writer trigger (multiple non-trivial files).
  - Acceptance: upload, TimeShift, Director, job lookup, and cancellation routes validate documented inputs and state transitions.
  - Checks: contract/domain tests with deterministic fakes.

- [ ] LTM-003 — Add Comfy adapter boundary and truthful Director blocked state.
  - Route: delegated direct; writer trigger (multiple non-trivial files).
  - Acceptance: TimeShift persists provider IDs through an adapter; Director never claims 3D composition is implemented.
  - Checks: service tests for provider/status mapping and Director blocking.

- [ ] LTM-004 — Document setup, capability limits, and next workflow-export step.
  - Route: delegated direct; documentation accompanies behavior.
  - Acceptance: another developer can configure the API without guessing workflow identifiers or assuming Director is live.
  - Checks: structural documentation readback.

## Progress and evidence

- 2026-10-16 — Three LTX validation clips completed through Comfy Cloud: landscape, city, and architectural scene. The city prompt was corrected after scopes detected excessive cyan saturation and insufficient luminance lift.
- 2026-10-16 — LTM-001 scaffold completed with a Workers module handler, configuration validation, health endpoint, deterministic tests, and local scripts. Typecheck, five focused tests, Wrangler type verification, and a deployment dry run passed.
- Pending: create the feature branch and work-unit commit, then implement LTM-002. The versioned LTX API workflow remains to be exported and deployed.

## Next step

Create the LTM-001 work-unit commit, then implement and verify the LTM-002 versioned API contracts and in-memory boundaries.
