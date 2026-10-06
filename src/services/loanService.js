import { pool, withTransaction } from "../lib/db.js";
import { generateSchedule } from "./scheduleService.js";
import { computeLoanPosition } from "./positionService.js";
import { toLoanSummary, toLoanDetail } from "./loanPresenter.js";
import { todayIST } from "../lib/dates.js";
import { ApiError } from "../lib/api.js";

export function mapInstallmentRow(row) {
  return {
    id: row.id,
    installmentNumber: row.installment_number,
    dueDate: row.due_date,
    principalDuePaise: row.principal_due_paise,
    interestDuePaise: row.interest_due_paise,
    totalDuePaise: row.total_due_paise,
    principalPaidPaise: row.principal_paid_paise,
    interestPaidPaise: row.interest_paid_paise,
    lastPaymentDate: row.last_payment_date,
  };
}

export async function createLoan({
  principalPaise,
  annualRateBps,
  tenureMonths,
  disbursementDate,
}) {
  const { emiPaise, installments } = generateSchedule({
    principalPaise,
    annualRateBps,
    tenureMonths,
    disbursementDate,
  });

  const loanId = await withTransaction(async (client) => {
    const loanRes = await client.query(
      `INSERT INTO loans (
        principal_paise,
        annual_rate_bps,
        tenure_months,
        disbursement_date,
        emi_paise
      ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        principalPaise,
        annualRateBps,
        tenureMonths,
        disbursementDate,
        emiPaise,
      ]
    );

    const loanRow = loanRes.rows[0];

    const valuePlaceholders = [];
    const params = [];

    installments.forEach((inst, index) => {
      const offset = index * 6;
      valuePlaceholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`
      );
      params.push(
        loanRow.id,
        inst.installmentNumber,
        inst.dueDate,
        inst.principalDuePaise,
        inst.interestDuePaise,
        inst.totalDuePaise
      );
    });

    await client.query(
      `INSERT INTO installments (
        loan_id,
        installment_number,
        due_date,
        principal_due_paise,
        interest_due_paise,
        total_due_paise
      ) VALUES ${valuePlaceholders.join(", ")}`,
      params
    );

    return loanRow.id;
  });

  console.log(
    JSON.stringify({
      event: "loan.created",
      loanId,
    })
  );

  return loanId;
}

export async function getLoanDetail(
  loanId,
  executor = pool,
  asOfDate = todayIST()
) {
  const loanRes = await executor.query(
    "SELECT * FROM loans WHERE id = $1",
    [loanId]
  );

  if (loanRes.rows.length === 0) {
    throw new ApiError(404, "LOAN_NOT_FOUND", "Loan not found");
  }

  const loanRow = loanRes.rows[0];

  const installmentsRes = await executor.query(
    "SELECT * FROM installments WHERE loan_id = $1 ORDER BY installment_number ASC",
    [loanId]
  );

  const paymentsRes = await executor.query(
    "SELECT * FROM payments WHERE loan_id = $1 ORDER BY created_at ASC",
    [loanId]
  );

  const mappedInstallments = installmentsRes.rows.map(mapInstallmentRow);
  const positionResult = computeLoanPosition({
    installments: mappedInstallments,
    asOfDate,
  });

  return toLoanDetail({
    loanRow,
    positionResult,
    paymentRows: paymentsRes.rows,
  });
}

export async function listLoans() {
  const res = await pool.query(
    "SELECT * FROM loans ORDER BY created_at DESC LIMIT 50"
  );
  return res.rows.map(toLoanSummary);
}
