import { ComfyProtocolError } from "./contracts";
import type {
  ComfyAsset,
  ComfyJob,
  ComfyJobExecutionError,
  ComfyJobUrls,
  ComfyOperation,
} from "./contracts";
import { isProviderStatus } from "./status";

type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function throwProtocolError(operation: ComfyOperation, detail: string): never {
  throw new ComfyProtocolError(`Invalid Comfy API response: ${detail}`, operation);
}

function requiredString(
  record: JsonRecord,
  field: string,
  operation: ComfyOperation,
): string {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throwProtocolError(operation, `${field} must be a non-empty string.`);
  }
  return value;
}

function optionalString(
  record: JsonRecord,
  field: string,
  operation: ComfyOperation,
): string | undefined {
  const value = record[field];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) {
    throwProtocolError(operation, `${field} must be a non-empty string when present.`);
  }
  return value;
}

export function requireInput(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new TypeError(`${field} must be a non-empty string.`);
  return trimmed;
}

export function redactText(value: string, secret: string): string {
  return value.split(secret).join("[REDACTED]");
}

export function redactSecret(value: unknown, secret: string): unknown {
  if (typeof value === "string") return redactText(value, secret);
  if (Array.isArray(value)) return value.map((item) => redactSecret(item, secret));
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      redactText(key, secret),
      redactSecret(item, secret),
    ]),
  );
}

function containsSecret(value: string, secret: string): boolean {
  if (value.includes(secret)) return true;
  const decoded = value.replace(/(?:%[0-9A-Fa-f]{2})+/g, (encoded) => {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  });
  return decoded.includes(secret);
}

export function validateMetadata(value: unknown): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new TypeError("metadata must be an object with string values.");
  }

  const entries: [string, string][] = [];
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "string") {
      throw new TypeError("metadata must contain only string values.");
    }
    entries.push([key, item]);
  }
  return Object.fromEntries(entries);
}

export function parseBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("baseUrl must be an absolute HTTP or HTTPS URL.");
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0
  ) {
    throw new TypeError(
      "baseUrl must use HTTP(S) without credentials, a query, or a fragment.",
    );
  }
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url;
}

export function endpointUrl(baseUrl: URL, path: string): URL {
  return new URL(`${baseUrl.href.replace(/\/$/, "")}${path}`);
}

export function providerUrl(
  value: string,
  operation: ComfyOperation,
  baseUrl: URL,
  secret: string,
): URL {
  if (typeof value !== "string" || value.length === 0) {
    throwProtocolError(operation, "provider URL must be a non-empty string.");
  }
  if (containsSecret(value, secret)) {
    throwProtocolError(operation, "provider URL must not contain credentials.");
  }

  let url: URL;
  try {
    url = new URL(value, `${baseUrl.href.replace(/\/$/, "")}/`);
  } catch {
    throwProtocolError(operation, "provider URL must be valid.");
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.origin !== baseUrl.origin ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    throwProtocolError(operation, "provider URL must use HTTP(S) on the configured origin.");
  }
  if (containsSecret(url.href, secret)) {
    throwProtocolError(operation, "provider URL must not contain credentials.");
  }
  return url;
}

function parseExecutionError(
  value: unknown,
  operation: ComfyOperation,
  secret: string,
): ComfyJobExecutionError | null {
  if (value === null) return null;
  if (!isRecord(value)) throwProtocolError(operation, "error must be an object or null.");

  const rawNodeErrors = value.node_errors;
  if (rawNodeErrors !== undefined && !isRecord(rawNodeErrors)) {
    throwProtocolError(operation, "error.node_errors must be an object when present.");
  }
  const nodeErrors = rawNodeErrors === undefined
    ? undefined
    : redactSecret(rawNodeErrors, secret);
  if (nodeErrors !== undefined && !isRecord(nodeErrors)) {
    throwProtocolError(operation, "error.node_errors must remain an object after redaction.");
  }
  const nodeId = optionalString(value, "node_id", operation);
  const classType = optionalString(value, "class_type", operation);
  const traceback = optionalString(value, "traceback", operation);

  return {
    code: redactText(requiredString(value, "code", operation), secret),
    message: redactText(requiredString(value, "message", operation), secret),
    ...(nodeId === undefined ? {} : { node_id: redactText(nodeId, secret) }),
    ...(classType === undefined ? {} : { class_type: redactText(classType, secret) }),
    ...(traceback === undefined ? {} : { traceback: redactText(traceback, secret) }),
    ...(nodeErrors === undefined ? {} : { node_errors: nodeErrors }),
  };
}

export function parseAssetResponse(value: unknown, operation: ComfyOperation): ComfyAsset {
  if (!isRecord(value)) throwProtocolError(operation, "asset must be an object.");
  if (value.hash !== null && typeof value.hash !== "string") {
    throwProtocolError(operation, "asset.hash must be a string or null.");
  }
  const sizeBytes = value.size_bytes;
  if (typeof sizeBytes !== "number" || !Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
    throwProtocolError(operation, "asset.size_bytes must be a non-negative integer.");
  }

  return {
    id: requiredString(value, "id", operation),
    hash: value.hash,
    size_bytes: sizeBytes,
    content_type: requiredString(value, "content_type", operation),
    url: requiredString(value, "url", operation),
    url_expires_at: requiredString(value, "url_expires_at", operation),
  };
}

export function parseJobResponse(
  value: unknown,
  operation: ComfyOperation,
  baseUrl: URL,
  secret: string,
): ComfyJob {
  if (!isRecord(value)) throwProtocolError(operation, "job must be an object.");
  if (!isProviderStatus(value.status)) {
    throwProtocolError(operation, "job.status is unknown.");
  }
  if (!Array.isArray(value.outputs)) {
    throwProtocolError(operation, "job.outputs must be an array.");
  }
  if (!isRecord(value.urls)) throwProtocolError(operation, "job.urls must be an object.");

  const urls: ComfyJobUrls = {
    self: providerUrl(requiredString(value.urls, "self", operation), operation, baseUrl, secret)
      .href,
    events: providerUrl(
      requiredString(value.urls, "events", operation),
      operation,
      baseUrl,
      secret,
    ).href,
    cancel: providerUrl(
      requiredString(value.urls, "cancel", operation),
      operation,
      baseUrl,
      secret,
    ).href,
  };
  const logs = optionalString(value.urls, "logs", operation);
  if (logs !== undefined) urls.logs = providerUrl(logs, operation, baseUrl, secret).href;

  return {
    id: requiredString(value, "id", operation),
    status: value.status,
    outputs: [...value.outputs],
    error: parseExecutionError(value.error, operation, secret),
    urls,
  };
}
