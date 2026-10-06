import { describe, it, expect } from "vitest";
import { allocatePayment } from "@/services/allocationService.js";
import { computeLoanPosition } from "@/services/positionService.js";
import { rupeesToPaise, percentToBps } from "@/lib/money.js";
import { buildInstallments, applyAllocations } from "./helpers.js";

describe("Payment Allocation and Loan Position", () => {
  const baseScheduleArgs = {
    principalPaise: rupeesToPaise(200000),
    annualRateBps: percentToBps(18),
    tenureMonths: 24,
    disbursementDate: "2026-01-01",
  };

  it("handles underpayment with interest priority", () => {
    const installments = buildInstallments(baseScheduleArgs);
    const amountPaise = rupeesToPaise(5000);
    const paymentDate = "2026-02-01";

    const { allocations, totalAllocatedPaise } = allocatePayment({
      installments,
      amountPaise,
      paymentDate,
    });

    expect(totalAllocatedPaise).toBe(amountPaise);
    expect(allocations).toHaveLength(1);
    expect(allocations[0].installmentNumber).toBe(1);
    expect(allocations[0].interestPaise).toBe(rupeesToPaise(3000));
    expect(allocations[0].principalPaise).toBe(rupeesToPaise(2000));

    const updatedInstallments = applyAllocations(
      installments,
      allocations,
      paymentDate
    );
    const { installments: enriched } = computeLoanPosition({
      installments: updatedInstallments,
      asOfDate: "2026-02-01",
    });

    const inst1 = enriched[0];
    expect(inst1.status).toBe("PARTIALLY_PAID");
    expect(inst1.outstandingPaise).toBe(498500);
  });

  it("handles overpayment across multiple instalments", () => {
    const installments = buildInstallments(baseScheduleArgs);
    const emiPaise = installments[0].totalDuePaise;
    const amountPaise = emiPaise * 2;
    const paymentDate = "2026-02-01";

    const { allocations, totalAllocatedPaise } = allocatePayment({
      installments,
      amountPaise,
      paymentDate,
    });

    expect(totalAllocatedPaise).toBe(amountPaise);
    expect(allocations).toHaveLength(2);

    const updatedInstallments = applyAllocations(
      installments,
      allocations,
      paymentDate
    );
    const { installments: enriched } = computeLoanPosition({
      installments: updatedInstallments,
      asOfDate: "2026-02-01",
    });

    expect(enriched[0].status).toBe("PAID");
    expect(enriched[1].status).toBe("PAID");
    expect(enriched[2].status).toBe("PENDING");
    expect(enriched[2].principalPaidPaise).toBe(0);
    expect(enriched[2].interestPaidPaise).toBe(0);
  });

  it("handles late payments, overdue tracking and pending status", () => {
    const installments = buildInstallments(baseScheduleArgs);

    const { installments: enrichedPending } = computeLoanPosition({
      installments,
      asOfDate: "2026-02-01",
    });
    expect(enrichedPending[0].status).toBe("PENDING");

    const { installments: enrichedOverdue } = computeLoanPosition({
      installments,
      asOfDate: "2026-03-12",
    });

    expect(enrichedOverdue[0].status).toBe("OVERDUE");
    expect(enrichedOverdue[0].daysPastDue).toBe(39);
    expect(enrichedOverdue[1].status).toBe("OVERDUE");
    expect(enrichedOverdue[1].daysPastDue).toBe(11);

    const emiPaise = installments[0].totalDuePaise;
    const paymentDate = "2026-03-12";
    const { allocations } = allocatePayment({
      installments,
      amountPaise: emiPaise,
      paymentDate,
    });

    expect(allocations[0].isLate).toBe(true);

    const updated = applyAllocations(installments, allocations, paymentDate);
    const { installments: enrichedAfterPayment } = computeLoanPosition({
      installments: updated,
      asOfDate: "2026-03-12",
    });

    expect(enrichedAfterPayment[0].status).toBe("PAID");
    expect(enrichedAfterPayment[0].paidLate).toBe(true);
  });

  it("rejects invalid amounts, excessive payments, and payments on closed loans", () => {
    const installments = buildInstallments(baseScheduleArgs);
    const totalOutstanding = installments.reduce(
      (sum, i) => sum + i.totalDuePaise,
      0
    );

    expect(() =>
      allocatePayment({
        installments,
        amountPaise: 0,
        paymentDate: "2026-02-01",
      })
    ).toThrow("INVALID_AMOUNT");

    expect(() =>
      allocatePayment({
        installments,
        amountPaise: totalOutstanding + 100,
        paymentDate: "2026-02-01",
      })
    ).toThrow("PAYMENT_EXCEEDS_OUTSTANDING");

    const fullyPaidInstallments = installments.map((i) => ({
      ...i,
      principalPaidPaise: i.principalDuePaise,
      interestPaidPaise: i.interestDuePaise,
      lastPaymentDate: "2026-02-01",
    }));

    expect(() =>
      allocatePayment({
        installments: fullyPaidInstallments,
        amountPaise: 1000,
        paymentDate: "2026-02-01",
      })
    ).toThrow("LOAN_ALREADY_CLOSED");
  });
});
