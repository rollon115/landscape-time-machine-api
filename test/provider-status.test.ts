import { describe, expect, it } from "vitest";
import { ComfyProtocolError } from "../src/provider/contracts";
import { translateProviderStatus } from "../src/provider/status";

describe("translateProviderStatus", () => {
  it.each([
    ["queued", "queued"],
    ["running", "running"],
    ["canceling", "running"],
    ["succeeded", "succeeded"],
    ["canceled", "cancelled"],
    ["failed", "failed"],
    ["expired", "failed"],
  ] as const)("maps %s to %s", (providerStatus, localStatus) => {
    expect(translateProviderStatus(providerStatus)).toBe(localStatus);
  });

  it.each(["unknown", "cancelled", "", null, 1])(
    "rejects the unknown provider status %j as a protocol error",
    (providerStatus) => {
      expect(() => translateProviderStatus(providerStatus)).toThrow(ComfyProtocolError);
    },
  );
});
