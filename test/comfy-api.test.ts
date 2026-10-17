import { describe, expect, it } from "vitest";
import {
  ComfyHttpError,
  ComfyProtocolError,
  ComfyTransportError,
  type FetchLike,
} from "../src/provider/contracts";
import { ComfyApiClient } from "../src/provider/comfy-api";

const BASE_URL = "https://api.comfy.test";
const API_KEY = "test-api-key-that-must-stay-private";

type FetchHandler = (request: Request, callIndex: number) => Response | Promise<Response>;

function createFetch(handler: FetchHandler): { fetch: FetchLike; calls: Request[] } {
  const calls: Request[] = [];
  const fetch: FetchLike = async (input, init) => {
    const request = new Request(input, init);
    calls.push(request.clone());
    return handler(request, calls.length - 1);
  };
  return { fetch, calls };
}

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function bodyStreamErrorResponse(): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(new Error("response body stream failed"));
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function jobResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "job_123",
    status: "queued",
    outputs: [],
    error: null,
    urls: {
      self: "/api/v2/jobs/job_123",
      events: "/api/v2/jobs/job_123/events",
      cancel: "/api/v2/jobs/job_123/cancel",
      logs: "/api/v2/jobs/job_123/logs",
    },
    ...overrides,
  };
}

function createClient(handler: FetchHandler): {
  client: ComfyApiClient;
  calls: Request[];
} {
  const fake = createFetch(handler);
  return {
    client: new ComfyApiClient({ baseUrl: BASE_URL, apiKey: API_KEY, fetch: fake.fetch }),
    calls: fake.calls,
  };
}

describe("ComfyApiClient", () => {
  it("uploads an asset as authenticated multipart data with an explicit idempotency key", async () => {
    const expectedAsset = {
      id: "asset_123",
      hash: null,
      size_bytes: 11,
      content_type: "image/png",
      url: "https://assets.comfy.test/asset_123",
      url_expires_at: "2026-10-18T12:00:00.000Z",
    };
    const { client, calls } = createClient((request) => {
      expect(request.url).toBe(`${BASE_URL}/api/v2/assets`);
      expect(request.method).toBe("POST");
      expect(request.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
      expect(request.headers.get("idempotency-key")).toBe("asset-request-1");
      expect(request.headers.get("content-type")).toMatch(/^multipart\/form-data; boundary=/);
      return jsonResponse(expectedAsset, 201);
    });

    const asset = await client.uploadAsset({
      file: new Blob(["image-bytes"], { type: "image/png" }),
      contentType: "image/png",
      filePath: "inputs/landscape.png",
      idempotencyKey: "asset-request-1",
    });

    expect(asset).toEqual(expectedAsset);
    expect(calls).toHaveLength(1);
    const form = await calls[0]!.formData();
    expect(form.get("content_type")).toBe("image/png");
    expect(form.get("file_path")).toBe("inputs/landscape.png");
    const uploadedFile = form.get("file");
    expect(uploadedFile).toBeInstanceOf(Blob);
    expect((uploadedFile as Blob).type).toBe("image/png");
    await expect((uploadedFile as Blob).text()).resolves.toBe("image-bytes");
  });

  it("submits a JSON workflow without retries and normalizes provider job URLs", async () => {
    const workflow = { "1": { class_type: "LoadImage", inputs: { image: "asset_123" } } };
    const metadata = { localJobId: "ltm_123" };
    const { client, calls } = createClient((request) => {
      expect(request.url).toBe(`${BASE_URL}/api/v2/jobs`);
      expect(request.method).toBe("POST");
      expect(request.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
      expect(request.headers.get("idempotency-key")).toBe("job-request-1");
      expect(request.headers.get("content-type")).toBe("application/json");
      return jsonResponse(jobResponse(), 201);
    });

    const job = await client.submitJob({
      workflow,
      metadata,
      idempotencyKey: "job-request-1",
    });

    expect(calls).toHaveLength(1);
    await expect(calls[0]!.json()).resolves.toEqual({ workflow, metadata });
    expect(job).toMatchObject({ id: "job_123", status: "queued", outputs: [], error: null });
    expect(job.urls).toEqual({
      self: `${BASE_URL}/api/v2/jobs/job_123`,
      events: `${BASE_URL}/api/v2/jobs/job_123/events`,
      cancel: `${BASE_URL}/api/v2/jobs/job_123/cancel`,
      logs: `${BASE_URL}/api/v2/jobs/job_123/logs`,
    });
  });

  it("preserves a configured base path for fixed API endpoints", async () => {
    const fake = createFetch((request) => {
      expect(request.url).toBe(`${BASE_URL}/provider-prefix/api/v2/jobs`);
      return jsonResponse(jobResponse(), 201);
    });
    const client = new ComfyApiClient({
      baseUrl: `${BASE_URL}/provider-prefix/`,
      apiKey: API_KEY,
      fetch: fake.fetch,
    });

    await client.submitJob({ workflow: {}, idempotencyKey: "prefixed-base" });

    expect(fake.calls).toHaveLength(1);
  });

  it("polls and cancels through same-origin provider URLs", async () => {
    const { client, calls } = createClient((request, callIndex) => {
      if (callIndex === 0) {
        expect(request.url).toBe(`${BASE_URL}/api/v2/jobs/job_123`);
        expect(request.method).toBe("GET");
        return jsonResponse(jobResponse({ status: "running" }));
      }
      expect(request.url).toBe(`${BASE_URL}/api/v2/jobs/job_123/cancel`);
      expect(request.method).toBe("POST");
      return jsonResponse(jobResponse({ status: "canceled" }));
    });

    const running = await client.pollJob("/api/v2/jobs/job_123");
    const canceled = await client.cancelJob(`${BASE_URL}/api/v2/jobs/job_123/cancel`);

    expect(running.status).toBe("running");
    expect(canceled.status).toBe("canceled");
    expect(calls).toHaveLength(2);
    expect(calls.every((request) => request.headers.get("authorization") === `Bearer ${API_KEY}`))
      .toBe(true);
  });

  it.each([
    "https://attacker.example/api/v2/jobs/job_123",
    "ftp://api.comfy.test/api/v2/jobs/job_123",
  ])("rejects an unsafe provider URL before fetching: %s", async (providerUrl) => {
    const { client, calls } = createClient(() => {
      throw new Error("fetch must not be called");
    });

    await expect(client.pollJob(providerUrl)).rejects.toBeInstanceOf(ComfyProtocolError);
    expect(calls).toHaveLength(0);
  });

  it("rejects a cross-origin URL embedded in a provider job response", async () => {
    const { client } = createClient(() =>
      jsonResponse(
        jobResponse({
          urls: {
            self: "/api/v2/jobs/job_123",
            events: "/api/v2/jobs/job_123/events",
            cancel: "https://attacker.example/cancel",
          },
        }),
      ),
    );

    await expect(
      client.submitJob({ workflow: {}, idempotencyKey: "job-request-2" }),
    ).rejects.toBeInstanceOf(ComfyProtocolError);
  });

  it("rejects a credential-bearing follow-up URL without retaining it", async () => {
    const urlCredential = "secret/value+token";
    const fake = createFetch(() =>
      jsonResponse(
        jobResponse({
          urls: {
            self: `/api/v2/jobs/job_123?credential=${encodeURIComponent(urlCredential)}`,
            events: "/api/v2/jobs/job_123/events",
            cancel: "/api/v2/jobs/job_123/cancel",
          },
        }),
      ),
    );
    const client = new ComfyApiClient({
      baseUrl: BASE_URL,
      apiKey: urlCredential,
      fetch: fake.fetch,
    });

    const error = await client
      .submitJob({ workflow: {}, idempotencyKey: "secret-url" })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(ComfyProtocolError);
    expect(JSON.stringify(error)).not.toContain(urlCredential);
  });

  it.each([
    { response: { id: "asset_123" }, operation: "uploadAsset" },
    { response: jobResponse({ status: "mystery" }), operation: "submitJob" },
    { response: jobResponse({ outputs: null }), operation: "submitJob" },
    { response: jobResponse({ error: { code: 10, message: "Broken" } }), operation: "submitJob" },
  ])("rejects malformed successful $operation responses", async ({ response, operation }) => {
    const { client } = createClient(() => jsonResponse(response, 200));
    const request =
      operation === "uploadAsset"
        ? client.uploadAsset({
            file: new Blob(["x"]),
            contentType: "image/png",
            filePath: "input.png",
            idempotencyKey: "asset-malformed",
          })
        : client.submitJob({ workflow: {}, idempotencyKey: "job-malformed" });

    await expect(request).rejects.toMatchObject({
      name: "ComfyProtocolError",
      operation,
    });
  });

  it("preserves a valid job execution error", async () => {
    const executionError = {
      code: "node_execution_error",
      message: "A workflow node failed.",
      node_id: "17",
      class_type: "KSampler",
      traceback: "sanitized traceback",
      node_errors: { "17": { errors: ["invalid input"] } },
    };
    const { client } = createClient(() =>
      jsonResponse(jobResponse({ status: "failed", error: executionError })),
    );

    const job = await client.pollJob("/api/v2/jobs/job_123");

    expect(job.error).toEqual(executionError);
  });

  it("recursively redacts credentials from provider job execution errors", async () => {
    const { client } = createClient(() =>
      jsonResponse(
        jobResponse({
          status: "failed",
          error: {
            code: `failure_${API_KEY}`,
            message: `Execution failed for ${API_KEY}.`,
            traceback: `trace includes ${API_KEY}`,
            node_errors: {
              [API_KEY]: {
                errors: [`Nested message includes ${API_KEY}.`],
                context: { credential: API_KEY },
              },
            },
          },
        }),
      ),
    );

    const job = await client.pollJob("/api/v2/jobs/job_123");

    expect(job.error).toEqual({
      code: "failure_[REDACTED]",
      message: "Execution failed for [REDACTED].",
      traceback: "trace includes [REDACTED]",
      node_errors: {
        "[REDACTED]": {
          errors: ["Nested message includes [REDACTED]."],
          context: { credential: "[REDACTED]" },
        },
      },
    });
    expect(JSON.stringify(job)).not.toContain(API_KEY);
  });

  it("captures the provider HTTP envelope and Retry-After without exposing credentials", async () => {
    const { client } = createClient(() =>
      jsonResponse(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests.",
            organization_id: "org_123",
            details: { limit: 5, echoed_key: API_KEY },
          },
        },
        429,
        { "retry-after": "12" },
      ),
    );

    const error = await client.pollJob("/api/v2/jobs/job_123").catch((caught) => caught);

    expect(error).toBeInstanceOf(ComfyHttpError);
    expect(error).toMatchObject({
      status: 429,
      providerCode: "RATE_LIMITED",
      providerMessage: "Too many requests.",
      organizationId: "org_123",
      details: { limit: 5, echoed_key: "[REDACTED]" },
      retryAfter: "12",
    });
    expect(String(error)).not.toContain(API_KEY);
    expect(JSON.stringify(error)).not.toContain(API_KEY);
  });

  it("captures the malformed-request message from a bare 400 response", async () => {
    const { client } = createClient(() => jsonResponse({ message: "Malformed request." }, 400));

    const error = await client.submitJob({ workflow: {}, idempotencyKey: "job-request-3" }).catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(ComfyHttpError);
    expect(error).toMatchObject({
      status: 400,
      providerCode: undefined,
      providerMessage: "Malformed request.",
      retryAfter: undefined,
    });
  });

  it("keeps invalid JSON classified as a protocol error", async () => {
    const { client } = createClient(() =>
      new Response("{not-json", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      client.submitJob({ workflow: {}, idempotencyKey: "invalid-json" }),
    ).rejects.toMatchObject({ name: "ComfyProtocolError", operation: "submitJob" });
  });

  it.each([
    [
      "uploadAsset",
      (client: ComfyApiClient) =>
        client.uploadAsset({
          file: new Blob(["x"]),
          contentType: "image/png",
          filePath: "input.png",
          idempotencyKey: "asset-body-stream",
        }),
    ],
    [
      "submitJob",
      (client: ComfyApiClient) =>
        client.submitJob({ workflow: {}, idempotencyKey: "job-body-stream" }),
    ],
    [
      "cancelJob",
      (client: ComfyApiClient) => client.cancelJob("/api/v2/jobs/job_123/cancel"),
    ],
  ] as const)(
    "classifies a successful %s body-stream failure as an ambiguous transport error",
    async (operation, invoke) => {
      const { client, calls } = createClient(() => bodyStreamErrorResponse());

      await expect(invoke(client)).rejects.toMatchObject({
        name: "ComfyTransportError",
        operation,
        ambiguous: true,
      });
      expect(calls).toHaveLength(1);
    },
  );

  it("classifies a successful poll body-stream failure as non-ambiguous", async () => {
    const { client } = createClient(() => bodyStreamErrorResponse());

    await expect(client.pollJob("/api/v2/jobs/job_123")).rejects.toMatchObject({
      name: "ComfyTransportError",
      operation: "pollJob",
      ambiguous: false,
    });
  });

  it("uses manual redirect handling and reports redirects without following them", async () => {
    const { client, calls } = createClient((request) => {
      expect(request.redirect).toBe("manual");
      return new Response(null, {
        status: 307,
        headers: { location: "https://attacker.example/collect" },
      });
    });

    const error = await client
      .submitJob({ workflow: {}, idempotencyKey: "redirect-policy" })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(ComfyHttpError);
    expect(error).toMatchObject({ status: 307, operation: "submitJob" });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(`${BASE_URL}/api/v2/jobs`);
  });

  it("rejects non-string metadata values before calling fetch", async () => {
    const { client, calls } = createClient(() => {
      throw new Error("fetch must not be called");
    });

    const request = Reflect.apply(client.submitJob, client, [
      {
        workflow: {},
        metadata: { localJobId: 123 },
        idempotencyKey: "invalid-metadata",
      },
    ]);

    await expect(request).rejects.toThrow(TypeError);
    expect(calls).toHaveLength(0);
  });

  it("marks a submit transport failure as ambiguous and never retries", async () => {
    const { client, calls } = createClient(() => {
      throw new Error(`socket closed near ${API_KEY}`);
    });

    const error = await client
      .submitJob({ workflow: {}, idempotencyKey: "single-use-key" })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(ComfyTransportError);
    expect(error).toMatchObject({ operation: "submitJob", ambiguous: true });
    expect(String(error)).not.toContain(API_KEY);
    expect(calls).toHaveLength(1);
  });

  it("marks a polling transport failure as non-ambiguous", async () => {
    const { client } = createClient(() => {
      throw new TypeError("network unavailable");
    });

    await expect(client.pollJob("/api/v2/jobs/job_123")).rejects.toMatchObject({
      name: "ComfyTransportError",
      operation: "pollJob",
      ambiguous: false,
    });
  });
});
