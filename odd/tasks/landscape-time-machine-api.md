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
- Chain strategy: `feature-branch-chain`, selected 2026-10-16 after the LTM-002 working diff reached 1,068 authored changed lines.
- Proposed child order and dependencies:
  1. `feat/ltm-002-domain-storage` — domain models, storage boundaries, in-memory adapters, shared request/error foundations, and storage tests; based on committed LTM-001.
  2. `feat/ltm-002-assets` — asset upload, shared deterministic API-test helpers, and focused upload tests; based on `feat/ltm-002-domain-storage`.
  3. `feat/ltm-002-timeshifts` — TimeShift handler and focused contract tests; based on `feat/ltm-002-assets`.
  4. `feat/ltm-002-jobs-director` — job lookup/cancellation, Director validation, and focused tests; based on `feat/ltm-002-timeshifts`.
  5. `feat/ltm-002-routing-docs` — top-level routing, health-contract alignment, README, and final ODD evidence; based on `feat/ltm-002-jobs-director`.
- Tracker: the transaction controller will create the required draft/no-merge integration tracker when it materializes the branch and PR chain.
- Completion gate: LTM-002 remains complete only while the retained baseline behavior and every required verification command pass after slicing.
- Slice evidence:
  - `feat/ltm-002-domain-storage` — commit `1543632`; 377 authored changed lines; assessed medium with `review_due_reason: under_budget`.
  - `feat/ltm-002-assets` — commit `f4a0b46`; 292 authored changed lines; 7 focused tests passed.
  - `feat/ltm-002-timeshifts` — commit `6abd61f`; 152 authored changed lines; 7 focused tests passed.
  - `feat/ltm-002-jobs-director` — commit `7c34e2c`; 310 authored changed lines; 16 focused tests passed.
  - `feat/ltm-002-routing-docs` — 206 authored changed lines; full verification passed; commit identity recorded by the closure evidence update.
- Review mode: clone-local RDD is disabled after a provider-issued continuation rebound the accumulated committed candidate to unrelated unstaged paths. Global mode remains unchanged.
- Repository status: all five LTM-002 slices are implemented and verified on the feature-branch chain.

## Tasks

- [x] LTM-001 — Create the Cloudflare Workers scaffold, environment validation, and local run scripts.
  - Route: inline fallback after the delegated writer was unavailable; the writer trigger was recorded.
  - Acceptance: server starts with validated configuration and no secret is exposed.
  - Checks: `npm run typecheck` passed; `npm test` passed (5 tests across 2 files); `npx wrangler types --check` passed; `npx wrangler deploy --dry-run` bundled the Worker successfully.
  - Review: assessed medium (`slice_budget_reached`); candidate review was declined after the bound reviewer transport rejected its repository context. Clone-local RDD was later disabled after another scope-binding failure.

- [x] LTM-002 — Implement versioned API contracts and in-memory job/asset boundaries.
  - Route: delegated direct; all five feature-branch-chain slices are implemented and verified.
  - Acceptance: upload, TimeShift, Director, job lookup, and cancellation routes validate documented inputs and state transitions.
  - Checks: `npm test` passed (43 tests across 6 files); `npm run typecheck` passed; `npx wrangler types --check` passed; Wrangler deployment dry-run bundled successfully.
  - Boundary: TimeShift queues only local state; Director validates succeeded TimeShift jobs and returns `DIRECTOR_WORKFLOW_NOT_DEPLOYED` without creating a job.
  - Review: `disabled/unmanaged` by explicit clone-local user choice; ordinary verification is the evidence of record.

- [ ] LTM-003 — Add the live Comfy adapter and provider-status mapping.
  - Route: delegated direct; writer trigger (multiple non-trivial files).
  - Acceptance: TimeShift persists provider IDs through an adapter; the existing Director deployment boundary remains truthful.
  - Checks: service tests for provider/status mapping and Director blocking.

- [ ] LTM-004 — Document setup, capability limits, and next workflow-export step.
  - Route: delegated direct; documentation accompanies behavior.
  - Acceptance: another developer can configure the API without guessing workflow identifiers or assuming Director is live.
  - Checks: structural documentation readback.

## Progress and evidence

- 2026-10-16 — Three LTX validation clips completed through Comfy Cloud: landscape, city, and architectural scene. The city prompt was corrected after scopes detected excessive cyan saturation and insufficient luminance lift.
- 2026-10-16 — LTM-001 scaffold completed with a Workers module handler, configuration validation, health endpoint, deterministic tests, and local scripts. Typecheck, five focused tests, Wrangler type verification, and a deployment dry run passed.
- 2026-10-16 — LTM-001 closed in work-unit commit `69718b9` (`feat(api): scaffold Cloudflare Worker foundation`).
- 2026-10-16 — Native review consent was granted, but the bound reviewer transport rejected the repository context. The user chose to continue without reporting and declined that candidate.
- 2026-10-16 — LTM-002 implemented versioned upload, TimeShift, Director validation, job lookup, and cancellation contracts over injected in-memory stores. All 43 tests, typecheck, Wrangler type verification, and deployment dry-run passed; no external provider job was submitted.
- 2026-10-16 — The user selected `feature-branch-chain`. One slicing pass produced five cohesive review slices, each below 400 authored changed lines.
- 2026-10-16 — Domain/storage slice committed as `1543632` (`feat(api): add domain and storage boundaries`); native assessment returned medium/under-budget.
- 2026-10-16 — Assets slice committed as `f4a0b46` (`feat(api): add asset upload endpoint`); all 7 focused tests passed.
- 2026-10-16 — The accumulated committed candidate reached the review budget, but the provider-issued continuation rebound it to unrelated unstaged paths. No review was started; the user disabled RDD for this clone only and retained ordinary verification.
- 2026-10-16 — TimeShift slice committed as `6abd61f` (`feat(api): add timeshift job endpoint`); all 7 focused tests passed.
- 2026-10-16 — Jobs/Director slice committed as `7c34e2c` (`feat(api): add job and director endpoints`); all 16 focused tests passed.
- 2026-10-17 — Routing/docs slice passed all 43 tests, TypeScript typecheck, Wrangler generated-type verification, deployment dry-run (13.41 KiB / gzip 4.00 KiB), and staged-diff whitespace validation.
- Pending: implement LTM-003. The versioned LTX provider workflow remains to be exported and deployed.

## Next step

Begin LTM-003 without weakening the current Director deployment boundary: add the live Comfy adapter and provider-status mapping behind the tested API contract.
