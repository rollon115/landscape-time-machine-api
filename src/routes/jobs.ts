import { HttpError, json } from "../http";
import type { Job, PublicJob } from "../domain/models";
import { preserveTerminalStatus } from "../provider/status-sync";
import { translateProviderStatus } from "../provider/status";
import type { V1Dependencies } from "./contracts";

function publicJob(job: Job): PublicJob {
  if (job.kind === "timeshift") {
    const { provider: _provider, ...rest } = job;
    return rest;
  }
  return job;
}

export async function getJob(jobId: string, dependencies: V1Dependencies): Promise<Response> {
  const localJob = await dependencies.jobs.get(jobId);
  if (!localJob) throw new HttpError(404, "JOB_NOT_FOUND", "Job not found.", { jobId });

  if (localJob.kind !== "timeshift" || !localJob.provider) {
    return json({ ok: true, job: publicJob(localJob) });
  }

  const remoteJob = await dependencies.provider.pollJob(localJob.provider.pollUrl);
  const remoteStatus = translateProviderStatus(remoteJob.status);
  const nextStatus = preserveTerminalStatus(localJob.status, remoteStatus);
  const nextJob = {
    ...localJob,
    status: nextStatus,
    updatedAt: dependencies.now().toISOString(),
  };

  const writeResult = await dependencies.jobs.compareAndSet(localJob, nextJob);
  if (writeResult.outcome === "updated") {
    return json({ ok: true, job: publicJob(writeResult.job) });
  }
  if (writeResult.outcome === "conflict") {
    return json({ ok: true, job: publicJob(writeResult.current) });
  }

  const fallback = await dependencies.jobs.get(jobId);
  if (!fallback) throw new HttpError(404, "JOB_NOT_FOUND", "Job not found.", { jobId });
  return json({ ok: true, job: publicJob(fallback) });
}

export async function cancelJob(jobId: string, dependencies: V1Dependencies): Promise<Response> {
  const localJob = await dependencies.jobs.get(jobId);
  if (!localJob) {
    throw new HttpError(404, "JOB_NOT_FOUND", "Job not found.", { jobId });
  }

  if (localJob.kind === "timeshift" && localJob.provider) {
    const remoteJob = await dependencies.provider.cancelJob(localJob.provider.cancelUrl);
    const remoteStatus = translateProviderStatus(remoteJob.status);
    const nextStatus = preserveTerminalStatus(localJob.status, remoteStatus);
    const nextJob = {
      ...localJob,
      status: nextStatus,
      updatedAt: dependencies.now().toISOString(),
    };

    const writeResult = await dependencies.jobs.compareAndSet(localJob, nextJob);
    if (writeResult.outcome === "updated") {
      return json({ ok: true, job: publicJob(writeResult.job) });
    }
    if (writeResult.outcome === "conflict") {
      return json({ ok: true, job: publicJob(writeResult.current) });
    }

    throw new HttpError(404, "JOB_NOT_FOUND", "Job not found.", { jobId });
  }

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
  return json({ ok: true, job: publicJob(result.job) });
}
