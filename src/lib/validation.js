import { ApiError } from "./api.js";
import { rupeesToPaise, percentToBps } from "./money.js";
import { isValidDateString, todayIST } from "./dates.js";

function isNumericInput(val) {
  if (typeof val === "boolean" || val === null || val === undefined) {
    return false;
  }
  if (typeof val === "object" || Array.isArray(val)) {
    return false;
  }
  if (typeof val === "number") {
    return Number.isFinite(val);
  }
  if (typeof val === "string") {
    const s = val.trim();
    if (s.length === 0) {
      return false;
    }
    return /^-?\d+(\.\d+)?$/.test(s);
  }
  return false;
}

export function validateCreateLoan(body) {
  const errors = [];
  let principalPaise;
  let annualRateBps;
  let tenureMonths;

  if (!isNumericInput(body?.principal)) {
    errors.push({
      field: "principal",
      message:
        "Principal must be between 50,000 and 1,000,000 rupees with at most 2 decimals",
    });
  } else {
    try {
      principalPaise = rupeesToPaise(body.principal);
      if (principalPaise < 5000000 || principalPaise > 100000000) {
        errors.push({
          field: "principal",
          message:
            "Principal must be between 50,000 and 1,000,000 rupees with at most 2 decimals",
        });
      }
    } catch {
      errors.push({
        field: "principal",
        message:
          "Principal must be between 50,000 and 1,000,000 rupees with at most 2 decimals",
      });
    }
  }

  if (!isNumericInput(body?.annualInterestRate)) {
    errors.push({
      field: "annualInterestRate",
      message:
        "Annual interest rate must be between 0 and 100 percent with at most 2 decimals",
    });
  } else {
    try {
      annualRateBps = percentToBps(body.annualInterestRate);
      if (annualRateBps < 0 || annualRateBps > 10000) {
        errors.push({
          field: "annualInterestRate",
          message:
            "Annual interest rate must be between 0 and 100 percent with at most 2 decimals",
        });
      }
    } catch {
      errors.push({
        field: "annualInterestRate",
        message:
          "Annual interest rate must be between 0 and 100 percent with at most 2 decimals",
      });
    }
  }

  if (!isNumericInput(body?.tenureMonths)) {
    errors.push({
      field: "tenureMonths",
      message: "Tenure must be an integer between 3 and 36 months",
    });
  } else {
    const tm =
      typeof body?.tenureMonths === "string"
        ? Number(body.tenureMonths.trim())
        : body?.tenureMonths;
    if (!Number.isInteger(tm) || tm < 3 || tm > 36) {
      errors.push({
        field: "tenureMonths",
        message: "Tenure must be an integer between 3 and 36 months",
      });
    } else {
      tenureMonths = tm;
    }
  }

  if (!isValidDateString(body?.disbursementDate)) {
    errors.push({
      field: "disbursementDate",
      message: "Disbursement date must be a valid date in YYYY-MM-DD format",
    });
  }

  if (errors.length > 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid request", errors);
  }

  return {
    principalPaise,
    annualRateBps,
    tenureMonths,
    disbursementDate: body.disbursementDate,
  };
}

export function validatePayment(body, request) {
  const errors = [];
  let amountPaise;

  if (!isNumericInput(body?.amount)) {
    errors.push({
      field: "amount",
      message: "Amount must be greater than 0 with at most 2 decimals",
    });
  } else {
    try {
      amountPaise = rupeesToPaise(body.amount);
      if (amountPaise <= 0) {
        errors.push({
          field: "amount",
          message: "Amount must be greater than 0 with at most 2 decimals",
        });
      }
    } catch {
      errors.push({
        field: "amount",
        message: "Amount must be greater than 0 with at most 2 decimals",
      });
    }
  }

  if (
    !isValidDateString(body?.paymentDate) ||
    body.paymentDate > todayIST()
  ) {
    errors.push({
      field: "paymentDate",
      message: "Payment date must be a valid date on or before today",
    });
  }

  const headerKey =
    request?.headers?.get?.("idempotency-key") ||
    request?.headers?.get?.("Idempotency-Key");
  const rawKey = headerKey || body?.idempotencyKey;

  let idempotencyKey;
  if (
    typeof rawKey !== "string" ||
    rawKey.length < 1 ||
    rawKey.length > 100 ||
    !/^[A-Za-z0-9_.:-]+$/.test(rawKey)
  ) {
    errors.push({
      field: "idempotencyKey",
      message:
        "Idempotency key is required and must be 1-100 characters (letters, numbers, _, ., :, -)",
    });
  } else {
    idempotencyKey = rawKey;
  }

  if (errors.length > 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid request", errors);
  }

  return {
    amountPaise,
    paymentDate: body.paymentDate,
    idempotencyKey,
  };
}

export function validateLoanId(id) {
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    throw new ApiError(404, "LOAN_NOT_FOUND", "Loan not found");
  }
  return id;
}
