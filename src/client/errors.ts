/**
 * Custom error classes for Moodle API interactions
 */

export class MoodleError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly debugInfo?: string
  ) {
    super(message);
    this.name = "MoodleError";
  }
}

export class MoodleAuthError extends MoodleError {
  constructor(message: string = "Authentication failed") {
    super(message, "auth_failed");
    this.name = "MoodleAuthError";
  }
}

export class MoodleApiError extends MoodleError {
  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly exception?: string,
    debugInfo?: string
  ) {
    super(message, errorCode, debugInfo);
    this.name = "MoodleApiError";
  }
}

export class MoodleNetworkError extends MoodleError {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message, "network_error");
    this.name = "MoodleNetworkError";
  }
}

export class MoodleValidationError extends MoodleError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message, "validation_error");
    this.name = "MoodleValidationError";
  }
}

/**
 * Response structure when Moodle returns an error
 */
export interface MoodleErrorResponse {
  exception?: string;
  errorcode?: string;
  message: string;
  debuginfo?: string;
}

/**
 * Type guard to check if a response is an error response
 */
export function isMoodleErrorResponse(
  response: unknown
): response is MoodleErrorResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    "message" in response &&
    ("exception" in response || "errorcode" in response)
  );
}
