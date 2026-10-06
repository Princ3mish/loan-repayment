import { describe, it, expect } from "vitest";
import { rupeesToPaise, paiseToRupees } from "@/lib/money.js";

describe("Money Utilities", () => {
  it("converts rupees to paise accurately", () => {
    expect(rupeesToPaise("9985.07")).toBe(998507);
    expect(rupeesToPaise(0.1)).toBe(10);
  });

  it("converts paise to rupees with exact two-decimal format", () => {
    expect(paiseToRupees(998507)).toBe("9985.07");
    expect(paiseToRupees(5)).toBe("0.05");
  });

  it("throws INVALID_AMOUNT on invalid inputs", () => {
    const invalidInputs = ["-5", "abc", "1.234", "", null];
    for (const input of invalidInputs) {
      expect(() => rupeesToPaise(input)).toThrow("INVALID_AMOUNT");
    }
  });
});
