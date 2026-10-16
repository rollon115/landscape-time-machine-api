import { HttpError, readBoundedBody } from "../http";

const MAX_JSON_BYTES = 16 * 1024;

export function contentType(request: Request): string {
  return request.headers.get("content-type") ?? "";
}

export function requestMediaType(request: Request): string {
  return contentType(request).split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (requestMediaType(request) !== "application/json") {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }
  const body = await readBoundedBody(
    request,
    MAX_JSON_BYTES,
    () => new HttpError(413, "PAYLOAD_TOO_LARGE", "JSON request body is too large."),
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new HttpError(400, "INVALID_REQUEST", "Request body must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}
