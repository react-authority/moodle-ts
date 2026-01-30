import { call, CallResult, MoodleWarning } from "./call.js";
import type { SerializableParams } from "./serialize.js";

export interface MoodleClientConfig {
  /**
   * The base URL of your Moodle instance (e.g., "https://moodle.example.com")
   */
  baseUrl: string;

  /**
   * Web service token for authentication
   * Generate this in Moodle: Site administration > Plugins > Web services > Manage tokens
   */
  token: string;

  /**
   * Request timeout in milliseconds (default: 30000)
   */
  timeout?: number;

  /**
   * Custom fetch implementation (useful for testing or custom HTTP handling)
   */
  fetch?: typeof globalThis.fetch;
}

export type { CallResult, MoodleWarning };

/**
 * Type-safe Moodle Web Services client
 *
 * @example
 * ```typescript
 * const client = new MoodleClient({
 *   baseUrl: "https://moodle.example.com",
 *   token: "your-webservice-token"
 * });
 *
 * // Use with generated typed functions
 * const result = await client.call("core_course_get_courses", { ids: [1, 2, 3] });
 * ```
 */
export class MoodleClient {
  private readonly config: Required<
    Pick<MoodleClientConfig, "baseUrl" | "token" | "timeout">
  > &
    Pick<MoodleClientConfig, "fetch">;

  constructor(config: MoodleClientConfig) {
    if (!config.baseUrl) {
      throw new Error("baseUrl is required");
    }
    if (!config.token) {
      throw new Error("token is required");
    }

    // Normalize base URL (remove trailing slash)
    const baseUrl = config.baseUrl.replace(/\/+$/, "");

    this.config = {
      baseUrl,
      token: config.token,
      timeout: config.timeout ?? 30000,
      fetch: config.fetch,
    };
  }

  /**
   * Get the configured base URL
   */
  get baseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * Make a typed call to a Moodle Web Service function
   *
   * @param wsfunction - The name of the web service function to call
   * @param params - The parameters to pass to the function
   * @returns The typed response from Moodle
   */
  async call<TParams extends Record<string, unknown>, TResult>(
    wsfunction: string,
    params: TParams = {} as TParams
  ): Promise<CallResult<TResult>> {
    return call<SerializableParams, TResult>(wsfunction, params as SerializableParams, {
      baseUrl: this.config.baseUrl,
      token: this.config.token,
      timeout: this.config.timeout,
      fetch: this.config.fetch,
    });
  }

  /**
   * Get site info for the authenticated user
   * This is useful to verify the connection and get basic site information
   */
  async getSiteInfo(): Promise<
    CallResult<{
      sitename: string;
      username: string;
      firstname: string;
      lastname: string;
      fullname: string;
      lang: string;
      userid: number;
      siteurl: string;
      userpictureurl: string;
      functions: Array<{ name: string; version: string }>;
      release: string;
      version: string;
    }>
  > {
    return this.call("core_webservice_get_site_info", {});
  }
}
