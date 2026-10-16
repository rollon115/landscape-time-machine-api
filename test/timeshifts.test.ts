import { describe, expect, it } from "vitest";
import type { Asset, TimeShiftJob } from "../src/domain/models";
import { createTimeShift } from "../src/routes/timeshifts";
import {
  BASE_URL,
  createHarness,
  jsonRequest,
  PNG_BYTES,
  respond,
} from "./v1-test-helpers";

function seedAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "ast_seed",
    mediaType: "image/png",
    sizeBytes: PNG_BYTES.byteLength,
    createdAt: "2026-10-16T11:00:00.000Z",
    bytes: PNG_BYTES,
    ...overrides,
  };
}

describe("POST /v1/timeshifts", () => {
  it("creates a queued 20-second job for an existing asset", async () => {
    const { dependencies, assets, jobs } = createHarness();
    await assets.put(seedAsset());
    const request = jsonRequest("/v1/timeshifts", {
      assetId: "ast_seed",
      prompt: "  Dawn becomes a fast-moving afternoon.  ",
      durationSeconds: 20,
    });
    const response = await respond(() => createTimeShift(request, dependencies));

    expect(response.status).toBe(202);
    const expectedJob: TimeShiftJob = {
      id: "ltm_test_1",
      kind: "timeshift",
      status: "queued",
      assetId: "ast_seed",
      prompt: "Dawn becomes a fast-moving afternoon.",
      durationSeconds: 20,
      createdAt: "2026-10-16T12:00:00.000Z",
      updatedAt: "2026-10-16T12:00:00.000Z",
    };
    await expect(response.json()).resolves.toEqual({ ok: true, job: expectedJob });
    await expect(jobs.get("ltm_test_1")).resolves.toEqual(expectedJob);
  });

  it("requires an existing asset", async () => {
    const { dependencies } = createHarness();
    const request = jsonRequest("/v1/timeshifts", {
      assetId: "ast_missing",
      prompt: "Advance the seasons.",
      durationSeconds: 20,
    });
    const response = await respond(() => createTimeShift(request, dependencies));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "ASSET_NOT_FOUND" },
    });
  });

  it.each([
    [{ assetId: "ast_seed", prompt: "   ", durationSeconds: 20 }, "INVALID_PROMPT"],
    [
      { assetId: "ast_seed", prompt: "x".repeat(2_001), durationSeconds: 20 },
      "INVALID_PROMPT",
    ],
    [{ assetId: "ast_seed", prompt: "Advance time.", durationSeconds: 19 }, "INVALID_DURATION"],
    [
      { assetId: "ast_seed", prompt: "Advance time.", durationSeconds: "20" },
      "INVALID_DURATION",
    ],
  ])("rejects invalid TimeShift input", async (body, code) => {
    const { dependencies, assets } = createHarness();
    await assets.put(seedAsset());
    const response = await respond(() =>
      createTimeShift(jsonRequest("/v1/timeshifts", body), dependencies),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code } });
  });

  it("rejects malformed JSON without exposing parser errors", async () => {
    const { dependencies } = createHarness();
    const request = new Request(`${BASE_URL}/v1/timeshifts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const response = await respond(() => createTimeShift(request, dependencies));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: { code: "INVALID_JSON", message: "Request body must be valid JSON." },
    });
  });
});
