import type { ApiError, ApiErrorCode } from "@pennywise/contracts";
import type { ZodError } from "zod";

export class ApiHttpError extends Error {
  readonly statusCode: number;
  readonly responseBody: ApiError;

  constructor(
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    details?: ApiError["details"],
  ) {
    super(message);
    this.name = "ApiHttpError";
    this.statusCode = statusCode;
    this.responseBody = {
      code,
      message,
      ...(details ? { details } : {}),
    };
  }
}

export function createValidationError(error: ZodError): ApiHttpError {
  return new ApiHttpError(400, "VALIDATION_ERROR", "Request body failed validation", {
    fieldErrors: error.flatten().fieldErrors,
  });
}

export function createUnauthorizedError(message = "Authentication required"): ApiHttpError {
  return new ApiHttpError(401, "UNAUTHORIZED", message);
}

export function createNotFoundError(message = "Resource not found"): ApiHttpError {
  return new ApiHttpError(404, "NOT_FOUND", message);
}

export function createConflictError(
  message = "Request conflicts with existing rules",
): ApiHttpError {
  return new ApiHttpError(409, "CONFLICT", message);
}

export function createInternalError(): ApiHttpError {
  return new ApiHttpError(500, "INTERNAL_ERROR", "Internal server error");
}
