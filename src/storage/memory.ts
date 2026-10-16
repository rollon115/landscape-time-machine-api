import type { Asset, Job } from "../domain/models";
import type { AssetStore, CancelJobResult, JobStore } from "./contracts";

function cloneAsset(asset: Asset): Asset {
  return { ...asset, bytes: asset.bytes.slice() };
}

function cloneJob(job: Job): Job {
  return job.kind === "director" ? { ...job, jobIds: [...job.jobIds] } : { ...job };
}

/** Non-durable adapter intended only for local development and deterministic tests. */
export class InMemoryAssetStore implements AssetStore {
  readonly #assets = new Map<string, Asset>();

  async put(asset: Asset): Promise<void> {
    this.#assets.set(asset.id, cloneAsset(asset));
  }

  async get(id: string): Promise<Asset | undefined> {
    const asset = this.#assets.get(id);
    return asset ? cloneAsset(asset) : undefined;
  }
}

/** Isolate-local job state; cancellation is atomic within this adapter instance. */
export class InMemoryJobStore implements JobStore {
  readonly #jobs = new Map<string, Job>();

  async put(job: Job): Promise<void> {
    this.#jobs.set(job.id, cloneJob(job));
  }

  async get(id: string): Promise<Job | undefined> {
    const job = this.#jobs.get(id);
    return job ? cloneJob(job) : undefined;
  }

  async cancel(id: string, updatedAt: string): Promise<CancelJobResult> {
    const job = this.#jobs.get(id);
    if (!job) return { outcome: "not_found" };
    if (job.status !== "queued" && job.status !== "running") {
      return { outcome: "not_cancellable", job: cloneJob(job) };
    }

    const cancelled: Job =
      job.kind === "director"
        ? { ...job, jobIds: [...job.jobIds], status: "cancelled", updatedAt }
        : { ...job, status: "cancelled", updatedAt };
    this.#jobs.set(id, cancelled);
    return { outcome: "cancelled", job: cloneJob(cancelled) };
  }
}
