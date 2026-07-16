-- ─────────────────────────────────────────────────────────────────────────────
-- Cleanup: delete orphaned parcele_fitosanitar rows
-- 
-- These are polygons left behind after parcels were deleted from the `parcels`
-- table when the FK was ON DELETE SET NULL (before the cascade-delete fix).
-- After running this, the map will only show polygons linked to active registry
-- parcels.
--
-- ⚠️  IMPORTANT: This will also remove any standalone drawn polygons (no registry
--     link). If you have intentionally drawn polygons without linking them to a
--     registry parcel, link them first via the map editor before running this.
--
-- Run in: Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Preview first (how many will be deleted):
SELECT COUNT(*) AS orphaned_count,
       ROUND(SUM(suprafata_ha)::numeric, 2) AS orphaned_ha
FROM parcele_fitosanitar
WHERE parcela_id IS NULL;

-- ─── Uncomment to actually delete ────────────────────────────────────────────
-- DELETE FROM parcele_fitosanitar
-- WHERE parcela_id IS NULL;
