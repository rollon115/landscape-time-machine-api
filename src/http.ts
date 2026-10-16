export const SERVICE_NAME = "landscape-time-machine";
export const SERVICE_VERSION = "0.1.0";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

/** Build a JSON response with the shared content type. */
export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", JSON_CONTENT_TYPE);
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  headers?: HeadersInit,
): Response {
  const error: { code: string; message: string; details?: unknown } = { code, message };
  if (details !== undefined) error.details = details;
  return json({ ok: false, error }, status, headers);
}

export function fromError(error: unknown): Response {
  if (error instanceof HttpError) {
    return errorResponse(error.status, error.code, error.message, error.details);
  }
  return errorResponse(500, "INTERNAL_ERROR", "An internal error occurred.");
}

/** Canonical JSON 404 for an unmatched route. */
export function notFound(pathname: string): Response {
  return errorResponse(404, "ROUTE_NOT_FOUND", "Route not found.", { path: pathname });
}

export function methodNotAllowed(method: string, allowed: readonly string[]): Response {
  return errorResponse(
    405,
    "METHOD_NOT_ALLOWED",
    "Method not allowed.",
    { method, allowed },
    { allow: allowed.join(", ") },
  );
}

/** Read a request body with a hard cap even when Content-Length is absent. */
export async function readBoundedBody(
  request: Request,
  maxBytes: number,
  tooLarge: () => HttpError,
): Promise<Uint8Array> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) throw tooLarge();
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size error below is authoritative even if cancellation is unavailable.
        }
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
