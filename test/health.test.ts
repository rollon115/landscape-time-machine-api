import { describe, expect, it } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/env";

const env: Env = {
  COMFY_API_KEY: "test-key-not-a-real-secret",
  COMFY_BASE_URL: "https://cloud.comfy.org",
};

async function get(path: string): Promise<Response> {
  const request = new Request(`https://example.com${path}`);
  return worker.fetch(request, env, {} as ExecutionContext);
}

describe("GET /health", () => {
  it("returns 200 with the documented JSON shape", async () => {
    const response = await get("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "landscape-time-machine",
      version: "0.1.0",
    });
  });
});

describe("unknown route", () => {
  it("returns a JSON 404 that names the requested path", async () => {
    const response = await get("/v1/does-not-exist");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "Route not found.",
        details: { path: "/v1/does-not-exist" },
      },
    });
  });
});
