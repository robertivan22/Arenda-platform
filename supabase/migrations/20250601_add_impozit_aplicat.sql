-- ============================================================
-- Migration: impozit_aplicat + server-side recalculation trigger
-- Run this in Supabase SQL Editor for project hsaomcgssyyxroezhgcp
-- ============================================================

-- Step 1: Add column
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS impozit_aplicat BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Backfill — if tax_amount > 0 on existing rows, flag as applied
UPDATE public.transactions
  SET impozit_aplicat = true
  WHERE tax_amount > 0;

-- Step 3: Server-side recalculation function
--   ron_brut  = kg_brut * price_per_unit
--   tax_amount = ron_brut * 0.10  (only if impozit_aplicat = true)
--   ron_net   = ron_brut - tax_amount
CREATE OR REPLACE FUNCTION public.trg_recalculate_transaction_fn()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ron_brut   := ROUND((COALESCE(NEW.kg_brut, 0) * COALESCE(NEW.price_per_unit, 0))::NUMERIC, 2);
  IF NEW.impozit_aplicat THEN
    NEW.tax_amount := ROUND((NEW.ron_brut * 0.10)::NUMERIC, 2);
    NEW.ron_net    := NEW.ron_brut - NEW.tax_amount;
  ELSE
    NEW.tax_amount := 0;
    NEW.ron_net    := NEW.ron_brut;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Attach trigger (BEFORE INSERT OR UPDATE)
DROP TRIGGER IF EXISTS trg_recalculate_transaction ON public.transactions;

CREATE TRIGGER trg_recalculate_transaction
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_transaction_fn();

-- Step 5: Recompute all existing rows with new formula
UPDATE public.transactions SET updated_at = NOW()
  WHERE id IS NOT NULL;
-- (the trigger fires on UPDATE and recomputes all rows)
