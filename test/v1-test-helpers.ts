import type {
  ComfyAsset,
  ComfyJob,
  SubmitJobInput,
  UploadAssetInput,
} from "../src/provider/contracts";
import type { ComfyProviderClient } from "../src/provider/comfy-api";
import { fromError } from "../src/http";
import type { V1Dependencies } from "../src/routes/contracts";
import { InMemoryAssetStore, InMemoryJobStore } from "../src/storage/memory";

export const BASE_URL = "https://example.com";
export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

const BASE_TIME = Date.parse("2026-10-16T12:00:00.000Z");

export class FakeProviderClient implements ComfyProviderClient {
  readonly uploadCalls: UploadAssetInput[] = [];
  readonly submitCalls: SubmitJobInput[] = [];
  readonly pollCalls: string[] = [];
  readonly cancelCalls: string[] = [];

  uploadResult: ComfyAsset = {
    id: "asset_remote_1",
    hash: null,
    size_bytes: PNG_BYTES.byteLength,
    content_type: "image/png",
    url: "https://api.comfy.test/assets/asset_remote_1",
    url_expires_at: "2026-10-18T12:00:00.000Z",
  };

  submitResult: ComfyJob = {
    id: "job_remote_1",
    status: "queued",
    outputs: [],
    error: null,
    urls: {
      self: "https://api.comfy.test/api/v2/jobs/job_remote_1",
      events: "https://api.comfy.test/api/v2/jobs/job_remote_1/events",
      cancel: "https://api.comfy.test/api/v2/jobs/job_remote_1/cancel",
    },
  };

  pollResult: ComfyJob = {
    ...this.submitResult,
    status: "running",
  };

  cancelResult: ComfyJob = {
    ...this.submitResult,
    status: "canceled",
  };

  async uploadAsset(input: UploadAssetInput): Promise<ComfyAsset> {
    this.uploadCalls.push(input);
    return structuredClone(this.uploadResult);
  }

  async submitJob(input: SubmitJobInput): Promise<ComfyJob> {
    this.submitCalls.push(input);
    return structuredClone(this.submitResult);
  }

  async pollJob(providerUrl: string): Promise<ComfyJob> {
    this.pollCalls.push(providerUrl);
    return structuredClone(this.pollResult);
  }

  async cancelJob(providerUrl: string): Promise<ComfyJob> {
    this.cancelCalls.push(providerUrl);
    return structuredClone(this.cancelResult);
  }
}

export function createHarness() {
  const assets = new InMemoryAssetStore();
  const jobs = new InMemoryJobStore();
  const provider = new FakeProviderClient();
  let idSequence = 0;
  let timeSequence = 0;
  const dependencies: V1Dependencies = {
    assets,
    jobs,
    provider,
    timeShiftWorkflowVersion: "ltx2.5-timeshift-v1",
    createId: (prefix) => `${prefix}_test_${++idSequence}`,
    now: () => new Date(BASE_TIME + timeSequence++ * 1_000),
  };

  return { dependencies, assets, jobs, provider };
}

export async function respond(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    return fromError(error);
  }
}

export function jsonRequest(path: string, body: unknown, method = "POST"): Request {
  return new Request(`${BASE_URL}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
