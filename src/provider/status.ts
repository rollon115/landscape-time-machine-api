import type { JobStatus } from "../domain/models";
import { ComfyProtocolError, type ComfyJobStatus } from "./contracts";

const PROVIDER_STATUS_TO_LOCAL = {
  queued: "queued",
  running: "running",
  canceling: "running",
  succeeded: "succeeded",
  canceled: "cancelled",
  failed: "failed",
  expired: "failed",
} as const satisfies Record<ComfyJobStatus, JobStatus>;

export function isProviderStatus(value: unknown): value is ComfyJobStatus {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PROVIDER_STATUS_TO_LOCAL, value)
  );
}

export function translateProviderStatus(status: unknown): JobStatus {
  if (!isProviderStatus(status)) throw new ComfyProtocolError("Unknown Comfy job status.");
  return PROVIDER_STATUS_TO_LOCAL[status];
}
