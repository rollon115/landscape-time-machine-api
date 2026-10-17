import type { AssetStore, JobStore } from "../storage/contracts";
import type { ComfyProviderClient } from "../provider/comfy-api";

export interface V1Dependencies {
  assets: AssetStore;
  jobs: JobStore;
  provider: ComfyProviderClient;
  timeShiftWorkflowVersion: string;
  createId(prefix: "ast" | "ltm" | "dir"): string;
  now(): Date;
}
