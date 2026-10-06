"use client";

import { formatINR, formatDate } from "@/lib/format";

export default function LoanSchedule({ schedule = [], nextDueDate }) {
  if (!schedule || schedule.length === 0) return null;

  return (
    <div className="section-card">
      <div className="section-header">
        <h2 className="section-title">Repayment Schedule</h2>
        <span className="section-badge">{schedule.length} Instalments</span>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Due Date</th>
              <th>Principal</th>
              <th>Interest</th>
              <th>Total Due</th>
              <th>Paid</th>
              <th>Outstanding</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((inst) => {
              const isNextDue = nextDueDate && inst.dueDate === nextDueDate && inst.status !== "PAID";

              return (
                <tr
                  key={inst.installmentNumber}
                  className={`${isNextDue ? "row-highlight" : ""} ${inst.status === "OVERDUE" ? "row-overdue" : ""}`}
                >
                  <td className="font-mono">{inst.installmentNumber}</td>
                  <td>{formatDate(inst.dueDate)}</td>
                  <td>{formatINR(inst.principalDue)}</td>
                  <td>{formatINR(inst.interestDue)}</td>
                  <td className="font-semibold">{formatINR(inst.totalDue)}</td>
                  <td className="text-success">{formatINR(inst.amountPaid)}</td>
                  <td className={parseFloat(inst.outstanding) > 0 ? "font-semibold" : ""}>
                    {formatINR(inst.outstanding)}
                  </td>
                  <td>
                    <div className="status-cell">
                      {inst.status === "PAID" && (
                        <span className="badge badge-paid">PAID</span>
                      )}
                      {inst.status === "PARTIALLY_PAID" && (
                        <span className="badge badge-partial">PARTIALLY PAID</span>
                      )}
                      {inst.status === "OVERDUE" && (
                        <span className="badge badge-overdue">
                          OVERDUE ({inst.daysPastDue}d late)
                        </span>
                      )}
                      {inst.status === "PENDING" && (
                        <span className="badge badge-pending">PENDING</span>
                      )}
                      {inst.paidLate && (
                        <span className="badge badge-late-tag">paid late</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
