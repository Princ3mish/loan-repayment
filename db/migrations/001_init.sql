CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_paise BIGINT NOT NULL CHECK (principal_paise > 0),
  annual_rate_bps INTEGER NOT NULL CHECK (annual_rate_bps >= 0),
  tenure_months INTEGER NOT NULL CHECK (tenure_months >= 1 AND tenure_months <= 36),
  disbursement_date DATE NOT NULL,
  emi_paise BIGINT NOT NULL CHECK (emi_paise > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  due_date DATE NOT NULL,
  principal_due_paise BIGINT NOT NULL CHECK (principal_due_paise >= 0),
  interest_due_paise BIGINT NOT NULL CHECK (interest_due_paise >= 0),
  total_due_paise BIGINT NOT NULL CHECK (total_due_paise > 0),
  principal_paid_paise BIGINT NOT NULL DEFAULT 0 CHECK (principal_paid_paise >= 0),
  interest_paid_paise BIGINT NOT NULL DEFAULT 0 CHECK (interest_paid_paise >= 0),
  last_payment_date DATE NULL,
  UNIQUE(loan_id, installment_number),
  CHECK (principal_paid_paise <= principal_due_paise),
  CHECK (interest_paid_paise <= interest_due_paise),
  CHECK (total_due_paise = principal_due_paise + interest_due_paise)
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE RESTRICT,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  payment_date DATE NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(loan_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  installment_id UUID NOT NULL REFERENCES installments(id),
  interest_paise BIGINT NOT NULL CHECK (interest_paise >= 0),
  principal_paise BIGINT NOT NULL CHECK (principal_paise >= 0),
  is_late BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_installments_loan_id ON installments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_loan_id ON payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_installment_id ON payment_allocations(installment_id);
