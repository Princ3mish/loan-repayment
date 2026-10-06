import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as createLoanRoute, GET as listLoansRoute } from "@/app/api/loans/route.js";
import { GET as getLoanRoute } from "@/app/api/loans/[id]/route.js";
import { POST as recordPaymentRoute } from "@/app/api/loans/[id]/payments/route.js";
import { pool } from "@/lib/db.js";
import { getIdToken, makeRequest, params } from "./helpers.js";

describe("API Route Handlers Integration", () => {
  let token;
  const createdLoanIds = [];

  beforeAll(async () => {
    token = await getIdToken();
  });

  afterAll(async () => {
    for (const loanId of createdLoanIds) {
      await pool.query(
        "DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE loan_id = $1)",
        [loanId]
      );
      await pool.query("DELETE FROM payments WHERE loan_id = $1", [loanId]);
      await pool.query("DELETE FROM installments WHERE loan_id = $1", [loanId]);
      await pool.query("DELETE FROM loans WHERE id = $1", [loanId]);
    }
    await pool.end();
  });

  it("rejects unauthenticated requests with 401 UNAUTHENTICATED", async () => {
    const dummyId = "00000000-0000-0000-0000-000000000000";

    const getReq = makeRequest(`/api/loans/${dummyId}`);
    const getRes = await getLoanRoute(getReq, params(dummyId));
    expect(getRes.status).toBe(401);
    const getJson = await getRes.json();
    expect(getJson.success).toBe(false);
    expect(getJson.error.code).toBe("UNAUTHENTICATED");

    const postReq = makeRequest(`/api/loans/${dummyId}/payments`, {
      method: "POST",
      body: {
        amount: 1000,
        paymentDate: "2026-02-01",
        idempotencyKey: "no-auth-key",
      },
    });
    const postRes = await recordPaymentRoute(postReq, params(dummyId));
    expect(postRes.status).toBe(401);
    const postJson = await postRes.json();
    expect(postJson.success).toBe(false);
    expect(postJson.error.code).toBe("UNAUTHENTICATED");
  });

  it("handles the standard success path with idempotency", async () => {
    const createReq = makeRequest("/api/loans", {
      method: "POST",
      token,
      body: {
        principal: 200000,
        annualInterestRate: 18,
        tenureMonths: 24,
        disbursementDate: "2026-01-01",
      },
    });
    const createRes = await createLoanRoute(createReq);
    expect(createRes.status).toBe(201);
    const createJson = await createRes.json();
    expect(createJson.success).toBe(true);

    const loanId = createJson.data.loan.id;
    createdLoanIds.push(loanId);
    expect(createJson.data.schedule).toHaveLength(24);
    expect(parseFloat(createJson.data.position.overdueAmount)).toBeGreaterThan(0);

    const payReq1 = makeRequest(`/api/loans/${loanId}/payments`, {
      method: "POST",
      token,
      body: {
        amount: 5000,
        paymentDate: "2026-02-01",
        idempotencyKey: "it-1",
      },
    });
    const payRes1 = await recordPaymentRoute(payReq1, params(loanId));
    expect(payRes1.status).toBe(201);
    const payJson1 = await payRes1.json();
    expect(payJson1.data.loan.position.totalPaid).toBe("5000.00");
    expect(payJson1.data.replayed).toBe(false);

    const payReqDuplicate = makeRequest(`/api/loans/${loanId}/payments`, {
      method: "POST",
      token,
      body: {
        amount: 5000,
        paymentDate: "2026-02-01",
        idempotencyKey: "it-1",
      },
    });
    const payResDuplicate = await recordPaymentRoute(
      payReqDuplicate,
      params(loanId)
    );
    expect(payResDuplicate.status).toBe(200);
    const payJsonDuplicate = await payResDuplicate.json();
    expect(payJsonDuplicate.success).toBe(true);
    expect(payJsonDuplicate.data.replayed).toBe(true);
    expect(payJsonDuplicate.data.loan.position.totalPaid).toBe("5000.00");

    const payReqConflict = makeRequest(`/api/loans/${loanId}/payments`, {
      method: "POST",
      token,
      body: {
        amount: 6000,
        paymentDate: "2026-02-01",
        idempotencyKey: "it-1",
      },
    });
    const payResConflict = await recordPaymentRoute(
      payReqConflict,
      params(loanId)
    );
    expect(payResConflict.status).toBe(409);
    const payJsonConflict = await payResConflict.json();
    expect(payJsonConflict.success).toBe(false);
    expect(payJsonConflict.error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("handles failure paths correctly", async () => {
    const unknownId = "11111111-2222-4333-8444-555555555555";
    const getReq = makeRequest(`/api/loans/${unknownId}`, { token });
    const getRes = await getLoanRoute(getReq, params(unknownId));
    expect(getRes.status).toBe(404);
    const getJson = await getRes.json();
    expect(getJson.error.code).toBe("LOAN_NOT_FOUND");

    const badCreateReq = makeRequest("/api/loans", {
      method: "POST",
      token,
      body: {
        principal: 200000,
        annualInterestRate: 18,
        tenureMonths: 0,
        disbursementDate: "2026-01-01",
      },
    });
    const badCreateRes = await createLoanRoute(badCreateReq);
    expect(badCreateRes.status).toBe(400);
    const badCreateJson = await badCreateRes.json();
    expect(badCreateJson.error.code).toBe("VALIDATION_ERROR");

    const validCreateReq = makeRequest("/api/loans", {
      method: "POST",
      token,
      body: {
        principal: 50000,
        annualInterestRate: 12,
        tenureMonths: 3,
        disbursementDate: "2026-09-01",
      },
    });
    const validCreateRes = await createLoanRoute(validCreateReq);
    const validCreateJson = await validCreateRes.json();
    const loanId = validCreateJson.data.loan.id;
    createdLoanIds.push(loanId);

    const excessivePayReq = makeRequest(`/api/loans/${loanId}/payments`, {
      method: "POST",
      token,
      body: {
        amount: 999999,
        paymentDate: "2026-09-15",
        idempotencyKey: "excessive-key",
      },
    });
    const excessivePayRes = await recordPaymentRoute(
      excessivePayReq,
      params(loanId)
    );
    expect(excessivePayRes.status).toBe(422);
    const excessivePayJson = await excessivePayRes.json();
    expect(excessivePayJson.error.code).toBe("PAYMENT_EXCEEDS_OUTSTANDING");

    const detailReq = makeRequest(`/api/loans/${loanId}`, { token });
    const detailRes = await getLoanRoute(detailReq, params(loanId));
    const detailJson = await detailRes.json();
    expect(detailJson.data.position.totalPaid).toBe("0.00");
  });

  it("serialises concurrent payments correctly", async () => {
    const createReq = makeRequest("/api/loans", {
      method: "POST",
      token,
      body: {
        principal: 200000,
        annualInterestRate: 18,
        tenureMonths: 24,
        disbursementDate: "2026-01-01",
      },
    });
    const createRes = await createLoanRoute(createReq);
    const createJson = await createRes.json();
    const loanId = createJson.data.loan.id;
    createdLoanIds.push(loanId);

    const paymentPromises = Array.from({ length: 5 }, (_, i) => {
      const payReq = makeRequest(`/api/loans/${loanId}/payments`, {
        method: "POST",
        token,
        body: {
          amount: 1000,
          paymentDate: "2026-02-01",
          idempotencyKey: `concurrent-key-${i + 1}`,
        },
      });
      return recordPaymentRoute(payReq, params(loanId));
    });

    const results = await Promise.all(paymentPromises);
    for (const res of results) {
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
    }

    const detailReq = makeRequest(`/api/loans/${loanId}`, { token });
    const detailRes = await getLoanRoute(detailReq, params(loanId));
    const detailJson = await detailRes.json();
    expect(detailJson.data.position.totalPaid).toBe("5000.00");

    const sumAllocRes = await pool.query(
      `SELECT COALESCE(SUM(interest_paise + principal_paise), 0) AS total_alloc_paise
       FROM payment_allocations
       WHERE payment_id IN (SELECT id FROM payments WHERE loan_id = $1)`,
      [loanId]
    );
    const sumPaymentsRes = await pool.query(
      `SELECT COALESCE(SUM(amount_paise), 0) AS total_payments_paise
       FROM payments
       WHERE loan_id = $1`,
      [loanId]
    );

    const totalAllocPaise = Number(sumAllocRes.rows[0].total_alloc_paise);
    const totalPaymentsPaise = Number(sumPaymentsRes.rows[0].total_payments_paise);

    expect(totalAllocPaise).toBe(500000);
    expect(totalPaymentsPaise).toBe(500000);
    expect(totalAllocPaise).toBe(totalPaymentsPaise);
  });
});
