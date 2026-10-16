export const SERVICE_NAME = "landscape-time-machine";
export const SERVICE_VERSION = "0.1.0";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

/** Build a JSON response with the shared content type. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": JSON_CONTENT_TYPE },
  });
}

/** Canonical JSON 404 for an unmatched route. */
export function notFound(pathname: string): Response {
  return json({ ok: false, error: "not_found", path: pathname }, 404);
}
