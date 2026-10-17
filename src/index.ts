import type { Env } from "./env";
import { createApp } from "./app";
import { InMemoryAssetStore, InMemoryJobStore } from "./storage/memory";

// Deliberate isolate-scoped, non-durable state behind replaceable storage boundaries.
const app = createApp({
  assets: new InMemoryAssetStore(),
  jobs: new InMemoryJobStore(),
  createId: (prefix) => `${prefix}_${crypto.randomUUID()}`,
  now: () => new Date(),
});

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request);
  },
} satisfies ExportedHandler<Env>;
