import { describe, it, expect } from "vitest";
import {
  calculateEmiPaise,
  generateSchedule,
} from "@/services/scheduleService.js";
import { rupeesToPaise, percentToBps } from "@/lib/money.js";

describe("Schedule Service", () => {
  it("calculates EMI and schedule correctly for 200000, 18%, 24 months", () => {
    const principalPaise = rupeesToPaise(200000);
    const annualRateBps = percentToBps(18);
    const tenureMonths = 24;
    const disbursementDate = "2026-01-01";

    const emiPaise = calculateEmiPaise(
      principalPaise,
      annualRateBps,
      tenureMonths
    );
    expect(emiPaise).toBe(998500);
    expect(Math.abs(emiPaise - 998600)).toBeLessThanOrEqual(200);

    const { installments } = generateSchedule({
      principalPaise,
      annualRateBps,
      tenureMonths,
      disbursementDate,
    });

    expect(installments).toHaveLength(24);

    const totalPrincipal = installments.reduce(
      (sum, inst) => sum + inst.principalDuePaise,
      0
    );
    expect(totalPrincipal).toBe(20000000);

    const lastInst = installments[installments.length - 1];
    expect(lastInst.closingBalancePaise).toBe(0);
  });

  it("ensures final instalment absorbs remainder and dates handle end-of-month", () => {
    const testCases = [
      { principal: 50000, rate: 12, tenure: 3 },
      { principal: 1000000, rate: 10.5, tenure: 12 },
      { principal: 60000, rate: 0, tenure: 3 },
    ];

    for (const tc of testCases) {
      const principalPaise = rupeesToPaise(tc.principal);
      const annualRateBps = percentToBps(tc.rate);
      const tenureMonths = tc.tenure;

      const { emiPaise, installments } = generateSchedule({
        principalPaise,
        annualRateBps,
        tenureMonths,
        disbursementDate: "2026-01-01",
      });

      const totalPrincipal = installments.reduce(
        (sum, inst) => sum + inst.principalDuePaise,
        0
      );
      expect(totalPrincipal).toBe(principalPaise);

      const nonFinalInstalments = installments.slice(0, -1);
      for (const inst of nonFinalInstalments) {
        expect(inst.totalDuePaise).toBe(emiPaise);
      }
    }

    const { installments: eomInsts } = generateSchedule({
      principalPaise: rupeesToPaise(50000),
      annualRateBps: percentToBps(12),
      tenureMonths: 3,
      disbursementDate: "2026-01-31",
    });

    expect(eomInsts[0].dueDate).toBe("2026-02-28");
    expect(eomInsts[1].dueDate).toBe("2026-03-31");
  });
});
