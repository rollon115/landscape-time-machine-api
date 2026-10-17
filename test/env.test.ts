import { describe, expect, it } from "vitest";
import { ConfigError, readConfig } from "../src/env";

describe("readConfig", () => {
  it("normalizes configured values", () => {
    expect(
      readConfig({
        COMFY_API_KEY: "  test-key-not-a-real-secret  ",
        COMFY_BASE_URL: "https://cloud.comfy.org///",
      }),
    ).toEqual({
      comfyApiKey: "test-key-not-a-real-secret",
      comfyBaseUrl: "https://cloud.comfy.org",
    });
  });

  it("uses the documented default base URL", () => {
    expect(readConfig({ COMFY_API_KEY: "test-key" }).comfyBaseUrl).toBe(
      "https://cloud.comfy.org",
    );
  });

  it("reports missing binding names without a secret value", () => {
    try {
      readConfig({ COMFY_API_KEY: "   " });
      throw new Error("Expected readConfig to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect(error).toMatchObject({ missing: ["COMFY_API_KEY"] });
      expect((error as Error).message).toBe(
        "Missing required configuration: COMFY_API_KEY",
      );
    }
  });
});
