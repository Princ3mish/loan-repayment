# Vitto Loan Repayment Service

A deterministic, reducing-balance loan repayment and payment allocation service with paise-precision accounting, row-level concurrency control, and idempotency guarantees.

## Live Demo

Deployed URL: DEPLOYED_URL_HERE

Test account credentials are provided in the submission email.

## Seeded Loans

| Letter | Scenario | Loan ID | What to look at |
| --- | --- | --- | --- |
| A | Overdue with late and partial payments | `e7b85b0e-99d7-45ca-8a49-32440cbda6d5` | ₹64,895 overdue across 7 instalments; instalment 2 paid 11 days late; instalment 3 partially paid |
| B | Up to date | `3cfdcd51-a5cd-45cd-b3c0-9d0333e59614` | Nothing overdue, next due 15 Oct 2026 |
| C | New loan, no payments | `1cb3951d-16a1-4ee4-bbec-4a5ed3741bc7` | 3-month loan with no payments yet, first due 20 Oct 2026 |
| D | Paid ahead via overpayment | `7756a152-f1eb-4e28-b539-62a8eb7e90cf` | Two double-EMI payments settled instalments 1-4, next due 1 Nov 2026 |

## Stack and Hosting

- **Framework**: Next.js (App Router, JavaScript only)
- **Database**: PostgreSQL on Neon
- **Authentication**: Firebase Authentication
- **Hosting**: Vercel (Region `sin1`)
- **Database Client**: `pg` pool with plain SQL migrations

## Local Setup

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/Princ3mish/loan-repayment.git
   cd loan-repayment
   npm install
   ```
2. Copy environment file and configure secrets:
   ```bash
   cp .env.example .env.local
   ```
   - `DATABASE_URL`: PostgreSQL connection string with SSL.
   - `NEXT_PUBLIC_FIREBASE_*`: Firebase Client configuration for frontend authentication.
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`: Firebase Admin SDK credentials for token verification.
   - `TEST_USER_EMAIL`, `TEST_USER_PASSWORD`: Credentials for the automated test / seed user.
   - `DISABLE_RATE_LIMIT`: Optional flag (`true` or `false`) to bypass rate limiting in local tests.
3. Run migrations, start dev server, and seed data:
   ```bash
   npm run db:migrate
   npm run dev
   npm run seed
   ```

## Tests

Run the complete test suite with Vitest:
```bash
npm test
```
To run only unit tests without hitting a database:
```bash
npm run test:unit
```

- **Unit Coverage**: Pure function tests for reducing-balance schedule calculation, remainder absorption, paise-precision money arithmetic, waterflow payment allocations, and request payload validations.
- **Integration Coverage**: End-to-end tests exercising real Next.js route handlers against PostgreSQL with Firebase authentication, verifying loan creation, payment recording, strict idempotency replays/conflicts, and row-level locking under concurrent requests.
- **Database Environments**: Set `TEST_DATABASE_URL` (e.g. a separate Neon branch) in `.env.local` for isolated local testing. In CI, a dedicated `postgres:16` service container is spun up automatically.
- **GitHub Actions Secrets**: The CI workflow runs on every push and pull request and requires the following repository secrets:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
  - `TEST_USER_EMAIL`
  - `TEST_USER_PASSWORD`

## API Reference

### Endpoints

| Method | Endpoint | Request Body | Success Status |
| --- | --- | --- | --- |
| `POST` | `/api/loans` | `{ principal, annualInterestRate, tenureMonths, disbursementDate }` | `201 Created` |
| `GET` | `/api/loans` | None | `200 OK` |
| `GET` | `/api/loans/:id` | None | `200 OK` |
| `POST` | `/api/loans/:id/payments` | `{ amount, paymentDate, idempotencyKey? }` | `200 OK` |

The payment idempotency key may be provided as an `Idempotency-Key` HTTP header or as `idempotencyKey` inside the JSON request body.

### Response Envelope

Success response:
```json
{
  "success": true,
  "data": { ... }
}
```

Error response:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [ ... ]
  }
}
```

### Error Codes

- `400 VALIDATION_ERROR`: Missing or malformed parameters.
- `400 INVALID_JSON`: Request body is not valid JSON.
- `401 UNAUTHENTICATED`: Missing, expired, or invalid Firebase ID token.
- `404 LOAN_NOT_FOUND`: Target loan ID does not exist.
- `409 IDEMPOTENCY_CONFLICT`: Idempotency key reused with mismatched amount or date.
- `422 PAYMENT_EXCEEDS_OUTSTANDING`: Payment amount exceeds total remaining loan balance.
- `422 LOAN_ALREADY_CLOSED`: Loan is already fully settled.
- `429 RATE_LIMITED`: Rate limit exceeded (limit: 30 requests per minute).
- `500 INTERNAL_ERROR`: Internal server failure.

## Money Type

- All monetary amounts are stored internally as integer `BIGINT` paise (1 INR = 100 paise) to prevent floating-point rounding errors.
- Decimal rupee strings with exactly two decimal places (e.g., `"9985.00"`) are used across the API boundary.
- Input parsing uses string split and integer math; floats are never multiplied by 100.
- Annual interest rates are stored as integer basis points (e.g., 18.00% = `1800` bps).

## Schedule and Rounding

- Repayment schedules are generated using the standard reducing-balance monthly EMI formula:
  $$E = P \cdot \frac{r(1+r)^n}{(1+r)^n - 1}$$
- The monthly EMI is rounded to the nearest whole rupee.
- Each instalment's monthly interest is computed and rounded to the nearest paisa on the opening principal balance:
  $$\text{interestPaise} = \text{round}\left(\frac{\text{balancePaise} \times \text{bps}}{120000}\right)$$
- The final instalment absorbs any remaining rounding difference so that total scheduled principal sums exactly to the disbursed principal.
- Example: Principal ₹2,00,000 at 18.00% for 24 months yields a monthly EMI of ₹9,985.00.

## Allocation Order and Edge Cases

- **Allocation Priority**: Payments are applied to the oldest outstanding instalment first. Within each instalment, interest is settled before principal.
- **Overpayment**: Excess funds automatically cascade to settle subsequent instalments. Overpayment settles future scheduled instalments in chronological order (it does not reduce principal or re-amortise, as prepayment closure is out of scope).
- **Underpayment**: Partial payments satisfy due interest first and remaining amounts against principal, leaving the instalment in a `PARTIALLY_PAID` state.
- **Overdue Tracking**: An instalment becomes overdue starting the day after its `dueDate`. The loan position dynamically reports `overdueAmount`, `overdueInstallmentCount`, and `oldestOverdueDays`.
- **Late Payments**: Payments made after the due date are allocated normally, flagging the instalment with `paidLate = true`. No penalty interest is applied.
- **Overpayment Guard**: Any payment exceeding the total outstanding loan balance is rejected with `422 PAYMENT_EXCEEDS_OUTSTANDING`.
- **Date Validation**: Payments dated prior to loan disbursement or in the future (past current IST date) are rejected with `400 VALIDATION_ERROR`.
- **Idempotency**: Duplicate payment submissions are prevented via unique `(loan_id, idempotency_key)` constraints. Replaying an identical payload returns the existing payment with `200 OK` and `replayed: true`. Reusing a key with different parameters is rejected with `409 IDEMPOTENCY_CONFLICT`.

## Concurrency and Integrity

- Each payment transaction acquires an exclusive row-level lock using `SELECT * FROM loans WHERE id = $1 FOR UPDATE` and locks associated instalments. Concurrent payment submissions on the same loan are strictly serialised, preventing race conditions on allocations and idempotency checks.
- Relational integrity is enforced at the PostgreSQL schema level via foreign keys (`ON DELETE CASCADE` / `ON DELETE RESTRICT`) and `CHECK` constraints (e.g., paid amounts cannot exceed due amounts, amounts must be positive).

## Limitations and Scaling Notes

- **Distributed Rate Limiting**: The current sliding-window rate limiter is in-memory per container instance and can be backed by Redis in multi-instance production environments.
- **Horizontal Scaling**: Next.js API handlers are fully stateless, enabling seamless horizontal auto-scaling on serverless platforms.
- **Read Replicas**: High-volume read traffic (`GET /api/loans`, `GET /api/loans/:id`) can be offloaded to PostgreSQL read replicas while write transactions remain on the primary node.
- **Multi-Tenancy**: Loans are currently global across authenticated users per project specification, with user ownership scoping adaptable via user ID relational filters.
