import type { Env } from "./env";
import { notFound } from "./http";
import { handleHealth } from "./routes/health";

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "GET" && pathname === "/health") {
      return handleHealth();
    }

    // `/v1/*` route groups are attached in LTM-002.
    return notFound(pathname);
  },
} satisfies ExportedHandler<Env>;
