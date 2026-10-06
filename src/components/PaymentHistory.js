"use client";

import { formatINR, formatDate } from "@/lib/format";

export default function PaymentHistory({ payments = [] }) {
  if (!payments || payments.length === 0) {
    return (
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title">Payment History</h2>
        </div>
        <p className="text-muted">No payments recorded yet for this loan.</p>
      </div>
    );
  }

  return (
    <div className="section-card">
      <div className="section-header">
        <h2 className="section-title">Payment History</h2>
        <span className="section-badge">{payments.length} Payments</span>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Idempotency Key</th>
              <th>Recorded At</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td>{formatDate(p.paymentDate)}</td>
                <td className="font-semibold text-success">{formatINR(p.amount)}</td>
                <td className="font-mono text-muted text-sm" title={p.idempotencyKey}>
                  {p.idempotencyKey.length > 16
                    ? `${p.idempotencyKey.slice(0, 16)}...`
                    : p.idempotencyKey}
                </td>
                <td className="text-muted text-sm">
                  {p.createdAt ? new Date(p.createdAt).toLocaleString("en-IN") : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
