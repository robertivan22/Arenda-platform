-- Add RCA fields to machines table
ALTER TABLE machines
  ADD COLUMN IF NOT EXISTS rca_active      BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS rca_price       NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS rca_expiry_date DATE;
