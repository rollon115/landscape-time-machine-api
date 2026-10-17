# Open Source Higgsfield — Submission Checklist

## Scope

Submission target for **Landscape Time Machine API** using:

- challenge page: https://comfy.org/open-source-higgsfield
- form: https://form.typeform.com/to/V1dSQrkS

## Completion Checklist

### 1) Repository and code state

- [x] Public API contract implemented (`/v1/assets`, `/v1/timeshifts`, `/v1/jobs/:id`, `/v1/jobs/:id/cancel`, `/v1/director`)
- [x] Director boundary preserved with `DIRECTOR_WORKFLOW_NOT_DEPLOYED`
- [x] Comfy API v2 integration implemented for TimeShift (asset upload + job submit + poll + cancel)
- [x] Provider internals hidden from public responses
- [x] Default Comfy endpoint aligned to cloud (`https://cloud.comfy.org`)
- [x] ODD progress ledger updated in `odd/tasks/landscape-time-machine-api.md`

### 2) Verification evidence

- [x] `npm run typecheck`
- [x] `npm test` (86 passing)
- [x] `npm run cf-typegen`
- [x] `npx wrangler deploy --dry-run`

### 3) Submission assets

- [ ] Final public repository URL added to the form draft
- [ ] Demo video URL added to the form draft
- [ ] Optional architecture screenshot or diagram URL added

### 4) Form-ready narrative

- [x] Project summary drafted
- [x] Technical implementation summary drafted
- [x] Reliability and safety notes drafted
- [x] Known limitations documented honestly

## Current branch evidence

- `46839db` — provider contracts and status mapping
- `c4c28b2` — resilient Comfy API client
- `1a19012` — transport/protocol helper split
- `d8af03e` — TimeShift lifecycle integration (submit/poll/cancel sync)
- `67e54c6` — cloud endpoint default alignment

## Final pre-submit sanity check

1. Re-run verification commands in a clean shell.
2. Confirm README and ODD notes match actual behavior.
3. Confirm form links are public and accessible.
4. Submit Typeform and archive confirmation screenshot/ID.
