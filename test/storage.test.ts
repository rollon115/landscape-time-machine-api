import { describe, expect, it } from "vitest";
import type { Asset, DirectorJob, JobStatus, TimeShiftJob } from "../src/domain/models";
import { InMemoryAssetStore, InMemoryJobStore } from "../src/storage/memory";

const CREATED_AT = "2026-10-16T11:00:00.000Z";
const CANCELLED_AT = "2026-10-16T12:00:00.000Z";

function asset(): Asset {
  return {
    id: "ast_seed",
    mediaType: "image/png",
    sizeBytes: 3,
    createdAt: CREATED_AT,
    bytes: new Uint8Array([1, 2, 3]),
  };
}

function timeShiftJob(status: JobStatus): TimeShiftJob {
  return {
    id: "ltm_seed",
    kind: "timeshift",
    status,
    assetId: "ast_seed",
    prompt: "Clouds sweep across the valley.",
    durationSeconds: 20,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

describe("InMemoryAssetStore", () => {
  it("copies bytes at both sides of the storage boundary", async () => {
    const store = new InMemoryAssetStore();
    const source = asset();
    await store.put(source);
    source.bytes[0] = 9;

    const firstRead = await store.get(source.id);
    expect(firstRead?.bytes).toEqual(new Uint8Array([1, 2, 3]));
    if (firstRead) firstRead.bytes[1] = 9;

    await expect(store.get(source.id)).resolves.toMatchObject({
      bytes: new Uint8Array([1, 2, 3]),
    });
  });
});

describe("InMemoryJobStore", () => {
  it("copies Director job ID arrays at both sides of the storage boundary", async () => {
    const store = new InMemoryJobStore();
    const source: DirectorJob = {
      id: "dir_seed",
      kind: "director",
      status: "queued",
      jobIds: ["ltm_one"],
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    };
    await store.put(source);
    source.jobIds.push("ltm_two");

    const firstRead = await store.get(source.id);
    expect(firstRead).toMatchObject({ jobIds: ["ltm_one"] });
    if (firstRead?.kind === "director") firstRead.jobIds.push("ltm_three");

    await expect(store.get(source.id)).resolves.toMatchObject({ jobIds: ["ltm_one"] });
  });

  it.each(["queued", "running"] as const)("atomically cancels a %s job", async (status) => {
    const store = new InMemoryJobStore();
    await store.put(timeShiftJob(status));

    await expect(store.cancel("ltm_seed", CANCELLED_AT)).resolves.toMatchObject({
      outcome: "cancelled",
      job: { status: "cancelled", updatedAt: CANCELLED_AT },
    });
    await expect(store.get("ltm_seed")).resolves.toMatchObject({
      status: "cancelled",
      updatedAt: CANCELLED_AT,
    });
  });

  it.each(["succeeded", "failed", "cancelled"] as const)(
    "preserves a terminal %s job",
    async (status) => {
      const store = new InMemoryJobStore();
      await store.put(timeShiftJob(status));

      await expect(store.cancel("ltm_seed", CANCELLED_AT)).resolves.toMatchObject({
        outcome: "not_cancellable",
        job: { status, updatedAt: CREATED_AT },
      });
      await expect(store.get("ltm_seed")).resolves.toMatchObject({
        status,
        updatedAt: CREATED_AT,
      });
    },
  );

  it("reports a missing job without creating state", async () => {
    const store = new InMemoryJobStore();

    await expect(store.cancel("ltm_missing", CANCELLED_AT)).resolves.toEqual({
      outcome: "not_found",
    });
    await expect(store.get("ltm_missing")).resolves.toBeUndefined();
  });
});
