import { withTransaction } from "../lib/db.js";
import { paiseToRupees } from "../lib/money.js";
import { ApiError } from "../lib/api.js";
import { allocatePayment } from "./allocationService.js";
import { getLoanDetail, mapInstallmentRow } from "./loanService.js";

export async function recordPayment({
  loanId,
  amountPaise,
  paymentDate,
  idempotencyKey,
}) {
  try {
    return await withTransaction(async (client) => {
      const loanRes = await client.query(
        "SELECT * FROM loans WHERE id = $1 FOR UPDATE",
        [loanId]
      );

      if (loanRes.rows.length === 0) {
        throw new ApiError(404, "LOAN_NOT_FOUND", "Loan not found");
      }

      const loanRow = loanRes.rows[0];

      const existingPaymentRes = await client.query(
        "SELECT * FROM payments WHERE loan_id = $1 AND idempotency_key = $2",
        [loanId, idempotencyKey]
      );

      if (existingPaymentRes.rows.length > 0) {
        const existingPayment = existingPaymentRes.rows[0];
        if (
          existingPayment.amount_paise === amountPaise &&
          existingPayment.payment_date === paymentDate
        ) {
          const allocRes = await client.query(
            `SELECT pa.interest_paise, pa.principal_paise, pa.is_late, i.installment_number
             FROM payment_allocations pa
             JOIN installments i ON pa.installment_id = i.id
             WHERE pa.payment_id = $1
             ORDER BY i.installment_number ASC`,
            [existingPayment.id]
          );

          const formattedPayment = {
            id: existingPayment.id,
            amount: paiseToRupees(existingPayment.amount_paise),
            paymentDate: existingPayment.payment_date,
            idempotencyKey: existingPayment.idempotency_key,
            createdAt:
              existingPayment.created_at instanceof Date
                ? existingPayment.created_at.toISOString()
                : existingPayment.created_at,
            allocations: allocRes.rows.map((a) => ({
              installmentNumber: a.installment_number,
              interest: paiseToRupees(a.interest_paise),
              principal: paiseToRupees(a.principal_paise),
              isLate: a.is_late,
            })),
          };

          console.log(
            JSON.stringify({
              event: "payment.duplicate",
              loanId,
              paymentId: existingPayment.id,
            })
          );

          const loanDetail = await getLoanDetail(loanId, client);

          return {
            replayed: true,
            payment: formattedPayment,
            loan: loanDetail,
          };
        } else {
          throw new ApiError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "This idempotency key was already used with a different amount or date"
          );
        }
      }

      if (paymentDate < loanRow.disbursement_date) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid request", [
          {
            field: "paymentDate",
            message: "Payment date cannot be before the disbursement date",
          },
        ]);
      }

      const installmentsRes = await client.query(
        "SELECT * FROM installments WHERE loan_id = $1 ORDER BY installment_number ASC FOR UPDATE",
        [loanId]
      );

      const mappedInstallments = installmentsRes.rows.map(mapInstallmentRow);
      const { allocations } = allocatePayment({
        installments: mappedInstallments,
        amountPaise,
        paymentDate,
      });

      const paymentRes = await client.query(
        `INSERT INTO payments (
          loan_id,
          amount_paise,
          payment_date,
          idempotency_key
        ) VALUES ($1, $2, $3, $4) RETURNING *`,
        [loanId, amountPaise, paymentDate, idempotencyKey]
      );

      const paymentRow = paymentRes.rows[0];

      const valuePlaceholders = [];
      const params = [];

      allocations.forEach((alloc, index) => {
        const offset = index * 5;
        valuePlaceholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
        );
        params.push(
          paymentRow.id,
          alloc.installmentId,
          alloc.interestPaise,
          alloc.principalPaise,
          alloc.isLate
        );
      });

      await client.query(
        `INSERT INTO payment_allocations (
          payment_id,
          installment_id,
          interest_paise,
          principal_paise,
          is_late
        ) VALUES ${valuePlaceholders.join(", ")}`,
        params
      );

      for (const alloc of allocations) {
        await client.query(
          `UPDATE installments
           SET interest_paid_paise = interest_paid_paise + $1,
               principal_paid_paise = principal_paid_paise + $2,
               last_payment_date = GREATEST(COALESCE(last_payment_date, $3), $3)
           WHERE id = $4`,
          [
            alloc.interestPaise,
            alloc.principalPaise,
            paymentDate,
            alloc.installmentId,
          ]
        );
      }

      const formattedPayment = {
        id: paymentRow.id,
        amount: paiseToRupees(paymentRow.amount_paise),
        paymentDate: paymentRow.payment_date,
        idempotencyKey: paymentRow.idempotency_key,
        createdAt:
          paymentRow.created_at instanceof Date
            ? paymentRow.created_at.toISOString()
            : paymentRow.created_at,
        allocations: allocations.map((a) => ({
          installmentNumber: a.installmentNumber,
          interest: paiseToRupees(a.interestPaise),
          principal: paiseToRupees(a.principalPaise),
          isLate: a.isLate,
        })),
      };

      console.log(
        JSON.stringify({
          event: "payment.allocated",
          loanId,
          paymentId: paymentRow.id,
          amount: paiseToRupees(amountPaise),
        })
      );

      const loanDetail = await getLoanDetail(loanId, client);

      return {
        replayed: false,
        payment: formattedPayment,
        loan: loanDetail,
      };
    });
  } catch (err) {
    if (err && err.code === "23505") {
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This idempotency key was already used with a different amount or date"
      );
    }
    throw err;
  }
}
