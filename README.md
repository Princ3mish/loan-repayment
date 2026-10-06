<div align="center">

# 🏦 Vitto — Loan Repayment Service

**A production-grade reducing-balance loan management API with paise-precision accounting, row-level concurrency control, and full idempotency guarantees.**

[![CI](https://github.com/Princ3mish/loan-repayment/actions/workflows/ci.yml/badge.svg)](https://github.com/Princ3mish/loan-repayment/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Firebase](https://img.shields.io/badge/Firebase-Auth-orange?logo=firebase)](https://firebase.google.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)](https://www.postgresql.org)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?logo=vercel)](https://loan-repayment-flax.vercel.app)

</div>

---

## 🌐 Live Demo

**[https://loan-repayment-flax.vercel.app](https://loan-repayment-flax.vercel.app)**

> Test account credentials are provided in the submission email.

---

## ✨ Key Features

| Feature | Detail |
|---|---|
| **Reducing-balance EMI** | Standard monthly formula, EMI rounded to nearest rupee |
| **Paise-precision arithmetic** | All amounts stored as `BIGINT` paise; no floating-point rounding |
| **Allocation waterfall** | Oldest instalment first; interest before principal within each instalment |
| **Idempotency** | Unique `(loan_id, idempotency_key)` DB constraint — safe to replay |
| **Row-level locking** | `SELECT … FOR UPDATE` serialises concurrent payments on the same loan |
| **Overdue tracking** | Dynamic `overdueAmount`, `overdueInstallmentCount`, `oldestOverdueDays` |
| **Overpayment cascading** | Excess funds auto-settle future instalments in date order |
| **Rate limiting** | 30 req / min sliding window per user (disable with `DISABLE_RATE_LIMIT=true`) |
| **CI/CD** | GitHub Actions → Vercel; migrations run automatically on deploy |

---

## 🗂 Seeded Loans

| Letter | Scenario | Loan ID | What to look at |
|---|---|---|---|
| A | Overdue — late & partial payments | `e1e2ad21-c7fc-4010-8622-6dda363b3a94` | ₹64,895 overdue as of Oct 2026; instalment 2 paid 11 days late; instalment 3 partial |
| B | Fully up to date | `8c329b0c-a479-4ee6-83a1-6b6e00fabb62` | Nothing overdue; next due 15 Oct 2026 |
| C | New loan, no payments | `dc1db682-80bd-490f-ae87-410ed56d587e` | 3-month loan; first instalment due 20 Oct 2026 |
| D | Paid ahead via overpayment | `850ccbd3-624a-490a-9cf4-6a1028a54989` | Two double-EMI payments settled instalments 1–4; next due 1 Nov 2026 |

---

## 🛠 Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 — App Router, JavaScript only |
| Database | PostgreSQL 16 on [Neon](https://neon.tech) (region `sin1`) |
| Auth | Firebase Authentication (client) + Firebase Admin SDK (server) |
| Hosting | Vercel — serverless functions, region `sin1` |
| Tests | Vitest — unit + integration against a real PostgreSQL instance |
| CI | GitHub Actions — runs on every push and pull request |

---

## 🚀 Local Setup

```bash
# 1. Clone and install
git clone https://github.com/Princ3mish/loan-repayment.git
cd loan-repayment
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in the values described below

# 3. Migrate, start, and seed
npm run db:migrate
npm run dev
npm run seed
```

### Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (SSL required) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase client auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase client project ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase client app ID |
| `FIREBASE_PROJECT_ID` | Firebase Admin SDK project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin SDK service account email |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK private key (literal `\n` sequences supported) |
| `TEST_USER_EMAIL` | Email used by seed script and integration tests |
| `TEST_USER_PASSWORD` | Password for the test user |
| `TEST_DATABASE_URL` | Optional isolated DB for tests (falls back to `DATABASE_URL`) |
| `DISABLE_RATE_LIMIT` | Set `true` to bypass rate limiting locally |

---

## 🧪 Tests

```bash
npm test           # Full suite (unit + integration, requires DB)
npm run test:unit  # Unit tests only — no database needed
```

### Coverage

| Suite | What is tested |
|---|---|
| `money.test.js` | Paise parsing, formatting, arithmetic edge cases |
| `validation.test.js` | Request payload validation rules |
| `schedule.test.js` | Reducing-balance schedule generation and final-instalment rounding absorption |
| `allocation.test.js` | Payment allocation waterfall, partial payments, overpayment cascading |
| `api.integration.test.js` | Full HTTP round-trips — loan creation, idempotent replays, conflict detection, concurrent serialisation |

> Integration tests spin up real Next.js route handlers against PostgreSQL and authenticate via the Firebase REST API, exercising exactly the same code paths as production.

### CI Secrets Required

The GitHub Actions workflow requires these repository secrets:

`NEXT_PUBLIC_FIREBASE_API_KEY` · `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` · `NEXT_PUBLIC_FIREBASE_PROJECT_ID` · `NEXT_PUBLIC_FIREBASE_APP_ID` · `FIREBASE_PROJECT_ID` · `FIREBASE_CLIENT_EMAIL` · `FIREBASE_PRIVATE_KEY` · `TEST_USER_EMAIL` · `TEST_USER_PASSWORD`

---

## 📡 API Reference

All endpoints require a Firebase ID token:
```
Authorization: Bearer <firebase-id-token>
```

### Endpoints

| Method | Path | Body | Status |
|---|---|---|---|
| `POST` | `/api/loans` | `{ principal, annualInterestRate, tenureMonths, disbursementDate }` | `201` |
| `GET` | `/api/loans` | — | `200` |
| `GET` | `/api/loans/:id` | — | `200` |
| `POST` | `/api/loans/:id/payments` | `{ amount, paymentDate, idempotencyKey? }` | `200` |

The idempotency key can be supplied as the `Idempotency-Key` HTTP header **or** as `idempotencyKey` in the JSON body.

### Response Envelope

```json
{ "success": true,  "data": { ... } }
{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }
```

### Error Codes

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing or malformed parameters |
| `INVALID_JSON` | 400 | Request body is not valid JSON |
| `UNAUTHENTICATED` | 401 | Missing, expired, or invalid Firebase ID token |
| `LOAN_NOT_FOUND` | 404 | Target loan does not exist |
| `IDEMPOTENCY_CONFLICT` | 409 | Idempotency key reused with different amount or date |
| `PAYMENT_EXCEEDS_OUTSTANDING` | 422 | Payment exceeds total remaining balance |
| `LOAN_ALREADY_CLOSED` | 422 | Loan is fully settled |
| `RATE_LIMITED` | 429 | 30 requests per minute exceeded |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## 💰 Money & Schedule Model

- All monetary values stored as integer **BIGINT paise** (1 INR = 100 paise).
- API boundary uses decimal rupee strings with exactly two decimal places: `"9985.00"`.
- Annual interest rates stored as integer **basis points** (18.00% → `1800`).
- EMI formula (reducing balance):

$$E = P \cdot \frac{r(1+r)^n}{(1+r)^n - 1}$$

- Monthly interest per instalment: $\text{interestPaise} = \text{round}\!\left(\dfrac{\text{balancePaise} \times \text{bps}}{120000}\right)$
- The **final instalment absorbs all rounding differences** so scheduled principal sums exactly to the disbursed principal.
- Example: ₹2,00,000 at 18.00% for 24 months → EMI **₹9,985.00**.

---

## ⚙️ Allocation & Edge Cases

- **Priority**: Oldest instalment first; within each instalment — interest before principal.
- **Overpayment**: Cascades forward through future instalments in chronological order.
- **Underpayment**: Satisfies interest first, remainder against principal → `PARTIALLY_PAID`.
- **Late payments**: Allocated normally; instalment flagged `paidLate: true`. No penalty interest.
- **Overdue**: Day after `dueDate`. Reported dynamically on the loan position.
- **Date guard**: Payments before disbursement date or after today (Asia/Kolkata) are rejected.
- **Overpayment guard**: Amount exceeding total outstanding balance → `422 PAYMENT_EXCEEDS_OUTSTANDING`.

---

## 🔒 Concurrency & Integrity

- Each payment transaction acquires an **exclusive row-level lock** (`SELECT … FOR UPDATE`) on the loan and its instalments — concurrent submissions are strictly serialised.
- Schema-level integrity: foreign keys (`ON DELETE CASCADE` / `RESTRICT`) and `CHECK` constraints (paid ≤ due, amounts positive).

---

## 📈 Scaling Notes

- **Rate limiting**: In-memory sliding window per container; swap for Redis in multi-instance deployments.
- **Stateless handlers**: Next.js API routes are fully stateless — horizontal auto-scaling on Vercel requires no changes.
- **Read replicas**: `GET` endpoints can target a read replica while writes stay on the primary.
- **Multi-tenancy**: Loan ownership scoping is adaptable via user ID relational filters.

---

<div align="center">

Built with Next.js · PostgreSQL · Firebase · Vercel

</div>
