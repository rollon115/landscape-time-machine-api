import { describe, expect, it } from "vitest";
import type { Asset } from "../src/domain/models";
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
  it("uploads the asset, submits the versioned workflow, and hides provider identity in the response", async () => {
    const { dependencies, assets, jobs, provider } = createHarness();
    await assets.put(seedAsset());
    const request = jsonRequest("/v1/timeshifts", {
      assetId: "ast_seed",
      prompt: "  Dawn becomes a fast-moving afternoon.  ",
      durationSeconds: 20,
    });
    const response = await respond(() => createTimeShift(request, dependencies));

    expect(response.status).toBe(202);
    const expectedPublicJob = {
      id: "ltm_test_1",
      kind: "timeshift" as const,
      status: "queued" as const,
      assetId: "ast_seed",
      prompt: "Dawn becomes a fast-moving afternoon.",
      durationSeconds: 20 as const,
      createdAt: "2026-10-16T12:00:00.000Z",
      updatedAt: "2026-10-16T12:00:00.000Z",
    };

    await expect(response.json()).resolves.toEqual({ ok: true, job: expectedPublicJob });
    await expect(jobs.get("ltm_test_1")).resolves.toEqual({
      ...expectedPublicJob,
      provider: {
        provider: "comfy",
        remoteAssetId: "asset_remote_1",
        remoteJobId: "job_remote_1",
        pollUrl: "https://api.comfy.test/api/v2/jobs/job_remote_1",
        cancelUrl: "https://api.comfy.test/api/v2/jobs/job_remote_1/cancel",
        workflowVersion: "ltx2.5-timeshift-v1",
      },
    });

    expect(provider.uploadCalls).toHaveLength(1);
    expect(provider.uploadCalls[0]).toMatchObject({
      contentType: "image/png",
      filePath: "ast_seed.png",
      idempotencyKey: "ltm_test_1_asset",
    });

    expect(provider.submitCalls).toHaveLength(1);
    expect(provider.submitCalls[0]).toMatchObject({
      idempotencyKey: "ltm_test_1_job",
      metadata: {
        localJobId: "ltm_test_1",
        workflowVersion: "ltx2.5-timeshift-v1",
      },
    });
    expect(provider.submitCalls[0]?.workflow).toMatchObject({
      "398:376": { inputs: { value: "Dawn becomes a fast-moving afternoon." } },
      "398:362": { inputs: { value: 20 } },
      "395": { inputs: { image: { __type: "core/ASSET", info: { id: "asset_remote_1" } } } },
    });
  });

  it("requires an existing asset", async () => {
    const { dependencies, provider } = createHarness();
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
    expect(provider.uploadCalls).toHaveLength(0);
    expect(provider.submitCalls).toHaveLength(0);
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
    const { dependencies, assets, provider } = createHarness();
    await assets.put(seedAsset());
    const response = await respond(() =>
      createTimeShift(jsonRequest("/v1/timeshifts", body), dependencies),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code } });
    expect(provider.uploadCalls).toHaveLength(0);
    expect(provider.submitCalls).toHaveLength(0);
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
