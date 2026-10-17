import type { Asset, Job, ProviderIdentity, TimeShiftJob } from "../domain/models";
import type { AssetStore, CancelJobResult, JobStore } from "./contracts";

function cloneProviderIdentity(provider: ProviderIdentity): ProviderIdentity {
  return { ...provider };
}

function cloneTimeShiftJob(job: TimeShiftJob): TimeShiftJob {
  return job.provider === undefined
    ? { ...job }
    : { ...job, provider: cloneProviderIdentity(job.provider) };
}

function cloneAsset(asset: Asset): Asset {
  return { ...asset, bytes: asset.bytes.slice() };
}

function cloneJob(job: Job): Job {
  return job.kind === "director" ? { ...job, jobIds: [...job.jobIds] } : cloneTimeShiftJob(job);
}

function providerEquals(left: ProviderIdentity | undefined, right: ProviderIdentity | undefined): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.provider === right.provider &&
    left.remoteAssetId === right.remoteAssetId &&
    left.remoteJobId === right.remoteJobId &&
    left.pollUrl === right.pollUrl &&
    left.cancelUrl === right.cancelUrl &&
    left.workflowVersion === right.workflowVersion;
}

function sameTimeShift(left: TimeShiftJob, right: TimeShiftJob): boolean {
  return left.id === right.id &&
    left.kind === right.kind &&
    left.status === right.status &&
    left.createdAt === right.createdAt &&
    left.updatedAt === right.updatedAt &&
    left.assetId === right.assetId &&
    left.prompt === right.prompt &&
    left.durationSeconds === right.durationSeconds &&
    providerEquals(left.provider, right.provider);
}

function sameJob(left: Job, right: Job): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "director" && right.kind === "director") {
    return left.id === right.id &&
      left.status === right.status &&
      left.createdAt === right.createdAt &&
      left.updatedAt === right.updatedAt &&
      left.jobIds.length === right.jobIds.length &&
      left.jobIds.every((value, index) => value === right.jobIds[index]);
  }
  if (left.kind === "timeshift" && right.kind === "timeshift") {
    return sameTimeShift(left, right);
  }
  return false;
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

  async compareAndSet(expected: Job, next: Job): Promise<
    { outcome: "updated"; job: Job } | { outcome: "conflict"; current: Job } | { outcome: "not_found" }
  > {
    const current = this.#jobs.get(expected.id);
    if (!current) return { outcome: "not_found" };
    if (!sameJob(current, expected)) return { outcome: "conflict", current: cloneJob(current) };

    const candidate = cloneJob(next);
    this.#jobs.set(next.id, candidate);
    return { outcome: "updated", job: cloneJob(candidate) };
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
