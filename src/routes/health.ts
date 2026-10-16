import { SERVICE_NAME, SERVICE_VERSION, json } from "../http";

/** `GET /health` — liveness probe with a stable, documented shape. */
export function handleHealth(): Response {
  return json({
    ok: true,
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
  });
}
