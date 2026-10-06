import { daysBetween } from "../lib/dates.js";

export function computeLoanPosition({ installments, asOfDate }) {
  const sorted = [...installments].sort(
    (a, b) => a.installmentNumber - b.installmentNumber
  );

  const enrichedInstallments = sorted.map((inst) => {
    const paidPaise = inst.principalPaidPaise + inst.interestPaidPaise;
    const outstandingPaise = inst.totalDuePaise - paidPaise;

    let status;
    if (outstandingPaise === 0) {
      status = "PAID";
    } else if (inst.dueDate < asOfDate) {
      status = "OVERDUE";
    } else if (paidPaise > 0) {
      status = "PARTIALLY_PAID";
    } else {
      status = "PENDING";
    }

    const daysPastDue =
      status === "OVERDUE" ? daysBetween(inst.dueDate, asOfDate) : 0;
    const paidLate = Boolean(
      status === "PAID" &&
        inst.lastPaymentDate &&
        inst.lastPaymentDate > inst.dueDate
    );

    return {
      ...inst,
      paidPaise,
      outstandingPaise,
      status,
      daysPastDue,
      paidLate,
    };
  });

  const outstandingPrincipalPaise = enrichedInstallments.reduce(
    (sum, inst) => sum + (inst.principalDuePaise - inst.principalPaidPaise),
    0
  );

  const totalPaidPaise = enrichedInstallments.reduce(
    (sum, inst) => sum + inst.paidPaise,
    0
  );

  const totalOutstandingPaise = enrichedInstallments.reduce(
    (sum, inst) => sum + inst.outstandingPaise,
    0
  );

  const overdueInstallments = enrichedInstallments.filter(
    (inst) => inst.status === "OVERDUE"
  );

  const overdueAmountPaise = overdueInstallments.reduce(
    (sum, inst) => sum + inst.outstandingPaise,
    0
  );

  const overdueInstallmentCount = overdueInstallments.length;

  const oldestOverdueDays =
    overdueInstallments.length > 0 ? overdueInstallments[0].daysPastDue : 0;

  const nextDueInstallment = enrichedInstallments.find(
    (inst) => inst.outstandingPaise > 0 && inst.dueDate >= asOfDate
  );

  const nextDueDate = nextDueInstallment ? nextDueInstallment.dueDate : null;
  const nextDueAmountPaise = nextDueInstallment
    ? nextDueInstallment.outstandingPaise
    : null;

  const isClosed = totalOutstandingPaise === 0;

  return {
    installments: enrichedInstallments,
    position: {
      outstandingPrincipalPaise,
      totalPaidPaise,
      totalOutstandingPaise,
      overdueAmountPaise,
      overdueInstallmentCount,
      oldestOverdueDays,
      nextDueDate,
      nextDueAmountPaise,
      isClosed,
      asOfDate,
    },
  };
}
