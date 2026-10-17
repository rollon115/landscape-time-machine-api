import type {
  ComfyApiClientOptions,
  ComfyAsset,
  ComfyJob,
  ComfyOperation,
  SubmitJobInput,
  UploadAssetInput,
} from "./contracts";
import { ComfyHttpTransport } from "./comfy-http";
import {
  endpointUrl,
  parseAssetResponse,
  parseBaseUrl,
  parseJobResponse,
  providerUrl,
  requireInput,
  validateMetadata,
} from "./comfy-protocol";

export class ComfyApiClient {
  readonly #baseUrl: URL;
  readonly #apiKey: string;
  readonly #transport: ComfyHttpTransport;

  constructor(options: ComfyApiClientOptions) {
    this.#baseUrl = parseBaseUrl(options.baseUrl);
    this.#apiKey = requireInput(options.apiKey, "apiKey");
    this.#transport = new ComfyHttpTransport(this.#apiKey, options.fetch);
  }

  async uploadAsset(input: UploadAssetInput): Promise<ComfyAsset> {
    const contentType = requireInput(input.contentType, "contentType");
    const filePath = requireInput(input.filePath, "filePath");
    const idempotencyKey = requireInput(input.idempotencyKey, "idempotencyKey");
    const form = new FormData();
    const filename = filePath.split(/[\\/]/).filter(Boolean).at(-1) ?? "upload";
    form.append("file", input.file, filename);
    form.append("content_type", contentType);
    form.append("file_path", filePath);

    return this.#transport.request(
      "uploadAsset",
      this.#endpoint("/api/v2/assets"),
      { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: form },
      true,
      (value) => parseAssetResponse(value, "uploadAsset"),
    );
  }

  async submitJob(input: SubmitJobInput): Promise<ComfyJob> {
    const idempotencyKey = requireInput(input.idempotencyKey, "idempotencyKey");
    const metadata = validateMetadata(input.metadata);
    const body = metadata === undefined
      ? { workflow: input.workflow }
      : { workflow: input.workflow, metadata };

    return this.#transport.request(
      "submitJob",
      this.#endpoint("/api/v2/jobs"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      },
      true,
      (value) => this.#parseJob(value, "submitJob"),
    );
  }

  async pollJob(providerUrl: string): Promise<ComfyJob> {
    return this.#transport.request(
      "pollJob",
      this.#providerUrl(providerUrl, "pollJob"),
      { method: "GET" },
      false,
      (value) => this.#parseJob(value, "pollJob"),
    );
  }

  async cancelJob(providerUrl: string): Promise<ComfyJob> {
    return this.#transport.request(
      "cancelJob",
      this.#providerUrl(providerUrl, "cancelJob"),
      { method: "POST" },
      true,
      (value) => this.#parseJob(value, "cancelJob"),
    );
  }

  #endpoint(path: string): URL {
    return endpointUrl(this.#baseUrl, path);
  }

  #providerUrl(value: string, operation: ComfyOperation): URL {
    return providerUrl(value, operation, this.#baseUrl, this.#apiKey);
  }

  #parseJob(value: unknown, operation: ComfyOperation): ComfyJob {
    return parseJobResponse(value, operation, this.#baseUrl, this.#apiKey);
  }
}
