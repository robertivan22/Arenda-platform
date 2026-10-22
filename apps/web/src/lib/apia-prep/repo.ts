"use client";
// Acces la date pentru „Pregătire dosar APIA” (Supabase, RLS). Reutilizează tabelele existente.
import { createClient } from "@/lib/supabase/client";
import type { Role } from "@/components/apia/data";
import type { Prep, Sources, SnapshotPayload } from "./engine";

export interface Scope { userId: string; userEmail: string; ownerId: string; farmRole: string; role: Role; farmName: string }
export interface DossierRow {
  id: string; campaign_year: number; lifecycle: string; version: number; applicant_overrides: Record<string, string>; livestock_applicable: boolean;
  exploitation_code: string | null; livestock: Array<{ species: string; count: number; note?: string }>; bnd_confirmed_on: string | null; sign_method: string | null;
  submitted_on: string | null; request_number: string | null; apia_center: string | null; submission_proof_path: string | null; submission_note: string | null;
  verification_ran_at: string | null;
}
export interface SnapshotRow { id: string; version: number; payload: SnapshotPayload; created_at: string; created_by: string | null }
export interface ChangeRow {
  id: string; form_type: string; status: string; reason: string | null; parcel_ids: string[]; changed_summary: string | null; doc_names: string[];
  sent_on: string | null; proof_note: string | null; created_at: string;
}
export interface AuditRow { id: string; action: string; notes: string | null; created_at: string; actor_id: string | null }

const sb = () => createClient();
const must = <T,>(r: { data: T | null; error: { message: string } | null }, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return (r.data ?? ([] as unknown as T));
};
export const toAppRole = (farmRole: string): Role =>
  farmRole === "proprietar" || farmRole === "administrator" ? "admin" : farmRole === "contabil" ? "contabil" : farmRole === "operator" ? "colaborator" : "vizualizare";

function cookie(name: string): string | null {
  const m = document.cookie.split("; ").find(c => c.startsWith(name + "="));
  return m ? decodeURIComponent(m.split("=")[1]) : null;
}

export async function getScope(): Promise<Scope> {
  const db = sb();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Sesiune expirată. Autentifică-te din nou.");
  const active = cookie("arenda_active_farm");
  let ownerId = user.id; let farmRole = "proprietar";
  if (active && active !== user.id) {
    const { data } = await db.from("farm_members").select("role").eq("farm_owner_id", active).eq("member_id", user.id).eq("status", "active").maybeSingle();
    if (data) { ownerId = active; farmRole = (data as { role: string }).role; }
  }
  const { data: cs } = await db.from("company_settings").select("name").eq("user_id", ownerId).maybeSingle();
  return { userId: user.id, userEmail: user.email ?? "", ownerId, farmRole, role: toAppRole(farmRole), farmName: (cs as { name: string | null } | null)?.name ?? "Exploatația mea" };
}

export async function updateCompany(scope: Scope, patch: Record<string, string>) {
  const { error } = await sb().from("company_settings").update(patch).eq("user_id", scope.ownerId);
  if (error) throw new Error(error.message);
}

export async function loadSources(scope: Scope, year: number): Promise<Sources> {
  const db = sb(); const o = scope.ownerId;
  const camp = must(await db.from("campaigns").select("id").eq("user_id", o).eq("year", year), "campanii") as Array<{ id: string }>;
  const cids = camp.map(c => c.id);
  const [parcels, contracts, cdocs, company, catalog] = await Promise.all([
    db.from("parcels").select("id, bloc_fizic, tarla_nr, parcel_nr, nr_cadastral, county, locality, surface, surface_rented, status, culture, contract_id, lessor_id").eq("user_id", o).limit(5000),
    db.from("contracts").select("id, contract_number, contract_type, start_date, end_date, status, lessors(first_name, last_name, company_name)").eq("user_id", o).limit(5000),
    db.from("contract_documents").select("id, contract_id, original_file_name, title, active_storage_path, storage_path, created_at").eq("user_id", o).limit(10000),
    db.from("company_settings").select("name, cif, reg_com, address, county, locality, iban, bank_name, phone, email").eq("user_id", o).maybeSingle(),
    db.from("apia_interventions").select("code, name, category, subcategory, description, rule_version, config, year_from, year_to").eq("is_active", true).order("sort_order"),
  ]);
  const cat = (must(catalog, "catalog intervenții") as Array<{ year_from: number | null; year_to: number | null }>).filter(c => (c.year_from ?? 0) <= year && (c.year_to ?? 9999) >= year);
  let cropPlans: unknown[] = []; let workOrders: unknown[] = [];
  if (cids.length) {
    const [cp, wo] = await Promise.all([
      db.from("crop_plans").select("parcel_id, crop, planned_area_ha").eq("user_id", o).in("campaign_id", cids).limit(5000),
      db.from("work_orders").select("id, parcel_id, operation_type, title, status, completed_date, planned_date, area_ha, work_order_inputs(id, product_name, unit, actual_qty, planned_qty)").eq("user_id", o).in("campaign_id", cids).limit(5000),
    ]);
    cropPlans = must(cp, "planuri cultură"); workOrders = must(wo, "lucrări");
  }
  const tr = await db.from("registru_fitosanitar").select("id, data_tratament, cultura, nr_parcela, nr_bloc_fizic, denumire_produs, cantitate_utilizata, unitate_cantitate, suprafata_tratata, nume_prenume_responsabil, numar_document")
    .eq("user_id", o).eq("is_deleted", false).gte("data_tratament", `${year}-01-01`).lte("data_tratament", `${year}-12-31`).limit(10000);
  return {
    parcels: must(parcels, "parcele") as Sources["parcels"], contracts: must(contracts, "contracte") as unknown as Sources["contracts"], contractDocs: must(cdocs, "documente contracte") as Sources["contractDocs"],
    cropPlans: cropPlans as Sources["cropPlans"], workOrders: workOrders as unknown as Sources["workOrders"], treatments: must(tr, "registru fitosanitar") as Sources["treatments"],
    company: (company.data as Sources["company"]) ?? null, catalog: cat as unknown as Sources["catalog"], campaignExists: cids.length > 0,
  };
}

export async function getDossier(scope: Scope, year: number): Promise<DossierRow | null> {
  const { data, error } = await sb().from("apia_prep_dossiers").select("*").eq("user_id", scope.ownerId).eq("campaign_year", year).maybeSingle();
  if (error) throw new Error(`dosar: ${error.message}`);
  return (data as DossierRow | null) ?? null;
}

export async function createDossier(scope: Scope, year: number): Promise<DossierRow> {
  const { data, error } = await sb().from("apia_prep_dossiers").insert({ user_id: scope.ownerId, campaign_year: year }).select("*").single();
  if (error) throw new Error(`creare dosar: ${error.message}`);
  await audit(scope, (data as DossierRow).id, "DOSSIER_CREATED", "dossier", (data as DossierRow).id, null, { year }, `Dosar creat pentru campania ${year}`);
  return data as DossierRow;
}

export async function loadPrep(dossierId: string): Promise<{ prep: Omit<Prep, "livestockApplicable" | "bndConfirmedOn">; snapshots: SnapshotRow[]; changes: ChangeRow[]; audit: AuditRow[] }> {
  const db = sb();
  const [p, i, n, d, c, s, ch, a] = await Promise.all([
    db.from("apia_prep_parcels").select("parcel_id, included, prepared_area, prepared_crop, review_status, notes").eq("dossier_id", dossierId),
    db.from("apia_prep_interventions").select("intervention_code, status, parcel_ids, notes").eq("dossier_id", dossierId),
    db.from("apia_prep_notebook_rows").select("*").eq("dossier_id", dossierId),
    db.from("apia_prep_documents").select("*").eq("dossier_id", dossierId).order("created_at", { ascending: false }),
    db.from("apia_prep_confirmations").select("kind, entity_key").eq("dossier_id", dossierId),
    db.from("apia_prep_snapshots").select("id, version, payload, created_at, created_by").eq("dossier_id", dossierId).order("version"),
    db.from("apia_prep_changes").select("*").eq("dossier_id", dossierId).order("created_at", { ascending: false }),
    db.from("apia_audit_log").select("id, action, notes, created_at, actor_id").eq("prep_dossier_id", dossierId).order("created_at", { ascending: false }).limit(30),
  ]);
  return {
    prep: {
      parcels: must(p, "parcele dosar") as Prep["parcels"], interventions: must(i, "intervenții dosar") as Prep["interventions"], nbRows: must(n, "caiete") as Prep["nbRows"],
      docs: must(d, "documente dosar") as Prep["docs"], confirmations: must(c, "confirmări") as Prep["confirmations"],
    },
    snapshots: must(s, "snapshot-uri") as SnapshotRow[], changes: must(ch, "modificări") as ChangeRow[], audit: must(a, "jurnal") as AuditRow[],
  };
}

export async function audit(scope: Scope, dossierId: string, action: string, entityType: string, entityId: string | null, oldV: unknown, newV: unknown, notes: string) {
  // Tabelul apia_audit_log există deja; coloanele noi (prep_dossier_id, actor_id) sunt adăugate de migrare.
  const { error } = await sb().from("apia_audit_log").insert({
    user_id: scope.ownerId, prep_dossier_id: dossierId, actor_id: scope.userId, action, entity_type: entityType, entity_id: entityId, old_value: oldV, new_value: newV, notes,
  });
  if (error) console.warn("audit:", error.message);
}

const upd = async (table: string, patch: Record<string, unknown>, match: Record<string, unknown>) => {
  let q = sb().from(table).update(patch); for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const { error } = await q; if (error) throw new Error(error.message);
};

export const patchDossier = (id: string, patch: Record<string, unknown>) => upd("apia_prep_dossiers", patch, { id });

export async function upsertPrepParcel(scope: Scope, dossierId: string, parcelId: string, patch: Record<string, unknown>) {
  const { error } = await sb().from("apia_prep_parcels").upsert({ user_id: scope.ownerId, dossier_id: dossierId, parcel_id: parcelId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "dossier_id,parcel_id" });
  if (error) throw new Error(error.message);
}
export async function upsertIntervention(scope: Scope, dossierId: string, code: string, patch: Record<string, unknown>) {
  const { error } = await sb().from("apia_prep_interventions").upsert({ user_id: scope.ownerId, dossier_id: dossierId, intervention_code: code, ...patch }, { onConflict: "dossier_id,intervention_code" });
  if (error) throw new Error(error.message);
}
export async function upsertNbRow(scope: Scope, dossierId: string, row: Record<string, unknown>) {
  const { error } = await sb().from("apia_prep_notebook_rows").upsert({ user_id: scope.ownerId, dossier_id: dossierId, ...row }, { onConflict: "dossier_id,intervention_code,source_type,source_id" });
  if (error) throw new Error(error.message);
}
export async function insertNbManual(scope: Scope, dossierId: string, row: Record<string, unknown>) {
  const { error } = await sb().from("apia_prep_notebook_rows").insert({ user_id: scope.ownerId, dossier_id: dossierId, source_type: "MANUAL", inclusion_status: "ACCEPTED", ...row });
  if (error) throw new Error(error.message);
}
export async function setConfirmation(scope: Scope, dossierId: string, kind: string, key: string, note?: string) {
  const { error } = await sb().from("apia_prep_confirmations").upsert({ user_id: scope.ownerId, dossier_id: dossierId, kind, entity_key: key, note: note ?? null, confirmed_by: scope.userId, confirmed_at: new Date().toISOString() }, { onConflict: "dossier_id,kind,entity_key" });
  if (error) throw new Error(error.message);
}

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export async function uploadDocument(scope: Scope, dossierId: string, file: File, meta: { category: string; name?: string; section: string; parcelId?: string | null; contractId?: string | null; interventionCode?: string | null; expiry?: string | null; replacesId?: string | null; version?: number }) {
  if (file.size > MAX_BYTES) throw new Error("Fișierul depășește 15 MB.");
  if (!ALLOWED.includes(file.type)) throw new Error("Sunt acceptate doar PDF, JPG, PNG sau WebP.");
  const db = sb();
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `apia-prep/${scope.ownerId}/${dossierId}/${crypto.randomUUID()}.${ext}`;
  const up = await db.storage.from("documents").upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw new Error(`încărcare: ${up.error.message}`);
  const { data, error } = await db.from("apia_prep_documents").insert({
    user_id: scope.ownerId, dossier_id: dossierId, category: meta.category, name: meta.name || file.name.replace(/\.[^.]+$/, ""), storage_path: path, file_name: file.name, mime_type: file.type,
    size_bytes: file.size, section: meta.section, parcel_id: meta.parcelId ?? null, contract_id: meta.contractId ?? null, intervention_code: meta.interventionCode ?? null, expiry: meta.expiry ?? null,
    replaces_id: meta.replacesId ?? null, version: meta.version ?? 1,
  }).select("id").single();
  if (error) { await db.storage.from("documents").remove([path]); throw new Error(error.message); }
  if (meta.replacesId) await upd("apia_prep_documents", { status: "REPLACED" }, { id: meta.replacesId });
  return (data as { id: string }).id;
}
export async function signedUrl(path: string): Promise<string | null> {
  const { data } = await sb().storage.from("documents").createSignedUrl(path, 120);
  return data?.signedUrl ?? null;
}

export async function recordSubmission(scope: Scope, dossier: DossierRow, s: { date: string; number: string; center: string; sign: string; note: string }, payload: SnapshotPayload, proof?: File) {
  const db = sb();
  let proofPath: string | null = null;
  if (proof) {
    if (proof.size > MAX_BYTES || !ALLOWED.includes(proof.type)) throw new Error("Dovada trebuie să fie PDF/imagine, maximum 15 MB.");
    proofPath = `apia-prep/${scope.ownerId}/${dossier.id}/proof-${crypto.randomUUID()}.${(proof.name.split(".").pop() ?? "bin").replace(/[^a-z0-9]/gi, "")}`;
    const up = await db.storage.from("documents").upload(proofPath, proof, { contentType: proof.type });
    if (up.error) throw new Error(up.error.message);
  }
  const version = dossier.version;
  const ins = await db.from("apia_prep_snapshots").insert({ user_id: scope.ownerId, dossier_id: dossier.id, version, payload });
  if (ins.error) throw new Error(`snapshot: ${ins.error.message}`);
  await upd("apia_prep_dossiers", { lifecycle: "SUBMISSION_RECORDED", submitted_on: s.date, request_number: s.number, apia_center: s.center, sign_method: s.sign, submission_note: s.note, submission_proof_path: proofPath, version: version + 1 }, { id: dossier.id });
  await audit(scope, dossier.id, "SUBMISSION_RECORDED", "dossier", dossier.id, null, { number: s.number, date: s.date, version }, "Depunere înregistrată de utilizator (nu este confirmare APIA)");
}

export async function saveChange(scope: Scope, dossierId: string, row: Record<string, unknown>, id?: string) {
  const db = sb();
  if (id) { await upd("apia_prep_changes", { ...row, updated_at: new Date().toISOString() }, { id }); return id; }
  const { data, error } = await db.from("apia_prep_changes").insert({ user_id: scope.ownerId, dossier_id: dossierId, ...row }).select("id").single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}
