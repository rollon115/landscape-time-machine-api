import type { TimeShiftJob } from "../domain/models";
import { HttpError, json } from "../http";
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
  if (!(await dependencies.assets.get(assetId))) {
    throw new HttpError(404, "ASSET_NOT_FOUND", "The referenced asset does not exist.", {
      assetId,
    });
  }

  const timestamp = dependencies.now().toISOString();
  const job: TimeShiftJob = {
    id: dependencies.createId("ltm"),
    kind: "timeshift",
    status: "queued",
    assetId,
    prompt,
    durationSeconds: 20,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await dependencies.jobs.put(job);
  return json({ ok: true, job }, 202);
}
