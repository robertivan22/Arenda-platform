-- ============================================================
-- ArendaPro: UIT auto-expiry — pg_cron daily job
-- Run in: Supabase Dashboard → SQL Editor
-- Requires: pg_cron extension enabled in Database → Extensions
-- ============================================================

-- ── 1. Expiry function ─────────────────────────────────────
-- Updates all activ UIT rows whose valabil_pana is in the past.
-- Returns the count of rows updated (useful for logging/monitoring).
CREATE OR REPLACE FUNCTION expire_uit()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER          -- runs as owner, bypasses RLS for the UPDATE
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE transporturi_uit
  SET    status     = 'expirat',
         updated_at = now()
  WHERE  status      = 'activ'
    AND  valabil_pana < CURRENT_DATE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Revoke public execute — only the cron job (superuser / postgres role) runs this
REVOKE EXECUTE ON FUNCTION expire_uit() FROM PUBLIC;

-- ── 2. pg_cron schedule ────────────────────────────────────
-- Runs every day at 02:00 UTC (04:00 or 05:00 Romania time depending on DST).
-- pg_cron must be enabled first: Database → Extensions → pg_cron
--
-- If pg_cron is not enabled, comment this block and call expire_uit()
-- manually or via a Supabase Edge Function with a Cloudflare Cron Trigger.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'expire-uit-daily',           -- job name (must be unique)
      '0 2 * * *',                  -- cron expression: 02:00 UTC daily
      $cron$SELECT expire_uit()$cron$
    );
  END IF;
END;
$$;

-- ── 3. Helper view: UITs expiring within 2 days (for alerte) ──
-- Used by the alerte API route to surface warnings without a full table scan.
CREATE OR REPLACE VIEW uit_expiry_soon AS
SELECT
  t.id,
  t.user_id,
  t.machine_id,
  t.cod_uit,
  t.tip_operatiune,
  t.valabil_pana,
  t.status,
  m.name AS machine_name,
  (t.valabil_pana - CURRENT_DATE) AS days_remaining
FROM transporturi_uit t
LEFT JOIN machines m ON m.id = t.machine_id
WHERE t.status  = 'activ'
  AND t.valabil_pana <= CURRENT_DATE + INTERVAL '2 days';

-- RLS on the view is inherited from the underlying table policy.
-- The view is SECURITY INVOKER by default so user_id = auth.uid() still applies.
