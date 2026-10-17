import { ComfyHttpError, ComfyTransportError } from "./contracts";
import type { ComfyApiClientOptions, ComfyOperation } from "./contracts";
import {
  isRecord,
  redactSecret,
  redactText,
  throwProtocolError,
} from "./comfy-protocol";

function isJsonSyntaxError(value: unknown): boolean {
  return value instanceof SyntaxError || (isRecord(value) && value.name === "SyntaxError");
}

export class ComfyHttpTransport {
  readonly #apiKey: string;
  readonly #fetch: ComfyApiClientOptions["fetch"];

  constructor(apiKey: string, fetch: ComfyApiClientOptions["fetch"]) {
    this.#apiKey = apiKey;
    this.#fetch = fetch;
  }

  async request<T>(
    operation: ComfyOperation,
    url: URL,
    init: RequestInit,
    ambiguousTransport: boolean,
    parse: (value: unknown) => T,
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${this.#apiKey}`);

    let response: Response;
    try {
      response = await this.#fetch(url, { ...init, headers, redirect: "manual" });
    } catch {
      throw new ComfyTransportError(operation, ambiguousTransport);
    }

    if (!response.ok) throw await this.#httpError(response, operation);

    let value: unknown;
    try {
      value = await response.json();
    } catch (error) {
      if (isJsonSyntaxError(error)) {
        throwProtocolError(operation, "response body must be valid JSON.");
      }
      throw new ComfyTransportError(operation, ambiguousTransport);
    }
    return parse(value);
  }

  async #httpError(response: Response, operation: ComfyOperation): Promise<ComfyHttpError> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }

    let providerCode: string | undefined;
    let providerMessage = "The provider returned an HTTP error.";
    let organizationId: string | undefined;
    let details: unknown;
    const retryAfter = response.headers.get("Retry-After");
    if (isRecord(body)) {
      if (isRecord(body.error)) {
        const envelope = body.error;
        if (typeof envelope.code === "string") {
          providerCode = redactText(envelope.code, this.#apiKey);
        }
        if (typeof envelope.message === "string" && envelope.message.length > 0) {
          providerMessage = redactText(envelope.message, this.#apiKey);
        }
        if (typeof envelope.organization_id === "string") {
          organizationId = redactText(envelope.organization_id, this.#apiKey);
        }
        details = redactSecret(envelope.details, this.#apiKey);
      } else if (typeof body.message === "string" && body.message.length > 0) {
        providerMessage = redactText(body.message, this.#apiKey);
      }
    }

    return new ComfyHttpError({
      operation,
      status: response.status,
      providerCode,
      providerMessage,
      organizationId,
      details,
      retryAfter: retryAfter === null ? undefined : redactText(retryAfter, this.#apiKey),
    });
  }
}
