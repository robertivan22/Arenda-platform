# ArendaPro — Principal Architect Review
**Date:** June 2025 | **Stack:** Next.js 15 + Cloudflare Pages + Supabase PostgreSQL

---

## 1. Executive Summary

ArendaPro has a solid, production-ready foundation for land-rental management and is now
expanding toward a full farm operating system. The compliance stack (e-Factura UBL 2.1,
D112, APIA dossiers) is production-quality. The operational stack (campaign, fleet,
phytosanitary) has real DB integration but surface-level UX. The financial stack has a
critical data-model smell: one `transactions` table blends three semantically distinct
concepts. The biggest structural gaps are: no input/inventory domain, no sales/logistics
domain, no unified parcel entity, and no cost/margin analytics.

**Overall maturity:**

| Domain              | Status         | Grade |
|---------------------|----------------|-------|
| Land registry core  | Production     | A     |
| Compliance          | Production     | A     |
| Fleet/machinery     | Real DB, shallow UX | B |
| Campaign/production | Real DB, shallow UX | B- |
| Farm intelligence   | Real (NDVI/Weather) | B  |
| Phytosanitary       | Real DB + GIS  | B     |
| Finance / invoicing | Real but overloaded model | C+ |
| Inventory / inputs  | Missing        | F     |
| Harvest / sales     | Skeleton only  | D     |
| Cost analytics      | Missing        | F     |
| e-Transport / SAF-T | Missing        | F     |

---

## 2. Current Architecture Assessment

### 2.1 Tech Stack

```
Browser
  └─ Next.js 15 (App Router, 'use client' everywhere, edge runtime)
       ├─ Tailwind CSS + Lucide React + Sonner toasts
       ├─ Leaflet + ESRI/OSM tiles (maps)
       └─ Supabase JS client (browser) / @supabase/ssr (edge routes)
              └─ Supabase PostgreSQL (hsaomcgssyyxroezhgcp)

External APIs
  ├─ Sentinel Hub (NDVI satellite imagery via WMS proxy)
  ├─ Open-Meteo (weather, soil moisture, ET₀)
  ├─ ANAF RO (e-Factura upload/status, UBL 2.1 XML)
  └─ Nominatim / OSM (geocoding)

Deployment: Cloudflare Pages via @cloudflare/next-on-pages
Config: wrangler.toml [vars] — no secrets in code ✅
```

### 2.2 Data Layer — Tables Confirmed Active

**Core Land Registry**
- `lessors` — arendatori (NATURAL/LEGAL/PFA)
- `contracts` — rental contracts with lessors
- `parcels` — parcel registry (legal/cadastral, links contracts ↔ lessors)
- `payments` — scheduled rent payment obligations
- `transactions` — **OVERLOADED** (see §2.4)
- `invoices` — invoice records + e-Factura tracking columns

**Production / Campaign**
- `campaigns` — agricultural seasons (year, active flag)
- `crop_plans` — parcel × campaign plan (crop, area, variety, yield target, status)
- `work_orders` — field operation orders (linked to campaign, parcel)
- `harvest_lots` — harvest records (yield per parcel × campaign)
- `work_order_inputs` — inputs consumed per work order *(schema exists, no UI)*

**Fleet**
- `machines` — tractor/combine/implement registry
- `implements` — attached implements
- `operators` — licensed operators
- `fuel_logs` — fuel consumption per machine
- `maintenance_tasks` — scheduled + completed maintenance
- `machine_work_logs` — operation hours/ha per machine × parcel × date
- `telematics_devices` — device registry *(schema only, no integration)*

**Phytosanitary / GIS**
- `registru_fitosanitar` — phytosanitary treatment log (BBCH-indexed)
- `parcele_fitosanitar` — GIS polygons (GeoJSON, Stereo70 support)

**Compliance**
- `efactura_submissions` — ANAF submission audit trail
- `anaf_oauth_tokens` — OAuth token store
- `company_settings` — firm details (CUI, IBAN, address)
- `user_permissions` — feature-level RBAC
- `profiles` — user profile

**APIA (migration pending)**
- `apia_campaigns`, `apia_dossiers`, `apia_dossier_parcels`
- `apia_interventions`, `apia_dossier_interventions`
- `apia_dossier_documents`, `apia_change_requests`
- `apia_zootechnical_declarations`, `apia_audit_log`

### 2.3 Module Inventory

| Route                   | UI Depth | DB Backed | Notes |
|-------------------------|----------|-----------|-------|
| /arendatori             | Full CRUD + 10 sub-tabs | ✅ | Complete |
| /contracte              | Full CRUD + transaction modal | ✅ | Complete |
| /parcele                | List + map + detail | ✅ | Two parcel systems (see §2.4) |
| /parcele/harta          | Leaflet + satellite | ✅ | GIS on `parcele_fitosanitar` |
| /plati                  | Transaction list + filters | ✅ | Overloaded table |
| /utilaje                | Machine list + CRUD | ✅ | Full fleet subtabs |
| /utilaje/[id]           | Detail: work_logs + fuel + maintenance | ✅ | Good depth |
| /campanie/[year]        | Campaign summary | ✅ | crop_plans + harvest_lots |
| /campanie/[year]/activitati | Work orders | ✅ | Real DB |
| /campanie/[year]/stocuri | Input stocks | ⚠️ | **Needs inspection** |
| /ferma                  | NDVI + weather dashboard | ✅ | Sentinel + Open-Meteo |
| /fitosanitar            | Treatment register + BBCH | ✅ | GIS polygons |
| /dashboard              | KPI cards + alerts | ✅ | farm-dashboard API |
| /efactura               | Validate + XML download | ✅ | UBL 2.1, ANAF API |
| /declaratii             | D112 + APIA CSV + history | ✅ | Real |
| /apia                   | Dossier hub | ✅ | Migration pending |
| /apia/[id]              | 6-tab dossier detail | ✅ | Migration pending |
| /rapoarte               | Reports page | ⚠️ | Depth unknown |
| /setari                 | Settings | ⚠️ | Depth unknown |

### 2.4 Critical Architecture Smells

#### Smell 1 — `transactions` table is three things at once

The table contains: rent payment events (`kg_brut`, `kg_net`, `price_per_unit`, `product_name`
linking to `lessors`+`contracts`) AND financial accounting fields (`campaign_year`, `ron_brut`,
`ron_net`, `tax_amount`, `impozit_aplicat`) AND invoice linking (`invoice_id`).

This conflation makes it impossible to:
- separately model commodity sales to customers (different buyer, different VAT logic)
- build a proper cost-of-goods ledger
- generate accurate P&L per campaign without ambiguity

#### Smell 2 — Two parcel systems, same physical entity

| Table | Purpose | Key fields |
|-------|---------|------------|
| `parcels` | Legal/administrative registry | bloc_fizic, tarla_nr, parcel_nr, county, surface, lessor_id, contract_id, apia_eligible |
| `parcele_fitosanitar` | GIS polygon storage | geometry_geojson, centru_lat/lng, cultura_label, `parcela_id` FK → parcels |

`parcele_fitosanitar` references `parcels` via `parcela_id` but this is optional and often
null. Neither table has full field overlap. The farm dashboard uses `parcels.lat/lng`
(centroid), while the phytosanitary + APIA GIS uses `parcele_fitosanitar.geometry_geojson`.

#### Smell 3 — `mockStore.ts` is a live file

The localStorage-based mock store (`mockStore.ts`) still ships in the production bundle.
It defines `lessors`, `contracts`, `parcels`, `payments` — the same entities now served
from Supabase. No page should import it in production, but its presence creates confusion
and bundle bloat.

#### Smell 4 — Type definitions lag behind DB reality

`campaign-types.ts` only defines `Campaign` and `CropPlan`. The app queries `work_orders`,
`harvest_lots`, `work_order_inputs` but has no canonical TypeScript types for them.
Same for the `transactions` overloaded shape. Missing types → `(data as any[])` casts
throughout, which undermines the TypeScript safety guarantee.

#### Smell 5 — No inventory / input tracking

`work_order_inputs` exists in the DB (implied by search results) but has no UI and no
`lib/` types. The `campanie/stocuri` route exists as a route group but its depth is
unknown. There is no `warehouses`, `input_lots`, or `input_stock_movements` table.
The entire agrochemical input traceability chain is absent.

---

## 3. Fit-Gap Matrix

| Target Capability | Gap | Effort |
|-------------------|-----|--------|
| **Crop operations** — planning, work orders, planned vs actual | Work orders exist but UX is shallow; no planning wizard; no planned vs actual report | Medium |
| **Input inventory** — seeds/fertilizer/PPP/fuel stock, lot tracking, warehouse | Entirely missing: no warehouses, no input_lots, no stock movements, no supplier table | High |
| **APIA-native GIS** — LPIS block/parcel, area comparison, legal regime overlays | APIA dossier model is complete; GIS polygon display needs LPIS WFS layer overlay | Medium |
| **Machine/fleet/fuel** — registry, implements, operators, fuel, maintenance, work logs | Exists and reasonably complete; gaps: telematics integration, cost-per-hour reporting | Low |
| **Harvest/logistics/sales** — harvest lots, storage, dispatch, customer sales | `harvest_lots` exists; no storage movements, no dispatch/delivery orders, no customer sales ledger | High |
| **Manager financial dashboards** — cost/ha, cost/crop, margins, KPIs | Zero: no cost aggregation, no margin view, no budget vs actual | High |
| **e-Factura** | Complete ✅ | Done |
| **e-Transport** | Entirely missing | High |
| **SAF-T / D406** | Entirely missing | High |
| **REGES** (labor/employees) | Entirely missing | Medium |
| **Fitosanitar / authorizations** | Fitosanitar real; authorizations missing | Low |
| **Parcel unification** | Two systems diverging | Medium |

---

## 4. Recommended Target Architecture

### 4.1 Domain Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAND & CONTRACTS        │  PRODUCTION                              │
│  lessors, contracts,     │  campaigns, crop_plans, work_orders,     │
│  parcels (unified),      │  work_order_inputs, harvest_lots,        │
│  payments                │  (new) input_lots, warehouses, stock_mvt │
├─────────────────────────────────────────────────────────────────────┤
│  FLEET                   │  SALES & LOGISTICS                       │
│  machines, implements,   │  (new) customers, sales_orders,          │
│  operators, fuel_logs,   │  delivery_notes, storage_movements       │
│  maintenance, work_logs  │                                          │
├─────────────────────────────────────────────────────────────────────┤
│  FINANCE                 │  COMPLIANCE                              │
│  rent_payments,          │  e-Factura, APIA dossiers, D112,         │
│  (new) cost_entries,     │  fitosanitar, (future) e-Transport,      │
│  invoices, (split)       │  SAF-T, REGES, authorizations            │
│  transactions → split    │                                          │
├─────────────────────────────────────────────────────────────────────┤
│  INTELLIGENCE                                                        │
│  farm dashboard (NDVI, weather), cost analytics, campaign reports   │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Parcel Unification Model

The single canonical parcel entity should be:

```
parcels (enhanced)
├── id, user_id, bloc_fizic, tarla_nr, parcel_nr, nr_cadastral
├── county, siruta_code, locality
├── surface, surface_rented (legal area)
├── lessor_id, contract_id
├── land_use_category, apia_eligible
├── lat, lng (centroid — kept for map display + weather APIs)
└── geometry_geojson  ← migrate from parcele_fitosanitar
    (nullable — filled when farmer draws/imports GIS boundary)

parcele_fitosanitar → becomes a VIEW or is merged into parcels
```

The `parcela_id` FK on `parcele_fitosanitar` already points the right direction.
Migration: copy `geometry_geojson`, `centru_lat`, `centru_lng` columns onto `parcels`;
create a compatibility view `parcele_fitosanitar` for the phytosanitary module.

### 4.3 Transaction Table Split

```
transactions (current overloaded table)
   ↓ decompose into:

rent_deliveries             — kg/product delivered per lessor × contract
  id, user_id, contract_id, lessor_id, campaign_year
  transaction_date, product_name
  kg_brut, kg_net, price_per_unit
  ron_brut, ron_net, tax_amount
  payment_type, pv_number, is_previzionata, impozit_aplicat
  invoice_id, notes

sales_orders (new domain)   — commodity sales to external customers
  id, user_id, customer_id, campaign_id
  sale_date, product_name, quantity_t, price_per_t, total_ron
  invoice_id, notes
```

### 4.4 New Tables Needed (Priority Order)

**Phase 1 — Input Inventory (highest value)**
```sql
suppliers           id, user_id, name, cui, address, phone, email, notes
input_categories    id, name, type (SEED|FERTILIZER|PPP|FUEL|OTHER)
input_lots          id, user_id, supplier_id, category_id, product_name,
                    unit, quantity, unit_price, batch_number, expiry_date,
                    received_date, invoice_ref, notes
warehouses          id, user_id, name, location, notes
input_stock_mvt     id, user_id, lot_id, warehouse_id, work_order_id,
                    parcel_id, campaign_id, mvt_type (IN|OUT|TRANSFER),
                    quantity, mvt_date, notes
```

**Phase 2 — Cost Analytics**
```sql
cost_entries        id, user_id, campaign_id, parcel_id, category
                    (RENT|SEED|FERTILIZER|PPP|FUEL|LABOR|MACHINERY|OTHER),
                    amount_ron, cost_date, reference_id, reference_type, notes
-- Populated by triggers/functions: from rent_deliveries, work_order_inputs,
-- fuel_logs (when linked to campaign), maintenance_tasks
```

**Phase 3 — Sales & Logistics**
```sql
customers           id, user_id, name, cui, address, phone, email
storage_locations   id, user_id, name, type (BARN|SILO|EXTERNAL), capacity_t
harvest_movements   id, user_id, harvest_lot_id, from_location_id,
                    to_location_id, quantity_t, mvt_date, notes
sales_orders        id, user_id, customer_id, campaign_id, product_name,
                    quantity_t, price_per_t, sale_date, delivery_date,
                    status, invoice_id, notes
```

**Phase 4 — Extended Compliance**
```sql
transport_documents (e-Transport: NIF, UIT, goods, routes)
authorizations      (certifications, licences, expiry alerts)
```

---

## 5. Entity / Domain Model Changes

### 5.1 Immediate (No Breaking Changes)

1. **Add missing TypeScript types** for existing DB entities:
   - `WorkOrder`, `WorkOrderInput`, `HarvestLot` in `lib/campaign-types.ts`
   - Proper `Transaction` type split in `lib/supabase/db.ts`

2. **Remove `mockStore.ts` from bundle** — verify zero live imports, then delete or
   tree-shake by moving to a `__tests__/fixtures/` folder.

3. **Add `geometry_geojson`, `centru_lat`, `centru_lng` columns to `parcels`** table
   (nullable) so the GIS system can converge. Keep `parcele_fitosanitar` table alive
   as a compatibility shim until all usages migrate.

### 5.2 Medium-term (Non-breaking additions)

4. Add `suppliers`, `input_categories`, `input_lots`, `warehouses`, `input_stock_mvt`
   tables (new domain, no existing table affected).

5. Add `cost_entries` table. Populate via application logic on insert of:
   - `rent_deliveries` → RENT cost entry
   - `work_order_inputs` (when linked to `input_lots`) → SEED/FERT/PPP entries
   - `fuel_logs` (when `campaign_id` is set) → FUEL entries

6. Add `customers`, `storage_locations`, `harvest_movements`, `sales_orders`.

### 5.3 Long-term (Requires migration planning)

7. **Split `transactions` table**: rename to `rent_deliveries`, add new `sales_orders`
   table. Update all 18 query callsites. Add a DB view `transactions` for backwards
   compatibility during transition.

8. **Unify parcel GIS**: copy geometry columns onto `parcels`, update
   `parcele_fitosanitar` callsites in fitosanitar/APIA modules.

---

## 6. Integration Roadmap — 4 Phases

### Phase 1 — Foundations (2-3 weeks)
*Goal: fill type gaps, clean up smells, add inventory domain*

| Task | File(s) | Priority |
|------|---------|----------|
| Add `WorkOrder`, `WorkOrderInput`, `HarvestLot` TS types | `lib/campaign-types.ts` | P0 |
| Add `Supplier`, `InputLot`, `Warehouse`, `StockMovement` types | `lib/inventory-types.ts` (new) | P0 |
| DB migration: suppliers + input_lots + warehouses + stock_mvt | `supabase/migrations/20260610_inventory.sql` | P0 |
| `/inventar` route: supplier list, input lot registry, stock overview | `app/(app)/inventar/` | P1 |
| Wire `work_order_inputs` to input lots (consumption tracking) | `app/(app)/campanie/[year]/activitati/page.tsx` | P1 |
| Fix type casts in campanie pages (remove `as any[]`) | campaign pages | P2 |
| Move `mockStore.ts` to test fixtures | `lib/mockStore.ts` | P2 |

### Phase 2 — Cost Analytics (2-3 weeks)
*Goal: cost per ha, cost per crop, campaign P&L*

| Task | File(s) | Priority |
|------|---------|----------|
| DB migration: `cost_entries` table + insert triggers | `20260620_cost_entries.sql` | P0 |
| Cost aggregation API route | `app/api/cost-analytics/route.ts` | P0 |
| Campaign cost dashboard tab | `app/(app)/campanie/[year]/costuri/page.tsx` | P1 |
| Parcel cost breakdown (cost/ha overlay on farm dashboard) | `app/(app)/ferma/page.tsx` (extend) | P1 |
| Manager summary dashboard: total cost, revenue, margin by campaign | `app/(app)/dashboard/page.tsx` (extend) | P2 |

### Phase 3 — Harvest / Sales / Logistics (3-4 weeks)
*Goal: full grain-to-invoice traceability*

| Task | File(s) | Priority |
|------|---------|----------|
| DB migration: customers + storage_locations + harvest_movements + sales_orders | `20260701_sales.sql` | P0 |
| `/vanzari` route: customer list, sales order CRUD, invoice link | `app/(app)/vanzari/` | P1 |
| `/depozit` route: storage locations, movement log, stock by product | `app/(app)/depozit/` | P1 |
| Harvest lot → storage → sales pipeline UI | extend campanie stocuri page | P1 |
| e-Factura: extend to cover sales invoices (not just rent deliveries) | `lib/efactura/mapper.ts` | P2 |

### Phase 4 — Extended Compliance & Parcel Unification (ongoing)
*Goal: e-Transport, SAF-T skeleton, unified parcel GIS*

| Task | Priority |
|------|----------|
| Parcel GIS unification migration | P1 |
| e-Transport document generation (RO UIT integration) | P1 |
| Authorizations/certifications tracking module | P2 |
| SAF-T D406 export (XML generator, similar to e-Factura approach) | P2 |
| REGES labor cost linkage (work_orders → operator hours → cost_entries) | P3 |
| Telematics device integration (live machine GPS/hours sync) | P3 |

---

## 7. Concrete Refactor / Integration Plan

### 7.1 Start: Add Missing TypeScript Types (Zero-risk)

Extend `lib/campaign-types.ts` with the DB entities already queried in pages but typed as `any`:

```typescript
// Add to campaign-types.ts

export interface WorkOrder {
  id: string
  user_id: string
  campaign_id: string
  parcel_id: string | null
  title: string
  operation_type: string
  planned_date: string | null
  completed_date: string | null
  machine_id: string | null
  operator_id: string | null
  area_ha: number | null
  status: 'PLANIFICAT' | 'IN_EXECUTIE' | 'FINALIZAT' | 'ANULAT'
  notes: string | null
  created_at: string
}

export interface WorkOrderInput {
  id: string
  user_id: string
  work_order_id: string
  product_name: string
  unit: string
  planned_qty: number | null
  actual_qty: number | null
  lot_id: string | null        // FK → input_lots (Phase 1)
  cost_per_unit: number | null
  notes: string | null
}

export interface HarvestLot {
  id: string
  user_id: string
  campaign_id: string
  parcel_id: string
  harvest_date: string | null
  crop: string
  yield_t_ha: number | null
  total_yield_t: number | null
  moisture_pct: number | null
  storage_location: string | null
  notes: string | null
  created_at: string
}
```

### 7.2 New Inventory Domain (`lib/inventory-types.ts`)

```typescript
export type InputCategory = 'SEED' | 'FERTILIZER' | 'PPP' | 'FUEL' | 'OTHER'
export type StockMovementType = 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT'

export interface Supplier {
  id: string
  user_id: string
  name: string
  cui: string | null
  address: string | null
  phone: string | null
  email: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface InputLot {
  id: string
  user_id: string
  supplier_id: string | null
  category: InputCategory
  product_name: string
  unit: string               // kg, L, t, buc
  quantity: number           // received quantity
  quantity_available: number // current stock (updated by stock_mvt)
  unit_price: number | null
  batch_number: string | null
  expiry_date: string | null
  received_date: string
  invoice_ref: string | null
  notes: string | null
  created_at: string
}

export interface Warehouse {
  id: string
  user_id: string
  name: string
  location: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface StockMovement {
  id: string
  user_id: string
  lot_id: string
  warehouse_id: string | null
  work_order_id: string | null
  parcel_id: string | null
  campaign_id: string | null
  mvt_type: StockMovementType
  quantity: number
  mvt_date: string
  notes: string | null
  created_at: string
}
```

### 7.3 DB Migration Template (Phase 1)

File: `supabase/migrations/20260610_inventory.sql`

```sql
-- ── Suppliers ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  cui           TEXT,
  address       TEXT,
  phone         TEXT,
  email         TEXT,
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_owner" ON suppliers USING (user_id = auth.uid());

-- ── Input lots ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS input_lots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id        UUID REFERENCES suppliers(id),
  category           TEXT NOT NULL CHECK (category IN ('SEED','FERTILIZER','PPP','FUEL','OTHER')),
  product_name       TEXT NOT NULL,
  unit               TEXT NOT NULL DEFAULT 'kg',
  quantity           NUMERIC(12,3) NOT NULL,
  quantity_available NUMERIC(12,3) NOT NULL,
  unit_price         NUMERIC(10,4),
  batch_number       TEXT,
  expiry_date        DATE,
  received_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_ref        TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE input_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "input_lots_owner" ON input_lots USING (user_id = auth.uid());

-- ── Warehouses ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  location    TEXT,
  notes       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warehouses_owner" ON warehouses USING (user_id = auth.uid());

-- ── Stock movements ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS input_stock_mvt (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lot_id          UUID NOT NULL REFERENCES input_lots(id) ON DELETE CASCADE,
  warehouse_id    UUID REFERENCES warehouses(id),
  work_order_id   UUID,        -- soft FK (no cascade) to work_orders
  parcel_id       UUID,        -- soft FK to parcels
  campaign_id     UUID,        -- soft FK to campaigns
  mvt_type        TEXT NOT NULL CHECK (mvt_type IN ('IN','OUT','TRANSFER','ADJUSTMENT')),
  quantity        NUMERIC(12,3) NOT NULL,
  mvt_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE input_stock_mvt ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_mvt_owner" ON input_stock_mvt USING (user_id = auth.uid());

-- ── Trigger: keep input_lots.quantity_available in sync ───────────────────────
CREATE OR REPLACE FUNCTION update_lot_quantity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.mvt_type IN ('IN', 'ADJUSTMENT') THEN
    UPDATE input_lots SET quantity_available = quantity_available + NEW.quantity
    WHERE id = NEW.lot_id;
  ELSIF NEW.mvt_type = 'OUT' THEN
    UPDATE input_lots SET quantity_available = quantity_available - NEW.quantity
    WHERE id = NEW.lot_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_lot_qty ON input_stock_mvt;
CREATE TRIGGER trg_update_lot_qty
  AFTER INSERT ON input_stock_mvt
  FOR EACH ROW EXECUTE FUNCTION update_lot_quantity();
```

### 7.4 Sidebar Navigation Addition

Add `INVENTAR` section to `AppSidebar.tsx`:

```
INVENTAR
├── Furnizori          /inventar/furnizori
├── Loturi intrati     /inventar/loturi
├── Stoc curent        /inventar/stoc
└── Miscari stoc       /inventar/miscari
```

---

## 8. Start Integrating — Immediate Actions

The highest-ROI first step is **Phase 1, Task 1**: add missing TypeScript types + create the
inventory migration. This touches zero existing functionality, de-risks all `as any[]`
patterns, and unblocks all subsequent inventory, cost, and sales work.

**Action sequence:**

1. **Now**: Extend `lib/campaign-types.ts` with `WorkOrder`, `WorkOrderInput`, `HarvestLot`
2. **Now**: Create `lib/inventory-types.ts` with `Supplier`, `InputLot`, `Warehouse`, `StockMovement`
3. **Now**: Create `supabase/migrations/20260610_inventory.sql` (template in §7.3)
4. **Next**: Build `/inventar` route (supplier list + lot registry + stock overview)
5. **Next**: Wire `work_order_inputs` display in the activitati page to show actual inputs consumed per operation
6. **Then**: Add `cost_entries` table and start populating it from rent deliveries + fuel logs

**Signal to measure success**: When `/campanie/[year]` can show a "Cost/ha" figure next to
each crop plan entry, Phase 1 + Phase 2 are complete.

---

*Generated by principal architect review — ArendaPro v0.11 → v1.0 roadmap*
