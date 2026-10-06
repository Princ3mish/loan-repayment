import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const BASE_URL =
  process.argv[2] || process.env.SEED_BASE_URL || "http://localhost:3000";

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const email = process.env.TEST_USER_EMAIL || "testuser@example.com";
const password = process.env.TEST_USER_PASSWORD || "TestPassword123!";

async function getAuthToken() {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  const data = await res.json();
  if (!res.ok || !data.idToken) {
    console.error("Failed to authenticate test user with Firebase:", data);
    process.exit(1);
  }

  return data.idToken;
}

async function apiRequest(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    console.error(`Network request failed for ${url}:`, err.message);
    process.exit(1);
  }

  let json;
  try {
    json = await res.json();
  } catch {
    console.error(`Invalid JSON response from ${url} (HTTP ${res.status})`);
    process.exit(1);
  }

  if (!res.ok || json.success === false) {
    console.error(
      `API Error on ${options.method || "GET"} ${url} (HTTP ${res.status}):`,
      JSON.stringify(json, null, 2)
    );
    process.exit(1);
  }

  return json.data;
}

function matchesLoan(existingLoan, spec) {
  const specPrincipal = parseFloat(spec.principal).toFixed(2);
  const specRate = parseFloat(spec.annualInterestRate).toFixed(2);
  const existPrincipal = parseFloat(existingLoan.principal).toFixed(2);
  const existRate = parseFloat(existingLoan.annualInterestRate).toFixed(2);

  return (
    specPrincipal === existPrincipal &&
    specRate === existRate &&
    Number(existingLoan.tenureMonths) === Number(spec.tenureMonths) &&
    existingLoan.disbursementDate === spec.disbursementDate
  );
}

const SEED_DEFINITIONS = [
  {
    letter: "A",
    scenario: "Overdue with late and partial payments",
    spec: {
      principal: 200000,
      annualInterestRate: 18,
      tenureMonths: 24,
      disbursementDate: "2026-01-01",
    },
    getPayments: (emi) => [
      { amount: emi, paymentDate: "2026-02-01", idempotencyKey: "seed-A-1" },
      { amount: emi, paymentDate: "2026-03-12", idempotencyKey: "seed-A-2" },
      { amount: 5000, paymentDate: "2026-04-01", idempotencyKey: "seed-A-3" },
    ],
  },
  {
    letter: "B",
    scenario: "Up to date",
    spec: {
      principal: 500000,
      annualInterestRate: 14,
      tenureMonths: 36,
      disbursementDate: "2026-07-15",
    },
    getPayments: (emi) => [
      { amount: emi, paymentDate: "2026-08-15", idempotencyKey: "seed-B-1" },
      { amount: emi, paymentDate: "2026-09-15", idempotencyKey: "seed-B-2" },
    ],
  },
  {
    letter: "C",
    scenario: "New loan, no payments",
    spec: {
      principal: 50000,
      annualInterestRate: 12,
      tenureMonths: 3,
      disbursementDate: "2026-09-20",
    },
    getPayments: () => [],
  },
  {
    letter: "D",
    scenario: "Paid ahead via overpayment",
    spec: {
      principal: 1000000,
      annualInterestRate: 10.5,
      tenureMonths: 12,
      disbursementDate: "2026-06-01",
    },
    getPayments: (emi) => [
      { amount: emi * 2, paymentDate: "2026-07-01", idempotencyKey: "seed-D-1" },
      { amount: emi * 2, paymentDate: "2026-09-01", idempotencyKey: "seed-D-2" },
    ],
  },
];

async function main() {
  const token = await getAuthToken();
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const loansResponse = await apiRequest(`${BASE_URL}/api/loans`, {
    headers: authHeaders,
  });

  const existingLoans = loansResponse.loans || [];
  const results = [];

  for (const def of SEED_DEFINITIONS) {
    const found = existingLoans.find((l) => matchesLoan(l, def.spec));

    let loanId;
    if (found) {
      loanId = found.id;
      console.log(`Loan ${def.letter} already exists (${loanId}), skipping creation.`);
    } else {
      const created = await apiRequest(`${BASE_URL}/api/loans`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(def.spec),
      });

      loanId = created.loan.id;
      const emi = parseFloat(created.loan.emi);
      const paymentsToRecord = def.getPayments(emi);

      console.log(`Created Loan ${def.letter} (${loanId}), recording ${paymentsToRecord.length} payments...`);

      for (const p of paymentsToRecord) {
        await apiRequest(`${BASE_URL}/api/loans/${loanId}/payments`, {
          method: "POST",
          headers: {
            ...authHeaders,
            "Idempotency-Key": p.idempotencyKey,
          },
          body: JSON.stringify(p),
        });
      }
    }

    const detail = await apiRequest(`${BASE_URL}/api/loans/${loanId}`, {
      headers: authHeaders,
    });

    results.push({
      letter: def.letter,
      scenario: def.scenario,
      detail,
    });
  }

  console.log("\n| Letter | Scenario | Loan ID | Principal | Overdue amount | Next due |");
  console.log("| --- | --- | --- | --- | --- | --- |");
  for (const item of results) {
    const nextDue = item.detail.position.nextDueDate
      ? `${item.detail.position.nextDueDate} (₹${item.detail.position.nextDueAmount})`
      : item.detail.position.isClosed
      ? "Closed"
      : "None";
    console.log(
      `| ${item.letter} | ${item.scenario} | ${item.detail.loan.id} | ₹${item.detail.loan.principal} | ₹${item.detail.position.overdueAmount} | ${nextDue} |`
    );
  }
}

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
