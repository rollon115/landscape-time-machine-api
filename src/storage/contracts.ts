import type { Asset, Job } from "../domain/models";

export interface AssetStore {
  put(asset: Asset): Promise<void>;
  get(id: string): Promise<Asset | undefined>;
}

export type CancelJobResult =
  | { outcome: "cancelled"; job: Job }
  | { outcome: "not_cancellable"; job: Job }
  | { outcome: "not_found" };

export interface JobStore {
  put(job: Job): Promise<void>;
  get(id: string): Promise<Job | undefined>;
  compareAndSet(expected: Job, next: Job): Promise<{ outcome: "updated"; job: Job } | {
    outcome: "conflict";
    current: Job;
  } | { outcome: "not_found" }>;
  cancel(id: string, updatedAt: string): Promise<CancelJobResult>;
}
