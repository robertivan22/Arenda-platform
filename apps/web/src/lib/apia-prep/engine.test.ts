// Rulare: npx tsx --test src/lib/apia-prep/engine.test.ts
import { test } from "node:test";
import * as assert from "node:assert/strict";
import {
  AREA_TOLERANCE_HA, DISCLAIMER, FORBIDDEN_TERMS, RULE_VERSION, buildSnapshotPayload, buildView, completionPercent, daysBetween, diffSnapshot,
  hashOf, parcelCode, sameArea, usageStatus, usageTypeOf, verify,
  type Prep, type Sources, type SrcParcel,
} from "./engine";

const TODAY = "2026-05-15";
const par = (id: string, over: Partial<SrcParcel> = {}): SrcParcel => ({
  id, bloc_fizic: "1456", tarla_nr: "1", parcel_nr: id, nr_cadastral: null, county: "Călărași", locality: "Lehliu", surface: 8.35, surface_rented: 8.35,
  status: "active", culture: "Grâu de toamnă", contract_id: "c1", lessor_id: null, ...over,
});
const src = (over: Partial<Sources> = {}): Sources => ({
  parcels: [par("a"), par("b", { parcel_nr: "2", surface: 8.4, surface_rented: 8.35 })],
  contracts: [{ id: "c1", contract_number: "12/2024", contract_type: "arenda", start_date: "2024-01-01", end_date: "2030-01-01", status: "active", lessors: { first_name: "Ion", last_name: "Pop", company_name: null } }],
  contractDocs: [{ id: "d1", contract_id: "c1", original_file_name: "c.pdf", title: null, active_storage_path: "x/c.pdf", storage_path: null, created_at: "2024-01-02" }],
  cropPlans: [], workOrders: [], treatments: [],
  company: { name: "Ferma Verde SRL", cif: "RO1", reg_com: null, address: null, county: null, locality: null, iban: "RO12BTRL000", bank_name: "BT", phone: null, email: null },
  catalog: [{ code: "ECO-M1", name: "Eco 1", category: "ECO_SCHEMA", subcategory: null, description: null, rule_version: null, config: { notebook: true } }, { code: "PS1-1", name: "BISS", category: "DIRECT", subcategory: null, description: null, rule_version: null, config: null }],
  campaignExists: true, ...over,
});
const prep = (over: Partial<Prep> = {}): Prep => ({ parcels: [], interventions: [], nbRows: [], docs: [], confirmations: [], livestockApplicable: false, bndConfirmedOn: null, ...over });
const ctx = (s: Sources, p: Prep, o: Partial<Parameters<typeof verify>[0]> = {}) => ({
  view: buildView(s, p, 2026, TODAY), company: s.company, applicantOverrides: {}, livestockApplicable: false, bndConfirmed: false, confirmations: new Set<string>(), today: TODAY, ...o,
});

test("disclaimer și termeni interziși", () => {
  assert.match(DISCLAIMER, /canalele puse la dispoziție de APIA/);
  assert.ok(!FORBIDDEN_TERMS.test(DISCLAIMER));
  assert.ok(FORBIDDEN_TERMS.test("Dosar eligibil"));
});
test("sameArea respectă toleranța", () => {
  assert.ok(sameArea(8.35, 8.35 + AREA_TOLERANCE_HA / 2));
  assert.ok(!sameArea(8.4, 8.35));
});
test("daysBetween", () => assert.equal(daysBetween("2026-05-15", "2026-06-14"), 30));
test("parcelCode", () => { assert.equal(parcelCode(0), "P01"); assert.equal(parcelCode(11), "P12"); });
test("usageTypeOf mapează tipurile de contract", () => {
  assert.equal(usageTypeOf("Arendă"), "Contract de arendă");
  assert.equal(usageTypeOf("concesiune"), "Contract de concesiune");
  assert.equal(usageTypeOf(null), "Alt document");
});
test("usageStatus: fișier, expirat, curând, incomplet, valabil", () => {
  assert.equal(usageStatus("Contract de arendă", "2030-01-01", false, TODAY), "u_fisier");
  assert.equal(usageStatus("Contract de arendă", "2026-01-01", true, TODAY), "u_expirat");
  assert.equal(usageStatus("Contract de arendă", "2026-07-01", true, TODAY), "u_curand");
  assert.equal(usageStatus("Contract de arendă", null, true, TODAY), "u_incomplet");
  assert.equal(usageStatus("Contract de arendă", "2030-01-01", true, TODAY), "u_valabil");
});
test("hashOf este determinist și sensibil la schimbări", () => {
  assert.equal(hashOf(["a", 1]), hashOf(["a", 1]));
  assert.notEqual(hashOf(["a", 1]), hashOf(["a", 2]));
});
test("buildView: coduri P01.. și ordonare", () => {
  const v = buildView(src(), prep(), 2026, TODAY);
  assert.deepEqual(v.parcels.map(p => p.code), ["P01", "P02"]);
});
test("buildView: parcelele inactive sunt excluse", () => {
  const v = buildView(src({ parcels: [par("a"), par("z", { status: "inactive" })] }), prep(), 2026, TODAY);
  assert.equal(v.parcels.length, 1);
});
test("buildView: suprafața din document vine doar cu contract asociat", () => {
  const v = buildView(src({ parcels: [par("a", { contract_id: null })] }), prep(), 2026, TODAY);
  assert.equal(v.parcels[0].areaDoc, null);
  assert.ok(v.usage.some(u => u.id === "u-none"));
});
test("verify: diferență de suprafață 8,40 vs 8,35 => Necesită verificare", () => {
  const w = verify(ctx(src(), prep())).filter(x => x.code === "AREA_DIFF");
  assert.equal(w.length, 1);
  assert.equal(w[0].sev, "verificare");
});
test("verify: diferența dispare după confirmarea parcelei", () => {
  const p = prep({ parcels: [{ parcel_id: "b", included: true, prepared_area: 8.35, prepared_crop: null, review_status: "CONFIRMED", notes: null }] });
  assert.equal(verify(ctx(src(), p)).filter(x => x.code === "AREA_DIFF").length, 0);
});
test("verify: suprafața pregătită peste document este critică", () => {
  const p = prep({ parcels: [{ parcel_id: "a", included: true, prepared_area: 9, prepared_crop: null, review_status: "PENDING", notes: null }] });
  assert.ok(verify(ctx(src(), p)).some(x => x.code === "AREA_EXCEEDS_DOC" && x.sev === "critic"));
});
test("verify: contract expirat și fișier lipsă", () => {
  const s = src({ contracts: [{ ...src().contracts[0], end_date: "2026-01-01" }], contractDocs: [] });
  const codes = verify(ctx(s, prep())).map(x => x.code);
  assert.ok(codes.includes("DOC_NO_FILE") || codes.includes("DOC_EXPIRED"));
});
test("verify: contract care expiră în 90 de zile", () => {
  const s = src({ contracts: [{ ...src().contracts[0], end_date: "2026-06-30" }] });
  assert.ok(verify(ctx(s, prep())).some(x => x.code === "DOC_EXPIRING"));
});
test("verify: lipsă IBAN și document bancar", () => {
  const s = src(); s.company = { ...s.company!, iban: null };
  const codes = verify(ctx(s, prep())).map(x => x.code);
  assert.ok(codes.includes("BANK_NO_IBAN")); assert.ok(codes.includes("BANK_NO_DOC"));
});
test("verify: avertizările non-critice pot fi marcate verificate, cele critice nu", () => {
  const w = verify(ctx(src(), prep(), { confirmations: new Set(["AREA_DIFF:b", "BANK_NO_DOC:-"]) }));
  assert.equal(w.find(x => x.id === "AREA_DIFF:b")?.resolved, true);
  assert.equal(w.find(x => x.id === "BANK_NO_DOC:-")?.resolved, false);
});
test("verify: BND neconfirmat doar pentru zootehnie", () => {
  assert.ok(!verify(ctx(src(), prep())).some(x => x.code === "BND_UNCONFIRMED"));
  assert.ok(verify(ctx(src(), prep(), { livestockApplicable: true })).some(x => x.code === "BND_UNCONFIRMED"));
});
test("verify: textele nu conțin termeni interziși", () => {
  for (const w of verify(ctx(src(), prep()))) assert.ok(!FORBIDDEN_TERMS.test(w.title + " " + w.desc), w.title);
});
test("caiete: doar lucrările FINALIZAT sunt sugerate", () => {
  const s = src({ workOrders: [
    { id: "w1", parcel_id: "a", operation_type: "Fertilizare", status: "FINALIZAT", completed_date: "2026-04-01", planned_date: null, area_ha: 8, work_order_inputs: [{ id: "i1", product_name: "Urea", unit: "kg", actual_qty: 100, planned_qty: 100 }] },
    { id: "w2", parcel_id: "a", operation_type: "Fertilizare", status: "PLANIFICAT", completed_date: null, planned_date: "2026-06-01", area_ha: 8, work_order_inputs: [{ id: "i2", product_name: "Urea", unit: "kg", actual_qty: null, planned_qty: 50 }] },
  ] });
  const v = buildView(s, prep({ interventions: [{ intervention_code: "ECO-M1", status: "SELECTED_FOR_ANALYSIS", parcel_ids: [], notes: null }] }), 2026, TODAY);
  const nb = v.notebooks[0] as typeof v.notebooks[0] & { suggestions: unknown[] };
  assert.equal(nb.suggestions.length, 1);
  assert.equal(nb.entries.length, 0);
  assert.equal(v.plannedSkipped, 1);
});
test("caiete: rândul acceptat intră în caiet; sursă modificată => SOURCE_CHANGED", () => {
  const wo = (qty: number) => ({ id: "w1", parcel_id: "a", operation_type: "Fertilizare", status: "FINALIZAT", completed_date: "2026-04-01", planned_date: null, area_ha: 8, work_order_inputs: [{ id: "i1", product_name: "Urea", unit: "kg", actual_qty: qty, planned_qty: 100 }] });
  const first = buildView(src({ workOrders: [wo(100)] }), prep({ interventions: [{ intervention_code: "ECO-M1", status: "SELECTED_FOR_ANALYSIS", parcel_ids: [], notes: null }] }), 2026, TODAY);
  const sug = (first.notebooks[0] as unknown as { suggestions: { sourceVersion: string }[] }).suggestions[0];
  const row = { id: "r1", intervention_code: "ECO-M1", source_type: "WORK_ORDER_INPUT" as const, source_id: "i1", source_version: sug.sourceVersion, parcel_id: "a", activity_date: "2026-04-01", culture: null, activity: "x", area_ha: 8, input_name: "Urea", qty: 100, unit: "kg", doc_name: null, operator_name: null, note: null, inclusion_status: "ACCEPTED" as const };
  const p = prep({ interventions: [{ intervention_code: "ECO-M1", status: "SELECTED_FOR_ANALYSIS", parcel_ids: [], notes: null }], nbRows: [row] });
  assert.equal(buildView(src({ workOrders: [wo(100)] }), p, 2026, TODAY).notebooks[0].entries.length, 1);
  const changed = buildView(src({ workOrders: [wo(150)] }), p, 2026, TODAY).notebooks[0];
  assert.equal(changed.entries.length, 0);
  assert.equal((changed as unknown as { suggestions: { status: string }[] }).suggestions[0].status, "SOURCE_CHANGED");
});
test("completionPercent", () => {
  assert.equal(completionPercent([]), 0);
  assert.equal(completionPercent(["s_complet", "s_complet", "s_na"]), 100);
  assert.equal(completionPercent(["s_complet", "s_verificare", "s_neinceput", "s_neinceput"]), 38);
});
test("snapshot + diff: modificarea suprafeței apare în diferențe", () => {
  const v1 = buildView(src(), prep(), 2026, TODAY);
  const s1 = buildSnapshotPayload(v1, 1, 0, "2026-05-15T00:00:00Z");
  const v2 = buildView(src({ parcels: [par("a", { surface: 7 }), par("b", { parcel_nr: "2", surface: 8.4, surface_rented: 8.35 })] }), prep(), 2026, TODAY);
  const s2 = buildSnapshotPayload(v2, 2, 0, "2026-05-16T00:00:00Z");
  assert.equal(diffSnapshot(s1, s1).length, 0);
  assert.ok(diffSnapshot(s1, s2).some(d => d.kind === "parcelă"));
  assert.equal(s1.ruleVersion, RULE_VERSION);
});
