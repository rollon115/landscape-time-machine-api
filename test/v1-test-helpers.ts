import { fromError } from "../src/http";
import type { V1Dependencies } from "../src/routes/contracts";
import { InMemoryAssetStore, InMemoryJobStore } from "../src/storage/memory";

export const BASE_URL = "https://example.com";
export const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

const BASE_TIME = Date.parse("2026-10-16T12:00:00.000Z");

export function createHarness() {
  const assets = new InMemoryAssetStore();
  const jobs = new InMemoryJobStore();
  let idSequence = 0;
  let timeSequence = 0;
  const dependencies: V1Dependencies = {
    assets,
    jobs,
    createId: (prefix) => `${prefix}_test_${++idSequence}`,
    now: () => new Date(BASE_TIME + timeSequence++ * 1_000),
  };

  return { dependencies, assets, jobs };
}

export async function respond(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    return fromError(error);
  }
}

export function jsonRequest(path: string, body: unknown, method = "POST"): Request {
  return new Request(`${BASE_URL}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
