import { HttpError, errorResponse } from "../http";
import type { V1Dependencies } from "./contracts";
import { readJson } from "./request";

export async function createDirector(
  request: Request,
  dependencies: V1Dependencies,
): Promise<Response> {
  const input = await readJson(request);
  if (!Array.isArray(input.jobIds) || input.jobIds.length < 1 || input.jobIds.length > 3) {
    throw new HttpError(400, "INVALID_JOB_IDS", "jobIds must contain one to three distinct IDs.");
  }

  const jobIds = input.jobIds.map((jobId) => (typeof jobId === "string" ? jobId.trim() : ""));
  if (jobIds.some((jobId) => !jobId) || new Set(jobIds).size !== jobIds.length) {
    throw new HttpError(400, "INVALID_JOB_IDS", "jobIds must contain one to three distinct IDs.");
  }

  for (const jobId of jobIds) {
    const job = await dependencies.jobs.get(jobId);
    if (!job) {
      throw new HttpError(404, "JOB_NOT_FOUND", "The referenced job does not exist.", { jobId });
    }
    if (job.kind !== "timeshift") {
      throw new HttpError(
        400,
        "DIRECTOR_REQUIRES_TIMESHIFT_JOBS",
        "Director accepts TimeShift jobs only.",
        { jobId },
      );
    }
    if (job.status !== "succeeded") {
      throw new HttpError(
        409,
        "DIRECTOR_JOB_NOT_SUCCEEDED",
        "Every Director input job must have succeeded.",
        { jobId, status: job.status },
      );
    }
  }

  return errorResponse(
    501,
    "DIRECTOR_WORKFLOW_NOT_DEPLOYED",
    "The Director composition workflow is not deployed.",
  );
}
