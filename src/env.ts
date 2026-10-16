/**
 * Runtime bindings for the Worker.
 *
 * `COMFY_API_KEY` is a server-only secret: it is never logged and never
 * included in any response body.
 */
export interface Env {
  COMFY_API_KEY: string;
  COMFY_BASE_URL?: string;
}

export interface AppConfig {
  /** Comfy Cloud API base URL, without a trailing slash. */
  comfyBaseUrl: string;
  /** Server-only Comfy Cloud credential. */
  comfyApiKey: string;
}

export class ConfigError extends Error {
  constructor(public readonly missing: readonly string[]) {
    super(`Missing required configuration: ${missing.join(", ")}`);
    this.name = "ConfigError";
  }
}

const DEFAULT_COMFY_BASE_URL = "https://api.comfy.org";

/**
 * Validate the runtime configuration.
 *
 * Throws `ConfigError` naming every missing key. The error never contains a
 * secret value, only the name of the binding that is absent.
 */
export function readConfig(env: Partial<Env>): AppConfig {
  const comfyApiKey = env.COMFY_API_KEY?.trim();
  const missing: string[] = [];
  if (!comfyApiKey) missing.push("COMFY_API_KEY");
  if (missing.length > 0) throw new ConfigError(missing);

  const comfyBaseUrl = (env.COMFY_BASE_URL?.trim() || DEFAULT_COMFY_BASE_URL).replace(
    /\/+$/,
    "",
  );

  return { comfyApiKey: comfyApiKey as string, comfyBaseUrl };
}
