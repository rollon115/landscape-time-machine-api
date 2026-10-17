export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type ComfyOperation = "uploadAsset" | "submitJob" | "pollJob" | "cancelJob";

export type ComfyJobStatus =
  | "queued"
  | "running"
  | "canceling"
  | "succeeded"
  | "canceled"
  | "failed"
  | "expired";

export interface ComfyAsset {
  id: string;
  hash: string | null;
  size_bytes: number;
  content_type: string;
  url: string;
  url_expires_at: string;
}

export interface ComfyJobExecutionError {
  code: string;
  message: string;
  node_id?: string;
  class_type?: string;
  traceback?: string;
  node_errors?: Record<string, unknown>;
}

export interface ComfyJobUrls {
  self: string;
  events: string;
  cancel: string;
  logs?: string;
}

export interface ComfyJob {
  id: string;
  status: ComfyJobStatus;
  outputs: unknown[];
  error: ComfyJobExecutionError | null;
  urls: ComfyJobUrls;
}

export type ComfyWorkflow = Record<string, unknown>;
export type ComfyJobMetadata = Record<string, string>;

export interface ComfyApiClientOptions {
  baseUrl: string;
  apiKey: string;
  fetch: FetchLike;
}

export interface UploadAssetInput {
  file: Blob;
  contentType: string;
  filePath: string;
  idempotencyKey: string;
}

export interface SubmitJobInput {
  workflow: ComfyWorkflow;
  metadata?: ComfyJobMetadata;
  idempotencyKey: string;
}

export class ComfyProtocolError extends Error {
  constructor(
    message: string,
    public readonly operation?: ComfyOperation,
  ) {
    super(message);
    this.name = "ComfyProtocolError";
  }
}

interface ComfyHttpErrorOptions {
  operation: ComfyOperation;
  status: number;
  providerCode?: string;
  providerMessage: string;
  organizationId?: string;
  details?: unknown;
  retryAfter?: string;
}

export class ComfyHttpError extends Error {
  readonly operation: ComfyOperation;
  readonly status: number;
  readonly providerCode?: string;
  readonly providerMessage: string;
  readonly organizationId?: string;
  readonly details?: unknown;
  readonly retryAfter?: string;

  constructor(options: ComfyHttpErrorOptions) {
    super(`Comfy API request failed with HTTP ${options.status}: ${options.providerMessage}`);
    this.name = "ComfyHttpError";
    this.operation = options.operation;
    this.status = options.status;
    this.providerCode = options.providerCode;
    this.providerMessage = options.providerMessage;
    this.organizationId = options.organizationId;
    this.details = options.details;
    this.retryAfter = options.retryAfter;
  }
}

export class ComfyTransportError extends Error {
  constructor(
    public readonly operation: ComfyOperation,
    public readonly ambiguous: boolean,
  ) {
    super(
      ambiguous
        ? `Comfy API transport failed during ${operation}; the remote outcome may be ambiguous.`
        : `Comfy API transport failed during ${operation}.`,
    );
    this.name = "ComfyTransportError";
  }
}
