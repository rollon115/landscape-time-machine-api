import type { JobStatus } from "../domain/models";

const TERMINAL_STATUSES = new Set<JobStatus>(["succeeded", "failed", "cancelled"]);

export function preserveTerminalStatus(
  current: JobStatus,
  provider: JobStatus,
): JobStatus {
  if (TERMINAL_STATUSES.has(current)) return current;
  return provider;
}
