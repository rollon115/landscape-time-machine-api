import type { AssetStore, JobStore } from "../storage/contracts";

export interface V1Dependencies {
  assets: AssetStore;
  jobs: JobStore;
  createId(prefix: "ast" | "ltm" | "dir"): string;
  now(): Date;
}
