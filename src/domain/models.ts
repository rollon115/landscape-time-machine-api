export type ImageMediaType = "image/jpeg" | "image/png";

export interface AssetMetadata {
  id: string;
  mediaType: ImageMediaType;
  sizeBytes: number;
  createdAt: string;
}

/** Internal asset record. Bytes never cross the HTTP response boundary. */
export interface Asset extends AssetMetadata {
  bytes: Uint8Array;
}

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type JobKind = "timeshift" | "director";

export interface ProviderIdentity {
  provider: "comfy";
  remoteAssetId: string;
  remoteJobId: string;
  pollUrl: string;
  cancelUrl: string;
  workflowVersion: string;
}

interface BaseJob {
  id: string;
  kind: JobKind;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TimeShiftJob extends BaseJob {
  kind: "timeshift";
  assetId: string;
  prompt: string;
  durationSeconds: 20;
  provider?: ProviderIdentity;
}

/** Reserved domain shape for a future verified Director workflow. */
export interface DirectorJob extends BaseJob {
  kind: "director";
  jobIds: string[];
}

export type Job = TimeShiftJob | DirectorJob;

export type PublicTimeShiftJob = Omit<TimeShiftJob, "provider">;
export type PublicJob = PublicTimeShiftJob | DirectorJob;
