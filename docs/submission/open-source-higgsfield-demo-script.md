# Demo Script (90–120 seconds)

## Goal

Show that one image goes through a real provider-backed TimeShift lifecycle via a stable API contract.

## Suggested flow

1. **Intro (10s)**
   - “This is Landscape Time Machine API. We turn one landscape image into a 20-second time-lapse workflow through a clean HTTP API.”

2. **Upload asset (15s)**
   - Call `POST /v1/assets` with one PNG/JPEG.
   - Show bounded metadata response only (`id`, `mediaType`, `sizeBytes`, `createdAt`).

3. **Create TimeShift job (20s)**
   - Call `POST /v1/timeshifts` with `assetId`, prompt, and `durationSeconds: 20`.
   - Mention provider upload + submit happen internally.
   - Show local job response without provider internals.

4. **Poll synced status (20s)**
   - Call `GET /v1/jobs/:jobId`.
   - Explain provider status translation and terminal-state preservation.

5. **Cancel path (15s)**
   - Call `POST /v1/jobs/:jobId/cancel`.
   - Show `cancelled` projection.

6. **Director boundary (10s)**
   - Call `POST /v1/director` with valid IDs.
   - Show explicit `DIRECTOR_WORKFLOW_NOT_DEPLOYED` boundary.

## Talking points to emphasize

- Real provider integration (not fake queue-only behavior).
- Stable public contract and honest capability boundaries.
- Security: server-only key, redaction, no provider internals in public payload.
- Deterministic tests and dry-run deployment checks.

## Recording checklist

- [ ] Terminal commands are readable (font size/zoom).
- [ ] Response JSON is visible long enough to read.
- [ ] No secrets shown in shell or environment.
- [ ] Final frame includes repo URL and challenge name.
