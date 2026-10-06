"use client";

import { formatDate } from "@/lib/format";

export default function LoanPicker({ loans = [], selectedId, onSelect, loading }) {
  if (loans.length === 0 && !loading) {
    return (
      <div className="loan-picker empty">
        <p>No active loans found.</p>
      </div>
    );
  }

  return (
    <div className="loan-picker">
      <label htmlFor="loan-select" className="loan-picker-label">
        Active Loan
      </label>
      <div className="select-wrapper">
        <select
          id="loan-select"
          className="form-select"
          value={selectedId || ""}
          onChange={(e) => onSelect(e.target.value)}
          disabled={loading || loans.length === 0}
        >
          {loans.map((loan) => (
            <option key={loan.id} value={loan.id}>
              ₹{loan.principal} · {loan.annualInterestRate}% · {loan.tenureMonths} mo · {formatDate(loan.disbursementDate)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
