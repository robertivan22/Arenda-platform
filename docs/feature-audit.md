# ArendaPro — Feature Audit Funcțional
**Data auditului:** 2026-07-03  
**Metodă:** Scanare completă cod sursă (Next.js App Router, migrări Supabase, rute API, componente UI)  
**Principiu:** Fiecare intrare are o dovadă verificabilă în repo. Nimic neconfirmat în cod nu apare ca funcțional.

---

## Rezumat executive

| Categorie | Număr |
|-----------|-------|
| Module UI complet funcționale | 18 |
| Module parțiale (DB + UI incomplete) | 1 |
| Doar schemă DB (fără UI) | 0 |
| Integrări externe active | 4 (ANAF e-Factura, ANAF e-Transport, Sentinel Hub CDSE, Open-Meteo) |
| Integrări NOT implementate | Stripe, Groq/AI, orice LLM |
| Prețuri/subscripție în cod | ❌ Neconfirmate — lipsesc complet din codebase |
| TODO-uri active | 2 (ambele în FiscalDataStep.tsx — ANAF CUI autocompletare) |

---

## MODULE FUNCȚIONALE

---

### Arendatori (Proprietari de teren)
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/arendatori/` (12 pagini: list, create, edit, sumar, documente, mesaje, istoric, contracte, parcele, imputerniciti, oferte, contact); tabelă `lessors` (supabase-migration-phase1.sql)
- **Ce face concret:** CRUD complet pentru proprietarii de teren (persoane fizice, PFA, entități juridice). Fiecare arendator are profil detaliat cu CNP/CUI, IBAN, adresă, și sub-pagini pentru contractele, parcelele, documentele și istoricul de plăți asociate.
- **Limitări cunoscute:** Câmpul `imputerniciti` (împuterniciți) există ca pagină dar nu a fost identificată logică complexă de delegare.

---

### Contracte de arendă
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/contracte/` (5 pagini: list, create, view, edit, tranzactie); tabele `contracts`, `contract_rent_levels`, `contract_amendments`, `contract_files` (supabase-migration-phase1.sql, supabase-migration-contract-files.sql)
- **Ce face concret:** Gestiune completă a contractelor de arendă — creare cu număr unic, tip plată (CASH/GRAIN/MIXED), date start/end, niveluri de arendă per produs, amendamente, atașare documente (PDF/scan în Supabase Storage `documents`), tranziție de stare (DRAFT → ACTIVE → EXPIRED).
- **Limitări cunoscute:** Nicio integrare cu servicii externe de semnătură electronică.

---

### Parcele agricole
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/parcele/` (4 pagini: list, create, edit, harta); tabele `parcels`, `parcele_fitosanitar` (supabase-migration-parcele.sql, supabase-migration-harta.sql)
- **Ce face concret:** Registru de parcele cu cod parcelă, suprafață (ha), bloc fizic, număr cadastral, coordonate GPS, cultură curentă, legătură la contract și arendator. Suportă coordonate Stereo70 (EPSG:3844) convertite la WGS84.
- **Limitări cunoscute:** Câmpul `siruta_code` există dar lookup-ul SIRUTA este opțional.

---

### Harta Parcele (GIS Editor)
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/parcele/harta/MapParcelSelector.tsx` (~900 linii); `apps/web/src/app/api/wms-proxy/route.ts`; strat ArcGIS: `https://gisapps.madr.ro/arcgis/rest/services/APIA_LPIS_2024/MapServer`
- **Ce face concret:** Editor GIS interactiv bazat pe Leaflet cu strat APIA LPIS 2024 (esri-leaflet DynamicMapLayer). Permite desenare poligoane (leaflet-draw), import GeoJSON/SHP (Stereo70 și WGS84, conversie automată), geocodare inversă Nominatim, salvare geometrie în `parcele_fitosanitar.geometry_geojson`. Proxy WMS intern pentru bypass CORS.
- **Limitări cunoscute:** Stratul ANCPI cadastral folosit condiționat (zoom minim 14+). Stratul APIA LPIS activ de la zoom 12.

---

### Distribuire Arendă
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/distribuire-arenda/page.tsx`; tabele `arenda_conversions`, `parcel_transactions`, `distributions` (supabase-migration-distribuire-arenda.sql, supabase-migration-distributions.sql)
- **Ce face concret:** Motor de calcul pentru distribuirea arenzii în natură sau bani per proprietar și parcelă. Gestionează conversii cereale (kg → RON la prețul pieței), livrări parțiale, cantități rămase de distribuit pe campanie.
- **Limitări cunoscute:** Prețul de referință per kg este introdus manual (nu legat de o piață externă).

---

### Campanie agricolă & Planuri de culturi
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/campanie/` (6 pagini: list, [year], [year]/stocuri, [year]/activitati, stocuri, activitati); tabele `campaigns`, `crop_plans`, `work_orders`, `harvest_lots` (supabase-migration-crop-plans.sql, supabase-migration-work-orders.sql, supabase-migration-harvest-lots.sql)
- **Ce face concret:** Gestiune anuală a campaniei agricole — planuri de cultură per parcelă (cultură, varietate, suprafață planificată, producție estimată t/ha), ordine de lucru per operație (ARAT, DISCUIT, SEMANAT, RECOLTAT, IRIGAT etc.) cu stare și date, loturi de recoltă cu randament real.
- **Limitări cunoscute:** Nu există planificare automată a rotației culturilor.

---

### Stocuri & Inputuri (Inventar)
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/inventar/` (5 pagini: overview, stoc, loturi, furnizori, miscari); tabele `input_lots`, `input_stock_mvt`, `suppliers`, `warehouses` (supabase/migrations/20260610_inventory.sql)
- **Ce face concret:** Urmărire stocuri de semințe, îngrășăminte, produse fitosanitare (PPP) și combustibil. Loturi de intrare cu furnizor, preț unitar, lot batch, dată expirare. Mișcări de stoc IN/OUT/TRANSFER/ADJUSTMENT cu legătură la ordine de lucru și parcele. Alertă la stoc critic (<5% sau epuizat).
- **Limitări cunoscute:** Nu există calcul automat de necesar de inputuri bazat pe planul de cultură.

---

### Activități Câmp (Ordine de lucru)
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/campanie/activitati/page.tsx`, `apps/web/src/app/(app)/campanie/[year]/activitati/page.tsx`; tabelă `work_orders`
- **Ce face concret:** Vizualizare și management al ordinelor de lucru per campanie — filtrare după operație, parcelă, stare. Urmărire parcurgere (PLANIFICAT → IN_EXECUTIE → FINALIZAT).
- **Limitări cunoscute:** Nu există calendar vizual (Gantt/calendar view).

---

### Monitorizare Fermă (Farm Dashboard cu NDVI)
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/ferma/page.tsx`; `apps/web/src/lib/farm-dashboard/sentinel-hub.ts`; `apps/web/src/lib/farm-dashboard/open-meteo.ts`; `apps/web/src/app/api/farm-dashboard/route.ts`
- **Ce face concret:** Tablou de bord operațional cu scor sănătate fermă (0–100%). Per parcelă activă: NDVI curent și anterior (10 zile) din Sentinel-2 L2A via Sentinel Hub CDSE Statistics API, umiditate sol (3 adâncimi), temperatură, precipitații 7 zile, evapotranspirație de referință din Open-Meteo. Alertă automată la scădere NDVI >25%, sol critic (<0.15 vol%), temperaturi de îngheț (<2°C), exces hidric (>0.45 vol%).
- **Limitări cunoscute:** NDVI disponibil doar dacă env vars `SENTINEL_HUB_CLIENT_ID` + `SENTINEL_HUB_CLIENT_SECRET` sunt configurate; fără ele, câmpul NDVI returnează null (graceful fallback). Rezoluție 10 zile (compozit 10-day). Blocaj nori detectat (cloud_block=true) la acoperire >80%.

---

### Alerte Operaționale
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/alerte/page.tsx`; `apps/web/src/app/api/alerte/route.ts`; `apps/web/src/lib/alerte/types.ts` (linia 3: *"100% deterministic, DB-driven. No AI / Groq dependency."*)
- **Ce face concret:** Sistem de alerte complet determinist (zero AI/LLM). 6 tipuri: expirare contracte (praguri 45/7/1 zile), operațiuni agricole restante, stocuri critice/epuizate, documente utilaje expirate (RCA/ITP/service), UIT-uri e-Transport expirate (39 zile), plăți restante (>30 zile neachitate).
- **Limitări cunoscute:** Nu există notificări push sau email — alertele sunt vizibile doar la accesarea paginii. **ATENȚIE la denumire:** Modulul se numește „Alerte AI" în navigare dar NU folosește niciun model AI — denumirea este incorectă față de implementare.

---

### Registru Fitosanitar
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/fitosanitar/page.tsx`; tabele `registru_fitosanitar`, `parcele_fitosanitar` (supabase-migration-fitosanitar.sql, 20250603_parcele_fitosanitar_parcela_link.sql)
- **Ce face concret:** Registru de tratamente fitosanitare conform cerințelor legale. Câmpuri: parcelă GIS, faza BBCH, agent patogen, substanță activă, doză, mod aplicare, condiții meteo (temperatură aplicare, viteză vânt max), echipament utilizat. Legătură la geometria parcelei pentru suprapunere pe hartă.
- **Limitări cunoscute:** Nu există validare automată a substanțelor active față de lista autorizată MADR.

---

### Utilaje & Flotă
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/utilaje/` (5 pagini: list, [id], [id]/transporturi, operatori, implementuri); tabele `machines`, `implements`, `operators`, `fuel_logs`, `maintenance_tasks`, `machine_work_logs` (supabase-migration-machines.sql, supabase-migration-fleet.sql, 20260611_machines_rca.sql)
- **Ce face concret:** Registru complet utilaje agricole și vehicule cu date tehnice (brand, model, an, placă, VIN, CP motor), urmărire RCA (dată expirare, stare activă), ITP, service-uri planificate, consum combustibil (log-uri cu litri, cost/litru, odometru), operatori (categorie permis), implementuri, ore lucrate pe parcelă.
- **Limitări cunoscute:** Telematica (tabele `telematics_devices`, `telematics_events`) există în schemă DB dar nu a fost identificată interfață UI activă pentru aceasta.

---

### Dosar APIA (Subvenții)
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/apia/` (2 pagini: list, [id]); tabele `apia_dossiers`, `apia_dossier_parcels`, `apia_interventions`, `apia_dossier_interventions`, `apia_dossier_documents`, `apia_change_requests`, `apia_zootechnical_declarations`, `apia_audit_log` (supabase/migrations/20260609_apia.sql)
- **Ce face concret:** Gestiune dosar APIA pentru subvenții agricole (schema SAPS/eco-scheme). Ciclu de viață complet: DRAFT → CHECKING → READY → SUBMITTED → UNDER_REVIEW → ACCEPTED. Parcele cu cod bloc fizic LPIS, suprafață declarată, cod utilizare teren (AR/PS/FN/LV/VI/AL). 25+ tipuri de intervenții eco (agricultură ecologică, conservarea solului, rotație culturi etc.). Log de audit per dosar.
- **Limitări cunoscute:** Nu există transmitere automată la portalul AGI Online — datele sunt gestionate local și exportate manual.

---

### e-Factura ANAF
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/efactura/page.tsx`; `apps/web/src/app/api/efactura/` (token, submit, status, xml-preview); tabele `efactura_submissions`, `anaf_oauth_tokens`, `invoices` (supabase/migrations/20260609_efactura.sql)
- **Ce face concret:** Generare XML UBL 2.1, autentificare OAuth2 la SPV ANAF (`https://auth.anaf.ro/oauth/authorize`), upload facturi la API ANAF (`https://prod.anaf.ro/FCTEL/rest/upload`), polling status (`/FCTEL/rest/status`), download ZIP semnat. Suportă medii test și producție. Stocare audit trail complet (XML trimis, upload_id, status, motiv respingere).
- **Limitări cunoscute:** Necesită cont SPV ANAF activ al utilizatorului. OAuth tokens stocate per user în `anaf_oauth_tokens`.

---

### e-Transport ANAF (UIT — Declarare transport bunuri)
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/etransport/page.tsx`; `apps/web/src/app/api/etransport/` (declare, cancel, shipments, generate-uit); tabele `etransport_shipments`, `etransport_goods`, `etransport_api_logs`, `etransport_alerts` (supabase/migrations/20260701_etransport_shipments.sql, 20260701_etransport_uit_fields.sql, 20260701_uit_expire_cron.sql)
- **Ce face concret:** Declarare transport bunuri la ANAF e-Transport. Suportă 4 tipuri de operații: național, intracomunitar, import, export. Generare UIT (cod unic 36 caractere, valabilitate 39 zile). Căutare și validare coduri NC/TARIC din tabelă locală de 17.000+ coduri. Log complet API (request/response). Cron job pentru alertă la expirare UIT.
- **Limitări cunoscute:** Necesită autentificare SPV ANAF (aceleași credențiale OAuth ca e-Factura). Codul TARIC trebuie selectat manual.

---

### Declarații fiscale (D112)
- **Status:** Funcțională (Beta)
- **Dovadă:** `apps/web/src/app/(app)/declaratii/d112/page.tsx`; `apps/web/src/app/api/d112/route.ts`; tabelă `d112_settings` (supabase/migrations/20250602_add_d112_settings.sql)
- **Ce face concret:** Generare și gestionare declarație D112 (impozit pe veniturile din arendă). Precompletare din datele de tranzacții existente.
- **Limitări cunoscute:** Marcat intern ca Beta — fluxul de generare/transmitere poate fi incomplet față de specificația ANAF curentă.

---

### Plăți și tranzacții
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/plati/page.tsx`; tabelă `transactions` (supabase-migration-phase1.sql)
- **Ce face concret:** Urmărire plăți arendă per contract, campanie și proprietar. Câmpuri: kg brut/net, preț/unitate, RON net, impozit, stare plată (achitat/neachitat), legătură factură.
- **Limitări cunoscute:** Nu există integrare bancară sau gateway de plată.

---

### Rapoarte
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/rapoarte/page.tsx`
- **Ce face concret:** 8 tab-uri de rapoarte cu agregări: sumar campanie, planuri culturi, recolte, activități câmp, stocuri, utilaje, financiar, APIA. Export XLSX per tab.
- **Limitări cunoscute:** Nu există rapoarte grafice avansate (charts interactive).

---

### Setări cont & firmă
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/(app)/setari/page.tsx`; tabelă `company_settings`
- **Ce face concret:** Configurare date furnizor (CIF, denumire, adresă, IBAN, serie factură), gestionare campanii agricole, configurare produse, setări D112.
- **Limitări cunoscute:** —

---

### Onboarding Wizard (nou — 2026-07-03)
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/onboarding/page.tsx`; `apps/web/src/components/onboarding/` (6 componente); `apps/web/src/app/api/onboarding/` (3 rute); tabelă `onboarding_state` (supabase/migrations/20260703_onboarding.sql)
- **Ce face concret:** Wizard în 5 pași pentru utilizatori noi (tip cont PFA/SRL, date fiscale, import parcele, import contracte, preferințe alerte). Progres salvat server-side după fiecare pas — utilizatorul poate reveni exact de unde a rămas de pe orice dispozitiv. Tur ghidat interactiv (7 pași spotlight) la prima accesare dashboard.
- **Limitări cunoscute:** ANAF CUI autocompletare dezactivată (TODO activ). Migrarea SQL necesită rulare manuală în Supabase Dashboard.

---

### Admin Panel & Impersonare
- **Status:** Funcțională
- **Dovadă:** `apps/web/src/app/admin-cp/page.tsx`; `apps/web/src/app/api/admin/impersonate/` (start, stop, status, extend); tabele `admin_impersonation_sessions`, `admin_impersonation_audit_log` (supabase/migrations/20260702_admin_impersonation.sql)
- **Ce face concret:** Panou admin cu gestiune utilizatori (promovare/revocare admin, permisiuni per modul), vizualizare log-uri impersonare, feature flags pentru module. Impersonare cu sesiune temporizată (1–480 min), buton extindere, banner vizibil, log audit complet al acțiunilor efectuate în sesiunea de impersonare.
- **Limitări cunoscute:** Accesibil doar utilizatorilor cu `profiles.is_admin = true`.

---

## MODULE PARȚIALE

### Telematică vehicule
- **Status:** Parțială — Doar schemă DB
- **Dovadă:** Tabele `telematics_devices`, `telematics_events` în `supabase-migration-fleet.sql` (coloane: `device_id`, `machine_id`, `lat`, `lng`, `speed_kmh`, `fuel_pct`, `engine_on`, `timestamp`). Nicio pagină UI sau API route identificată care să citească/scrie aceste tabele.
- **Ce face concret:** Schema DB permite înregistrarea evenimentelor GPS/telematice de la dispozitive montate pe utilaje. **Nu există interfață utilizator sau integrare cu vreun furnizor de telematică.**
- **Limitări cunoscute:** Feature neimplementat la nivel UI — date de la tabelă nu sunt afișate nicăieri.

---

## INTEGRĂRI EXTERNE CONFIRMATE ÎN COD

### Sentinel Hub CDSE (Copernicus Data Space Ecosystem)
- **Endpoint:** `https://sh.dataspace.copernicus.eu/api/v1/statistics`
- **Auth:** OAuth2 client credentials (`https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token`)
- **Ce face:** Calcul NDVI per parcelă din imagini Sentinel-2 L2A, compozite 10 zile, formule `(B08-B04)/(B08+B04+0.0001)`
- **Fișier:** `apps/web/src/lib/farm-dashboard/sentinel-hub.ts`
- **Env vars necesare:** `SENTINEL_HUB_CLIENT_ID`, `SENTINEL_HUB_CLIENT_SECRET`

### Open-Meteo
- **Endpoint:** `https://api.open-meteo.com/v1/forecast`
- **Auth:** Niciuna (free tier)
- **Ce face:** Temperatură curentă, cod meteo WMO, umiditate sol pe 3 adâncimi, precipitații 7 zile, evapotranspirație de referință
- **Fișier:** `apps/web/src/lib/farm-dashboard/open-meteo.ts`

### ANAF e-Factura SPV
- **Endpoint test:** `https://test.anaf.ro/FCTEL/rest/upload` | `https://test.anaf.ro/FCTEL/rest/status`
- **Endpoint prod:** `https://prod.anaf.ro/FCTEL/rest/upload` | `https://prod.anaf.ro/FCTEL/rest/status`
- **Auth:** OAuth2 (`https://auth.anaf.ro/oauth/authorize`, scope `write:invoice`)
- **Ce face:** Upload XML UBL 2.1, polling status, download ZIP semnat
- **Fișier:** `apps/web/src/lib/efactura/anaf-client.ts`

### ANAF e-Transport
- **Endpoint test:** `https://test.anaf.ro/TRANSPORT/rest/upload` | `/status` | `/cancel`
- **Endpoint prod:** `https://prod.anaf.ro/TRANSPORT/rest/upload` | `/status` | `/cancel`
- **Auth:** OAuth2 SPV ANAF (aceleași credențiale ca e-Factura)
- **Ce face:** Declarare bunuri transportate (UIT), verificare status, anulare
- **Fișier:** `apps/web/src/lib/etransport/anaf-etransport-client.ts`

### APIA LPIS WMS (strat read-only, fără API calls)
- **URL strat:** `https://gisapps.madr.ro/arcgis/rest/services/APIA_LPIS_2024/MapServer` (ArcGIS MapServer)
- **Proxy:** `GET /api/wms-proxy?url=...` (bypass CORS)
- **Ce face:** Afișare vizuală strat LPIS 2024 pe hartă — date citite de browser, nu stocate

---

## INTEGRĂRI ABSENTE DIN COD (confirmat prin căutare)

| Integrare | Status | Notă |
|-----------|--------|------|
| **Stripe** | ❌ Absent complet | Nu există `price_id`, `stripe`, `subscription` nicăieri în codebase |
| **Groq / OpenAI / orice LLM** | ❌ Absent complet | Cod explicit: *"NO Groq. NO AI. NO LLM."* în 3 fișiere |
| **Prețuri / tarife platform** | ❌ Neconfirmate în cod | Nu există plan pricing, tiers sau sume hardcodate |
| **Notificări email/push** | ❌ Absent | Alertele sunt vizibile doar în aplicație, nu trimise extern |
| **Semnătură electronică** | ❌ Absent | Contractele nu sunt semnate electronic în platformă |
| **Integrare bancară** | ❌ Absent | Plățile sunt înregistrate manual |

---

## TODO-URI ACTIVE (cod necomplet)

| Fișier | Linie | Conținut TODO |
|--------|-------|---------------|
| `apps/web/src/components/onboarding/FiscalDataStep.tsx` | 42 | `// TODO: integrate ANAF open-data CUI lookup when endpoint is available` — autocompletare date firmă din CUI dezactivată, înlocuită cu 300ms latency placeholder |
| `apps/web/src/components/onboarding/FiscalDataStep.tsx` | 103 | `// TODO: ANAF autocompletare activă după integrare endpoint lookup` — mesaj UI care confirmă că funcția nu e activă |

---

## NOMENCLATURĂ INCORECTĂ FAȚĂ DE IMPLEMENTARE

| Denumire în UI | Implementare reală |
|----------------|-------------------|
| „Alerte AI" (în sidebar și pagina `/alerte`) | **100% determinist, zero AI** — reguli if/then pe date BD, confirmat explicit în cod (`lib/alerte/types.ts` linia 3) |

---

*Audit realizat prin scanare directă a codului sursă. Nicio funcționalitate nu a fost inferată sau presupusă — toate intrările au cale de fișier verificabilă.*
