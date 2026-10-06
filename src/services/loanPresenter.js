import { paiseToRupees, bpsToPercent } from "../lib/money.js";

export function toLoanSummary(loanRow) {
  return {
    id: loanRow.id,
    principal: paiseToRupees(loanRow.principal_paise),
    annualInterestRate: bpsToPercent(loanRow.annual_rate_bps),
    tenureMonths: loanRow.tenure_months,
    disbursementDate: loanRow.disbursement_date,
    emi: paiseToRupees(loanRow.emi_paise),
    createdAt:
      loanRow.created_at instanceof Date
        ? loanRow.created_at.toISOString()
        : loanRow.created_at,
  };
}

export function toLoanDetail({ loanRow, positionResult, paymentRows = [] }) {
  const nextDueDate = positionResult.position.nextDueDate;
  const nextDueAmount =
    nextDueDate !== null
      ? paiseToRupees(positionResult.position.nextDueAmountPaise)
      : null;

  return {
    loan: toLoanSummary(loanRow),
    position: {
      outstandingPrincipal: paiseToRupees(
        positionResult.position.outstandingPrincipalPaise
      ),
      totalPaid: paiseToRupees(positionResult.position.totalPaidPaise),
      totalOutstanding: paiseToRupees(
        positionResult.position.totalOutstandingPaise
      ),
      overdueAmount: paiseToRupees(
        positionResult.position.overdueAmountPaise
      ),
      overdueInstallmentCount: positionResult.position.overdueInstallmentCount,
      oldestOverdueDays: positionResult.position.oldestOverdueDays,
      nextDueDate,
      nextDueAmount,
      isClosed: positionResult.position.isClosed,
      asOfDate: positionResult.position.asOfDate,
    },
    schedule: positionResult.installments.map((inst) => ({
      installmentNumber: inst.installmentNumber,
      dueDate: inst.dueDate,
      principalDue: paiseToRupees(inst.principalDuePaise),
      interestDue: paiseToRupees(inst.interestDuePaise),
      totalDue: paiseToRupees(inst.totalDuePaise),
      principalPaid: paiseToRupees(inst.principalPaidPaise),
      interestPaid: paiseToRupees(inst.interestPaidPaise),
      amountPaid: paiseToRupees(inst.paidPaise),
      outstanding: paiseToRupees(inst.outstandingPaise),
      status: inst.status,
      daysPastDue: inst.daysPastDue,
      paidLate: inst.paidLate,
      lastPaymentDate: inst.lastPaymentDate,
    })),
    payments: paymentRows.map((p) => ({
      id: p.id,
      amount: paiseToRupees(p.amount_paise),
      paymentDate: p.payment_date,
      idempotencyKey: p.idempotency_key,
      createdAt:
        p.created_at instanceof Date ? p.created_at.toISOString() : p.created_at,
    })),
  };
}
