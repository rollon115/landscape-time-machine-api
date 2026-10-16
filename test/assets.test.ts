import { describe, expect, it } from "vitest";
import { createAsset, MAX_ASSET_BYTES } from "../src/routes/assets";
import {
  BASE_URL,
  createHarness,
  jsonRequest,
  PNG_BYTES,
  respond,
} from "./v1-test-helpers";

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

function fileRequest(file: File, extra?: (form: FormData) => void): Request {
  const form = new FormData();
  form.append("file", file);
  extra?.(form);
  return new Request(`${BASE_URL}/v1/assets`, { method: "POST", body: form });
}

describe("POST /v1/assets", () => {
  it("stores one valid image and returns bounded public metadata", async () => {
    const { dependencies, assets } = createHarness();
    const response = await respond(() =>
      createAsset(
        fileRequest(new File([PNG_BYTES], "untrusted-extension.txt", { type: "image/png" })),
        dependencies,
      ),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      asset: {
        id: "ast_test_1",
        mediaType: "image/png",
        sizeBytes: PNG_BYTES.byteLength,
        createdAt: "2026-10-16T12:00:00.000Z",
      },
    });

    const stored = await assets.get("ast_test_1");
    expect(stored?.bytes).toEqual(PNG_BYTES);
    expect(stored).not.toHaveProperty("name");
  });

  it("preserves a case-sensitive multipart boundary while matching the media type", async () => {
    const { dependencies } = createHarness();
    const boundary = "AaB03x";
    const body = new Blob([
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="scene.png"\r\nContent-Type: image/png\r\n\r\n`,
      PNG_BYTES,
      `\r\n--${boundary}--\r\n`,
    ]);
    const request = new Request(`${BASE_URL}/v1/assets`, {
      method: "POST",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      body,
    });
    const response = await respond(() => createAsset(request, dependencies));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      asset: { mediaType: "image/png", sizeBytes: PNG_BYTES.byteLength },
    });
  });

  it("accepts JPEG bytes with the whitelisted MIME type", async () => {
    const { dependencies } = createHarness();
    const response = await respond(() =>
      createAsset(
        fileRequest(new File([JPEG_BYTES], "scene.bin", { type: "image/jpeg" })),
        dependencies,
      ),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      asset: { mediaType: "image/jpeg", sizeBytes: JPEG_BYTES.byteLength },
    });
  });

  it("requires multipart form data", async () => {
    const { dependencies } = createHarness();
    const response = await respond(() =>
      createAsset(jsonRequest("/v1/assets", { file: "not-a-file" }), dependencies),
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_MEDIA_TYPE" },
    });
  });

  it("requires exactly one file field", async () => {
    const { dependencies } = createHarness();
    const file = new File([PNG_BYTES], "scene.png", { type: "image/png" });
    const response = await respond(() =>
      createAsset(fileRequest(file, (form) => form.append("file", file)), dependencies),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_FILE_FIELD" },
    });
  });

  it("rejects empty, unsupported, and mislabelled files", async () => {
    const cases = [
      {
        file: new File([], "empty.png", { type: "image/png" }),
        status: 400,
        code: "EMPTY_FILE",
      },
      {
        file: new File([PNG_BYTES], "scene.gif", { type: "image/gif" }),
        status: 415,
        code: "UNSUPPORTED_FILE_TYPE",
      },
      {
        file: new File([new Uint8Array([1, 2, 3])], "fake.png", { type: "image/png" }),
        status: 400,
        code: "INVALID_FILE_CONTENT",
      },
    ];

    for (const testCase of cases) {
      const { dependencies } = createHarness();
      const response = await respond(() => createAsset(fileRequest(testCase.file), dependencies));
      expect(response.status).toBe(testCase.status);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: { code: testCase.code },
      });
    }
  });

  it("enforces the documented 20 MiB file limit", async () => {
    const { dependencies } = createHarness();
    const oversized = new File([new Uint8Array(MAX_ASSET_BYTES + 1)], "large.jpg", {
      type: "image/jpeg",
    });
    const response = await respond(() => createAsset(fileRequest(oversized), dependencies));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "FILE_TOO_LARGE", details: { maxBytes: MAX_ASSET_BYTES } },
    });
  });
});
