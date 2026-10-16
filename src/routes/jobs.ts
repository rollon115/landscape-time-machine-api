import { HttpError, json } from "../http";
import type { V1Dependencies } from "./contracts";

export async function getJob(jobId: string, dependencies: V1Dependencies): Promise<Response> {
  const job = await dependencies.jobs.get(jobId);
  if (!job) throw new HttpError(404, "JOB_NOT_FOUND", "Job not found.", { jobId });
  return json({ ok: true, job });
}

export async function cancelJob(jobId: string, dependencies: V1Dependencies): Promise<Response> {
  const result = await dependencies.jobs.cancel(jobId, dependencies.now().toISOString());
  if (result.outcome === "not_found") {
    throw new HttpError(404, "JOB_NOT_FOUND", "Job not found.", { jobId });
  }
  if (result.outcome === "not_cancellable") {
    throw new HttpError(409, "JOB_NOT_CANCELLABLE", "The job is already terminal.", {
      jobId,
      status: result.job.status,
    });
  }
  return json({ ok: true, job: result.job });
}
