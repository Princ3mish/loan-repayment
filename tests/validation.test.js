import { describe, it, expect } from "vitest";
import {
  validateCreateLoan,
  validatePayment,
  validateLoanId,
} from "@/lib/validation.js";
import { ApiError } from "@/lib/api.js";

describe("Validation Utilities", () => {
  it("validates create loan payload and returns all field errors", () => {
    try {
      validateCreateLoan({
        principal: -5,
        annualInterestRate: "abc",
        tenureMonths: 0,
        disbursementDate: "2026-02-30",
      });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(400);
      expect(err.code).toBe("VALIDATION_ERROR");
      expect(err.details).toHaveLength(4);
      const fields = err.details.map((d) => d.field);
      expect(fields).toContain("principal");
      expect(fields).toContain("annualInterestRate");
      expect(fields).toContain("tenureMonths");
      expect(fields).toContain("disbursementDate");
    }
  });

  it("validates payment payload amounts", () => {
    const invalidAmounts = ["ten", -100];
    for (const amt of invalidAmounts) {
      expect(() =>
        validatePayment({
          amount: amt,
          paymentDate: "2026-02-01",
          idempotencyKey: "test-key-1",
        })
      ).toThrowError(
        expect.objectContaining({
          status: 400,
          code: "VALIDATION_ERROR",
        })
      );
    }
  });

  it("validates loan ID UUID format and throws 404 on invalid ID", () => {
    try {
      validateLoanId("abc");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(404);
      expect(err.code).toBe("LOAN_NOT_FOUND");
    }
  });
});
