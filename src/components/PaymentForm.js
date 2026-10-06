"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { formatINR } from "@/lib/format";
import { todayIST } from "@/lib/dates";

export default function PaymentForm({ loanId, position, onPaid }) {
  const maxDate = todayIST();

  const overdue = parseFloat(position?.overdueAmount || 0);
  const defaultAmount =
    overdue > 0
      ? position.overdueAmount
      : position?.nextDueAmount || "";

  const [amount, setAmount] = useState(defaultAmount);
  const [prevLoanId, setPrevLoanId] = useState(loanId);
  const [paymentDate, setPaymentDate] = useState(maxDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [lastPayload, setLastPayload] = useState(null);

  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  if (prevLoanId !== loanId) {
    setPrevLoanId(loanId);
    setAmount(defaultAmount);
    setPaymentDate(maxDate);
    setError(null);
    setResult(null);
    setLastPayload(null);
    setIdempotencyKey(crypto.randomUUID());
  }

  function handleAmountChange(e) {
    setAmount(e.target.value);
    setIdempotencyKey(crypto.randomUUID());
    setError(null);
  }

  function handleDateChange(e) {
    setPaymentDate(e.target.value);
    setIdempotencyKey(crypto.randomUUID());
    setError(null);
  }

  async function executePayment(payload) {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/loans/${loanId}/payments`, {
        method: "POST",
        headers: {
          "Idempotency-Key": payload.idempotencyKey,
        },
        body: {
          amount: payload.amount,
          paymentDate: payload.paymentDate,
          idempotencyKey: payload.idempotencyKey,
        },
      });

      setResult(res.data);
      setLastPayload(payload);
      setIdempotencyKey(crypto.randomUUID());
      if (onPaid) {
        onPaid(res.data);
      }
    } catch (err) {
      setError({
        message: err.message || "Failed to record payment",
        details: err.details,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setError({ message: "Please enter a valid amount greater than zero." });
      return;
    }
    await executePayment({
      amount: parseFloat(amount),
      paymentDate,
      idempotencyKey,
    });
  }

  async function handleResend() {
    if (!lastPayload) return;
    await executePayment(lastPayload);
  }

  if (position?.isClosed) {
    return (
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title">Record Payment</h2>
        </div>
        <div className="alert alert-success">
          This loan is fully closed. No further payments are needed.
        </div>
      </div>
    );
  }

  return (
    <div className="section-card">
      <div className="section-header">
        <h2 className="section-title">Record Payment</h2>
      </div>

      {error && (
        <div className="alert alert-error">
          <div className="alert-title">{error.message}</div>
          {error.details && error.details.length > 0 && (
            <ul className="alert-list">
              {error.details.map((d, i) => (
                <li key={i}>{d.message || `${d.field}: invalid`}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {result && (
        <div className={`alert ${result.replayed ? "alert-warning" : "alert-success"}`}>
          {result.replayed ? (
            <div className="alert-title">
              Duplicate submission detected. This payment was already recorded and was not applied again.
            </div>
          ) : (
            <div>
              <div className="alert-title">
                Payment of {formatINR(result.payment.amount)} successfully recorded!
              </div>
              {result.payment.allocations && result.payment.allocations.length > 0 && (
                <div className="allocations-breakdown">
                  <div className="allocations-title">Allocation Breakdown:</div>
                  <div className="allocations-grid">
                    {result.payment.allocations.map((alloc, idx) => (
                      <div key={idx} className="alloc-item">
                        <span className="alloc-inst">Instalment #{alloc.installmentNumber}</span>
                        <span>Interest: {formatINR(alloc.interest)}</span>
                        <span>Principal: {formatINR(alloc.principal)}</span>
                        {alloc.isLate && <span className="badge badge-overdue">Late</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="payment-form">
        <div className="form-row">
          <div className="form-group flex-1">
            <label htmlFor="payment-amount" className="form-label">
              Payment Amount (₹)
            </label>
            <input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0.01"
              className="form-input"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0.00"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group flex-1">
            <label htmlFor="payment-date" className="form-label">
              Payment Date
            </label>
            <input
              id="payment-date"
              type="date"
              className="form-input"
              value={paymentDate}
              max={maxDate}
              onChange={handleDateChange}
              disabled={loading}
              required
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? "Recording..." : "Record Payment"}
          </button>

          {lastPayload && (
            <button
              type="button"
              onClick={handleResend}
              className="btn btn-secondary"
              disabled={loading}
            >
              Resend last payment (idempotency check)
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
