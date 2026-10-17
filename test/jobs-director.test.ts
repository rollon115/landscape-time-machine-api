import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { Asset, DirectorJob, JobStatus, TimeShiftJob } from "../src/domain/models";
import { InMemoryAssetStore, InMemoryJobStore } from "../src/storage/memory";
import { FakeProviderClient } from "./v1-test-helpers";

const BASE_URL = "https://example.com";
const BASE_TIME = Date.parse("2026-10-16T12:00:00.000Z");
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

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

  return { app, assets, jobs, provider };
}

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function seedAsset(): Asset {
  return {
    id: "ast_seed",
    mediaType: "image/png",
    sizeBytes: PNG_BYTES.byteLength,
    createdAt: "2026-10-16T11:00:00.000Z",
    bytes: PNG_BYTES,
  };
}

function seedTimeShiftJob(
  status: JobStatus = "succeeded",
  overrides: Partial<TimeShiftJob> = {},
): TimeShiftJob {
  return {
    id: "ltm_seed",
    kind: "timeshift",
    status,
    assetId: "ast_seed",
    prompt: "Clouds sweep across the valley.",
    durationSeconds: 20,
    createdAt: "2026-10-16T11:00:00.000Z",
    updatedAt: "2026-10-16T11:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /v1/director", () => {
  it("validates succeeded TimeShift jobs before reporting the deployment boundary", async () => {
    const { app, jobs } = createHarness();
    await jobs.put(seedTimeShiftJob("succeeded", { id: "ltm_one" }));
    await jobs.put(seedTimeShiftJob("succeeded", { id: "ltm_two" }));
    const response = await app.fetch(
      jsonRequest("/v1/director", { jobIds: ["ltm_one", "ltm_two"] }),
    );

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "DIRECTOR_WORKFLOW_NOT_DEPLOYED",
        message: "The Director composition workflow is not deployed.",
      },
    });
  });

  it.each([
    [[], "INVALID_JOB_IDS"],
    [["ltm_one", "ltm_one"], "INVALID_JOB_IDS"],
    [["a", "b", "c", "d"], "INVALID_JOB_IDS"],
  ])("requires one to three distinct job IDs", async (jobIds, code) => {
    const { app } = createHarness();
    const response = await app.fetch(jsonRequest("/v1/director", { jobIds }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code } });
  });

  it("requires every referenced job to exist", async () => {
    const { app } = createHarness();
    const response = await app.fetch(jsonRequest("/v1/director", { jobIds: ["ltm_missing"] }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "JOB_NOT_FOUND", details: { jobId: "ltm_missing" } },
    });
  });

  it("requires TimeShift jobs", async () => {
    const { app, jobs } = createHarness();
    const directorJob: DirectorJob = {
      id: "dir_seed",
      kind: "director",
      status: "succeeded",
      jobIds: ["ltm_seed"],
      createdAt: "2026-10-16T11:00:00.000Z",
      updatedAt: "2026-10-16T11:00:00.000Z",
    };
    await jobs.put(directorJob);
    const response = await app.fetch(jsonRequest("/v1/director", { jobIds: ["dir_seed"] }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "DIRECTOR_REQUIRES_TIMESHIFT_JOBS" },
    });
  });

  it("requires succeeded jobs", async () => {
    const { app, jobs } = createHarness();
    await jobs.put(seedTimeShiftJob("queued"));
    const response = await app.fetch(jsonRequest("/v1/director", { jobIds: ["ltm_seed"] }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "DIRECTOR_JOB_NOT_SUCCEEDED" },
    });
  });
});

describe("job lookup and cancellation", () => {
  it("returns a stored public job or a stable 404", async () => {
    const { app, jobs } = createHarness();
    const job = seedTimeShiftJob("queued");
    await jobs.put(job);

    const found = await app.fetch(new Request(`${BASE_URL}/v1/jobs/ltm_seed`));
    expect(found.status).toBe(200);
    await expect(found.json()).resolves.toEqual({ ok: true, job });

    const missing = await app.fetch(new Request(`${BASE_URL}/v1/jobs/ltm_missing`));
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "JOB_NOT_FOUND" },
    });
  });

  it.each(["queued", "running"] as const)("cancels a %s job and updates its timestamp", async (status) => {
    const { app, jobs } = createHarness();
    await jobs.put(seedTimeShiftJob(status));
    const response = await app.fetch(
      new Request(`${BASE_URL}/v1/jobs/ltm_seed/cancel`, { method: "POST" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      job: {
        id: "ltm_seed",
        status: "cancelled",
        updatedAt: "2026-10-16T12:00:00.000Z",
      },
    });
    await expect(jobs.get("ltm_seed")).resolves.toMatchObject({ status: "cancelled" });
  });

  it.each(["succeeded", "failed", "cancelled"] as const)(
    "returns 409 when a %s job is terminal",
    async (status) => {
      const { app, jobs } = createHarness();
      await jobs.put(seedTimeShiftJob(status));
      const response = await app.fetch(
        new Request(`${BASE_URL}/v1/jobs/ltm_seed/cancel`, { method: "POST" }),
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: { code: "JOB_NOT_CANCELLABLE", details: { status } },
      });
    },
  );

  it("returns 404 when cancelling a missing job", async () => {
    const { app } = createHarness();
    const response = await app.fetch(
      new Request(`${BASE_URL}/v1/jobs/ltm_missing/cancel`, { method: "POST" }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "JOB_NOT_FOUND" },
    });
  });
});

describe("routing and provider boundary", () => {
  it("returns 405 for known routes with the wrong method", async () => {
    const { app } = createHarness();
    const response = await app.fetch(
      new Request(`${BASE_URL}/v1/assets`, { method: "PUT" }),
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED" },
    });
  });

  it("submits provider requests only for timeshifts and keeps Director blocked", async () => {
    const providerFetch = vi.spyOn(globalThis, "fetch");
    const { app, assets, jobs, provider } = createHarness();
    await assets.put(seedAsset());
    await jobs.put(seedTimeShiftJob("succeeded"));

    await app.fetch(
      jsonRequest("/v1/timeshifts", {
        assetId: "ast_seed",
        prompt: "Advance time.",
        durationSeconds: 20,
      }),
    );
    await app.fetch(jsonRequest("/v1/director", { jobIds: ["ltm_seed"] }));

    expect(provider.uploadCalls).toHaveLength(1);
    expect(provider.submitCalls).toHaveLength(1);
    expect(provider.pollCalls).toHaveLength(0);
    expect(provider.cancelCalls).toHaveLength(0);
    expect(providerFetch).not.toHaveBeenCalled();
  });
});
