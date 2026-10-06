"use client";

import { formatINR, formatDate } from "@/lib/format";

export default function LoanSummary({ loan, position }) {
  if (!loan || !position) return null;

  const isOverdue = parseFloat(position.overdueAmount) > 0;

  return (
    <div className="summary-grid">
      <div className="summary-card">
        <div className="summary-label">Principal Amount</div>
        <div className="summary-value">{formatINR(loan.principal)}</div>
        <div className="summary-subtext">
          {loan.annualInterestRate}% p.a. · {loan.tenureMonths} months
        </div>
      </div>

      <div className="summary-card">
        <div className="summary-label">Monthly EMI</div>
        <div className="summary-value">{formatINR(loan.emi)}</div>
        <div className="summary-subtext">Disbursed {formatDate(loan.disbursementDate)}</div>
      </div>

      <div className="summary-card">
        <div className="summary-label">Outstanding Principal</div>
        <div className="summary-value">{formatINR(position.outstandingPrincipal)}</div>
        <div className="summary-subtext">
          Total balance: {formatINR(position.totalOutstanding)}
        </div>
      </div>

      <div className="summary-card">
        <div className="summary-label">Total Amount Paid</div>
        <div className="summary-value text-success">{formatINR(position.totalPaid)}</div>
        <div className="summary-subtext">
          {position.isClosed ? "Fully settled" : "Principal & Interest"}
        </div>
      </div>

      <div className={`summary-card ${isOverdue ? "card-overdue" : ""}`}>
        <div className="summary-label">Overdue Amount</div>
        <div className={`summary-value ${isOverdue ? "text-danger" : ""}`}>
          {formatINR(position.overdueAmount)}
        </div>
        <div className="summary-subtext">
          {isOverdue
            ? `${position.overdueInstallmentCount} instalments, oldest ${position.oldestOverdueDays} days past due`
            : "Nothing overdue"}
        </div>
      </div>

      <div className="summary-card">
        <div className="summary-label">Next Due</div>
        {position.isClosed ? (
          <>
            <div className="summary-value text-success">Loan closed</div>
            <div className="summary-subtext">All instalments settled</div>
          </>
        ) : position.nextDueDate ? (
          <>
            <div className="summary-value">{formatINR(position.nextDueAmount)}</div>
            <div className="summary-subtext">Due {formatDate(position.nextDueDate)}</div>
          </>
        ) : (
          <>
            <div className="summary-value">None pending</div>
            <div className="summary-subtext">No upcoming dues</div>
          </>
        )}
      </div>
    </div>
  );
}
