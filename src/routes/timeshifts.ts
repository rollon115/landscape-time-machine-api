import type { TimeShiftJob } from "../domain/models";
import { HttpError, json } from "../http";
import { buildTimeShiftWorkflow } from "../provider/timeshift-workflow";
import type { V1Dependencies } from "./contracts";
import { readJson } from "./request";

const MAX_PROMPT_CHARACTERS = 2_000;

export async function createTimeShift(
  request: Request,
  dependencies: V1Dependencies,
): Promise<Response> {
  const input = await readJson(request);
  const assetId = typeof input.assetId === "string" ? input.assetId.trim() : "";
  if (!assetId) throw new HttpError(400, "INVALID_ASSET_ID", "assetId must be a non-empty string.");

  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt || [...prompt].length > MAX_PROMPT_CHARACTERS) {
    throw new HttpError(
      400,
      "INVALID_PROMPT",
      "prompt must contain 1 to 2000 characters after trimming.",
    );
  }
  if (input.durationSeconds !== 20) {
    throw new HttpError(400, "INVALID_DURATION", "durationSeconds must equal 20.");
  }

  const localJobId = dependencies.createId("ltm");
  const idempotencyPrefix = localJobId;
  const asset = await dependencies.assets.get(assetId);
  if (!asset) {
    throw new HttpError(404, "ASSET_NOT_FOUND", "The referenced asset does not exist.", {
      assetId,
    });
  }

  const remoteAsset = await dependencies.provider.uploadAsset({
    file: new Blob([asset.bytes], { type: asset.mediaType }),
    contentType: asset.mediaType,
    filePath: `${asset.id}.${asset.mediaType === "image/png" ? "png" : "jpg"}`,
    idempotencyKey: `${idempotencyPrefix}_asset`,
  });

  const workflowVersion = dependencies.timeShiftWorkflowVersion;
  const remoteJob = await dependencies.provider.submitJob({
    workflow: buildTimeShiftWorkflow(remoteAsset, prompt),
    metadata: {
      localJobId,
      workflowVersion,
    },
    idempotencyKey: `${idempotencyPrefix}_job`,
  });

  const timestamp = dependencies.now().toISOString();
  const job: TimeShiftJob = {
    id: localJobId,
    kind: "timeshift",
    status: "queued",
    assetId,
    prompt,
    durationSeconds: 20,
    createdAt: timestamp,
    updatedAt: timestamp,
    provider: {
      provider: "comfy",
      remoteAssetId: remoteAsset.id,
      remoteJobId: remoteJob.id,
      pollUrl: remoteJob.urls.self,
      cancelUrl: remoteJob.urls.cancel,
      workflowVersion,
    },
  };
  await dependencies.jobs.put(job);
  return json({ ok: true, job: { ...job, provider: undefined } }, 202);
}
