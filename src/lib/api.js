import { NextResponse } from "next/server.js";
import { checkRateLimit } from "./rateLimit.js";
import { requireAuth } from "./auth.js";

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function ok(data, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(status, code, message, details, headers) {
  const errorObj = { code, message };
  if (details !== undefined) {
    errorObj.details = details;
  }
  const init = { status };
  if (headers) {
    init.headers = headers;
  }
  return NextResponse.json({ success: false, error: errorObj }, init);
}

export async function readJson(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(
      400,
      "INVALID_JSON",
      "Request body must be a JSON object"
    );
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError(
      400,
      "INVALID_JSON",
      "Request body must be a JSON object"
    );
  }
  return body;
}

const DOMAIN_ERRORS = {
  INVALID_AMOUNT: {
    status: 400,
    code: "INVALID_AMOUNT",
    message: "Invalid amount provided",
  },
  INVALID_RATE: {
    status: 400,
    code: "INVALID_RATE",
    message: "Invalid interest rate provided",
  },
  PAYMENT_EXCEEDS_OUTSTANDING: {
    status: 422,
    code: "PAYMENT_EXCEEDS_OUTSTANDING",
    message: "Payment amount exceeds remaining outstanding balance",
  },
  LOAN_ALREADY_CLOSED: {
    status: 422,
    code: "LOAN_ALREADY_CLOSED",
    message: "Loan is already fully repaid",
  },
};

export function withApi(handler, options = {}) {
  const { rateLimitBucket } = options;

  return async function routeHandler(request, context) {
    try {
      if (rateLimitBucket) {
        const { allowed, retryAfterSeconds } = checkRateLimit(
          request,
          rateLimitBucket
        );
        if (!allowed) {
          return fail(
            429,
            "RATE_LIMITED",
            "Rate limit exceeded",
            undefined,
            { "Retry-After": String(retryAfterSeconds) }
          );
        }
      }

      const user = await requireAuth(request);
      return await handler(request, context, user);
    } catch (err) {
      if (err instanceof ApiError) {
        return fail(err.status, err.code, err.message, err.details);
      }

      if (err && DOMAIN_ERRORS[err.message]) {
        const mapped = DOMAIN_ERRORS[err.message];
        return fail(mapped.status, mapped.code, mapped.message);
      }

      const path = request?.nextUrl?.pathname || request?.url || "unknown";
      console.error(
        JSON.stringify({
          event: "request.failed",
          path,
          message: err?.message,
        })
      );

      return fail(500, "INTERNAL_ERROR", "Unexpected server error");
    }
  };
}
