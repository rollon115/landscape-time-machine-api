import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { TimeShiftJob } from "../src/domain/models";
import { InMemoryAssetStore, InMemoryJobStore } from "../src/storage/memory";
import { FakeProviderClient } from "./v1-test-helpers";

const BASE_URL = "https://example.com";
const BASE_TIME = Date.parse("2026-10-16T12:00:00.000Z");

function createHarness() {
  const assets = new InMemoryAssetStore();
  const jobs = new InMemoryJobStore();
  const provider = new FakeProviderClient();
  let idSequence = 0;
  let timeSequence = 0;
  const app = createApp({
    assets,
    jobs,
    provider,
    timeShiftWorkflowVersion: "ltx2.5-timeshift-v1",
    createId: (prefix) => `${prefix}_test_${++idSequence}`,
    now: () => new Date(BASE_TIME + timeSequence++ * 1_000),
  });
  return { app, jobs, provider };
}

function providerJob(status: TimeShiftJob["status"] = "queued"): TimeShiftJob {
  return {
    id: "ltm_seed",
    kind: "timeshift",
    status,
    assetId: "ast_seed",
    prompt: "Clouds sweep across the valley.",
    durationSeconds: 20,
    createdAt: "2026-10-16T11:00:00.000Z",
    updatedAt: "2026-10-16T11:00:00.000Z",
    provider: {
      provider: "comfy",
      remoteAssetId: "asset_remote_1",
      remoteJobId: "job_remote_1",
      pollUrl: "https://api.comfy.test/api/v2/jobs/job_remote_1",
      cancelUrl: "https://api.comfy.test/api/v2/jobs/job_remote_1/cancel",
      workflowVersion: "ltx2.5-timeshift-v1",
    },
  };
}

describe("provider status synchronization", () => {
  it("polls provider status for synced jobs and hides provider identity in responses", async () => {
    const { app, jobs, provider } = createHarness();
    await jobs.put(providerJob("queued"));
    provider.pollResult.status = "running";

    const response = await app.fetch(new Request(`${BASE_URL}/v1/jobs/ltm_seed`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      job: {
        id: "ltm_seed",
        kind: "timeshift",
        status: "running",
        assetId: "ast_seed",
        prompt: "Clouds sweep across the valley.",
        durationSeconds: 20,
        createdAt: "2026-10-16T11:00:00.000Z",
        updatedAt: "2026-10-16T12:00:00.000Z",
      },
    });
    expect(provider.pollCalls).toEqual(["https://api.comfy.test/api/v2/jobs/job_remote_1"]);

    const stored = await jobs.get("ltm_seed");
    expect(stored).toMatchObject({ status: "running" });
    if (stored?.kind === "timeshift") {
      expect(stored.provider?.remoteJobId).toBe("job_remote_1");
    }
  });

  it("preserves terminal local status even when provider reports a different terminal status", async () => {
    const { app, jobs, provider } = createHarness();
    await jobs.put(providerJob("succeeded"));
    provider.pollResult.status = "failed";

    const response = await app.fetch(new Request(`${BASE_URL}/v1/jobs/ltm_seed`));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      job: { id: "ltm_seed", status: "succeeded" },
    });
  });

  it("cancels through provider endpoint and maps canceled to cancelled", async () => {
    const { app, jobs, provider } = createHarness();
    await jobs.put(providerJob("running"));
    provider.cancelResult.status = "canceled";

    const response = await app.fetch(
      new Request(`${BASE_URL}/v1/jobs/ltm_seed/cancel`, { method: "POST" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      job: { id: "ltm_seed", status: "cancelled" },
    });
    expect(provider.cancelCalls).toEqual(["https://api.comfy.test/api/v2/jobs/job_remote_1/cancel"]);
    await expect(jobs.get("ltm_seed")).resolves.toMatchObject({ status: "cancelled" });
  });
});
