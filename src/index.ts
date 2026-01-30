/**
 * moodle-ts - Type-safe TypeScript SDK for Moodle Web Services API
 *
 * @example
 * ```typescript
 * import { MoodleClient } from "moodle-ts";
 *
 * const client = new MoodleClient({
 *   baseUrl: "https://moodle.example.com",
 *   token: "your-webservice-token"
 * });
 *
 * // Get site info
 * const { data: siteInfo } = await client.getSiteInfo();
 * console.log(`Connected to ${siteInfo.sitename}`);
 * ```
 *
 * For typed API functions, import from the versioned subpath:
 * ```typescript
 * import { core_course_get_courses } from "moodle-ts/moodle/MOODLE_500_STABLE";
 * ```
 */

export {
  MoodleClient,
  type MoodleClientConfig,
  type CallOptions,
  type CallResult,
  type MoodleWarning,
  call,
  serializeParams,
  mergeParams,
  type SerializableValue,
  type SerializableParams,
  MoodleError,
  MoodleApiError,
  MoodleAuthError,
  MoodleNetworkError,
  MoodleValidationError,
  isMoodleErrorResponse,
  type MoodleErrorResponse,
} from "./client/index.js";
