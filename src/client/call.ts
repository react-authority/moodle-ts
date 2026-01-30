import { serializeParams, SerializableParams } from "./serialize.js";
import {
  MoodleApiError,
  MoodleNetworkError,
  isMoodleErrorResponse,
} from "./errors.js";

export interface CallOptions {
  /**
   * Moodle site base URL
   */
  baseUrl: string;

  /**
   * Web service token
   */
  token: string;

  /**
   * Request timeout in milliseconds (default: 30000)
   */
  timeout?: number;

  /**
   * Custom fetch implementation (useful for testing)
   */
  fetch?: typeof globalThis.fetch;
}

export interface CallResult<T> {
  data: T;
  warnings?: MoodleWarning[];
}

export interface MoodleWarning {
  item?: string;
  itemid?: number;
  warningcode: string;
  message: string;
}

/**
 * Make a call to the Moodle Web Services API
 */
export async function call<TParams extends SerializableParams, TResult>(
  wsfunction: string,
  params: TParams,
  options: CallOptions
): Promise<CallResult<TResult>> {
  const { baseUrl, token, timeout = 30000, fetch: customFetch } = options;
  const fetchFn = customFetch ?? globalThis.fetch;

  // Build the request URL
  const url = new URL("/webservice/rest/server.php", baseUrl);

  // Build request body
  const body = serializeParams({
    wstoken: token,
    wsfunction,
    moodlewsrestformat: "json",
    ...params,
  } as SerializableParams);

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetchFn(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new MoodleNetworkError(
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();

    // Check for Moodle error response
    if (isMoodleErrorResponse(data)) {
      throw new MoodleApiError(
        data.message,
        data.errorcode ?? "unknown",
        data.exception,
        data.debuginfo
      );
    }

    // Extract warnings if present
    let warnings: MoodleWarning[] | undefined;
    let result = data;

    if (
      typeof data === "object" &&
      data !== null &&
      "warnings" in data &&
      Array.isArray(data.warnings)
    ) {
      warnings = data.warnings;
      // Some endpoints wrap the result, others don't
      // This is a common pattern in Moodle's API
    }

    return {
      data: result as TResult,
      warnings,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof MoodleApiError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new MoodleNetworkError(`Request timeout after ${timeout}ms`);
      }
      throw new MoodleNetworkError(error.message, error);
    }

    throw new MoodleNetworkError("Unknown error occurred");
  }
}
