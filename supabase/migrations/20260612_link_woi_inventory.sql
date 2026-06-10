-- ============================================================
-- ArendaPro: Link work_order_inputs to input_lots (inventory)
-- Adds lot_id FK so campanie consumption deducts from stock.
-- Run in: Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Add lot_id to work_order_inputs (nullable - existing rows unaffected)
ALTER TABLE work_order_inputs
  ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES input_lots(id) ON DELETE SET NULL;

-- 2. Extend the stock-movement trigger to also reverse on DELETE
--    (so when a consumption work_order_input is deleted the app inserts
--     a reversal IN movement, which is handled by the existing INSERT trigger)
--    Nothing extra needed at DB level – the app handles reversals by
--    inserting an IN movement before deleting the work_order_input.

-- 3. Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_woi_lot ON work_order_inputs (lot_id) WHERE lot_id IS NOT NULL;
