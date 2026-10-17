import type { Env } from "./env";
import { createApp } from "./app";
import { readConfig } from "./env";
import { ComfyApiClient } from "./provider/comfy-api";
import { timeShiftWorkflowVersion } from "./provider/timeshift-workflow";
import { InMemoryAssetStore, InMemoryJobStore } from "./storage/memory";

// Deliberate isolate-scoped, non-durable state behind replaceable storage boundaries.
const stores = {
  assets: new InMemoryAssetStore(),
  jobs: new InMemoryJobStore(),
};

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const config = readConfig(env);
    const app = createApp({
      ...stores,
      provider: new ComfyApiClient({
        baseUrl: config.comfyBaseUrl,
        apiKey: config.comfyApiKey,
        fetch: globalThis.fetch.bind(globalThis),
      }),
      timeShiftWorkflowVersion: timeShiftWorkflowVersion(),
      createId: (prefix) => `${prefix}_${crypto.randomUUID()}`,
      now: () => new Date(),
    });
    return app.fetch(request);
  },
} satisfies ExportedHandler<Env>;
