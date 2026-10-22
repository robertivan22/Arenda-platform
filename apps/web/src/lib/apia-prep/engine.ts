// Motor determinist pentru „Pregătire dosar APIA”.
// Funcții pure: transformă datele existente ArendaPro în modelul de afișare și rulează verificările.
// Rezultatul exprimă doar nivel de completare a informațiilor — nu eligibilitate, aprobare sau validare.
import type {
  Activity, DocStatus, HubDoc, Intervention, Notebook, Parcel, Sev, UsageDoc, UStatus, Warning,
} from "../../components/apia/data";

export const RULE_VERSION = "2026.1";
export const EXPIRY_WARN_DAYS = 90;
export const AREA_TOLERANCE_HA = 0.0001;

// ── Rânduri sursă (coloane existente în Supabase) ────────────────────────────
export interface SrcParcel {
  id: string; bloc_fizic: string | null; tarla_nr: string | null; parcel_nr: string | null; nr_cadastral: string | null;
  county: string | null; locality: string | null; surface: number | null; surface_rented: number | null;
  status: string | null; culture: string | null; contract_id: string | null; lessor_id: string | null;
}
export interface SrcContract {
  id: string; contract_number: string | null; contract_type: string | null; start_date: string | null; end_date: string | null;
  status: string | null; lessors?: { first_name: string | null; last_name: string | null; company_name: string | null } | null;
}
export interface SrcContractDoc { id: string; contract_id: string | null; original_file_name: string | null; title: string | null; active_storage_path: string | null; storage_path: string | null; created_at: string | null }
export interface SrcCropPlan { parcel_id: string | null; crop: string | null; planned_area_ha: number | null }
export interface SrcInput { id: string; product_name: string | null; unit: string | null; actual_qty: number | null; planned_qty: number | null }
export interface SrcWorkOrder {
  id: string; parcel_id: string | null; operation_type: string | null; title?: string | null; status: string | null; completed_date: string | null;
  planned_date: string | null; area_ha: number | null; operators?: { name: string | null } | null; work_order_inputs?: SrcInput[] | null;
}
export interface SrcTreatment {
  id: string; data_tratament: string | null; cultura: string | null; nr_parcela: string | null; nr_bloc_fizic: string | null;
  denumire_produs: string | null; cantitate_utilizata: number | null; unitate_cantitate: string | null; suprafata_tratata: number | null;
  nume_prenume_responsabil: string | null; numar_document: string | null;
}
export interface SrcCompany { name: string | null; cif: string | null; reg_com: string | null; address: string | null; county: string | null; locality: string | null; iban: string | null; bank_name: string | null; phone: string | null; email: string | null }
export interface SrcCatalog { code: string; name: string; category: string; subcategory: string | null; description: string | null; rule_version: string | null; config: Record<string, unknown> | null }

// ── Stare salvată pentru dosar ───────────────────────────────────────────────
export interface PrepParcel { parcel_id: string; included: boolean; prepared_area: number | null; prepared_crop: string | null; review_status: "PENDING" | "NEEDS_REVIEW" | "CONFIRMED"; notes: string | null }
export interface PrepIntervention { intervention_code: string; status: string; parcel_ids: string[]; notes: string | null }
export interface PrepNbRow {
  id: string; intervention_code: string; source_type: "WORK_ORDER_INPUT" | "FITOSANITAR" | "MANUAL"; source_id: string | null; source_version: string | null;
  parcel_id: string | null; activity_date: string | null; culture: string | null; activity: string | null; area_ha: number | null; input_name: string | null;
  qty: number | null; unit: string | null; doc_name: string | null; operator_name: string | null; note: string | null;
  inclusion_status: "SUGGESTED" | "ACCEPTED" | "NEEDS_REVIEW" | "EXCLUDED" | "SOURCE_CHANGED";
}
export interface PrepDoc {
  id: string; category: string; name: string; storage_path: string | null; file_name: string | null; section: string; parcel_id: string | null; contract_id: string | null;
  intervention_code: string | null; expiry: string | null; status: string; version: number; note: string | null; archived: boolean; created_at: string;
}
export interface PrepConfirmation { kind: string; entity_key: string }
export interface Sources {
  parcels: SrcParcel[]; contracts: SrcContract[]; contractDocs: SrcContractDoc[]; cropPlans: SrcCropPlan[];
  workOrders: SrcWorkOrder[]; treatments: SrcTreatment[]; company: SrcCompany | null; catalog: SrcCatalog[]; campaignExists: boolean;
}
export interface Prep {
  parcels: PrepParcel[]; interventions: PrepIntervention[]; nbRows: PrepNbRow[]; docs: PrepDoc[]; confirmations: PrepConfirmation[];
  livestockApplicable: boolean; bndConfirmedOn: string | null;
}

// ── Utilitare ────────────────────────────────────────────────────────────────
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const sameArea = (a: number, b: number) => Math.abs(a - b) <= AREA_TOLERANCE_HA;
export const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
export function hashOf(parts: Array<string | number | null | undefined>): string {
  const s = parts.map(p => (p === null || p === undefined ? "" : String(p))).join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}
const ownerName = (c: SrcContract) => {
  const l = c.lessors; if (!l) return "—";
  return l.company_name?.trim() || [l.last_name, l.first_name].filter(Boolean).join(" ") || "—";
};
export function usageTypeOf(contractType: string | null): string {
  const t = norm(contractType);
  if (t.includes("arend")) return "Contract de arendă";
  if (t.includes("conces")) return "Contract de concesiune";
  if (t.includes("inchir") || t.includes("închir")) return "Contract de închiriere";
  if (t.includes("comodat")) return "Contract de comodat";
  if (t.includes("proprie") || t.includes("vanz") || t.includes("vânz") || t.includes("cump")) return "Document de proprietate";
  return "Alt document";
}
export function usageStatus(type: string, end: string | null, hasFile: boolean, today: string): UStatus {
  if (!hasFile) return "u_fisier";
  if (end) {
    if (end < today) return "u_expirat";
    if (daysBetween(today, end) <= EXPIRY_WARN_DAYS) return "u_curand";
  } else if (type !== "Document de proprietate") return "u_incomplet";
  return "u_valabil";
}
const U2D: Record<UStatus, DocStatus> = { u_valabil: "doc_disponibil", u_curand: "doc_aproape", u_expirat: "doc_expirat", u_fisier: "doc_lipsa", u_incomplet: "doc_verificare", u_verificare: "doc_verificare" };

// ── Model de afișare ─────────────────────────────────────────────────────────
export interface View {
  year: number; parcels: Parcel[]; usage: UsageDoc[]; docs: HubDoc[]; ivs: Intervention[]; notebooks: Notebook[];
  plannedSkipped: number; sourceHash: string; unmatchedTreatments: number;
}

export function parcelCode(i: number) { return `P${String(i + 1).padStart(2, "0")}`; }

export function buildView(src: Sources, prep: Prep, year: number, today: string): View {
  const prepById = new Map(prep.parcels.map(p => [p.parcel_id, p]));
  const crops = new Map<string, string>();
  for (const c of src.cropPlans) if (c.parcel_id && c.crop) crops.set(c.parcel_id, c.crop);
  const sorted = src.parcels.filter(p => norm(p.status) !== "inactive" && norm(p.status) !== "inactiv").slice().sort((a, b) =>
    (a.bloc_fizic ?? "").localeCompare(b.bloc_fizic ?? "", "ro", { numeric: true }) || (a.tarla_nr ?? "").localeCompare(b.tarla_nr ?? "", "ro", { numeric: true }) ||
    (a.parcel_nr ?? "").localeCompare(b.parcel_nr ?? "", "ro", { numeric: true }) || a.id.localeCompare(b.id));
  const hasContractDoc = new Set(src.contractDocs.filter(d => d.contract_id && (d.active_storage_path || d.storage_path)).map(d => d.contract_id as string));
  const prepContractDoc = new Set(prep.docs.filter(d => !d.archived && d.storage_path && d.contract_id).map(d => d.contract_id as string));
  const prepParcelDoc = new Set(prep.docs.filter(d => !d.archived && d.storage_path && d.section === "usage" && d.parcel_id).map(d => d.parcel_id as string));

  const parcels: Parcel[] = sorted.map((p, i) => {
    const pp = prepById.get(p.id);
    const areaApp = Number(p.surface ?? 0);
    const areaDoc = p.contract_id && p.surface_rented !== null && p.surface_rented !== undefined ? Number(p.surface_rented) : null;
    const declared = pp?.prepared_area ?? (areaDoc !== null && sameArea(areaDoc, areaApp) ? areaApp : null);
    return {
      id: p.id, code: parcelCode(i), bloc: p.bloc_fizic ?? "—",
      name: [p.tarla_nr ? `Tarla ${p.tarla_nr}` : "", p.parcel_nr ? `Parcela ${p.parcel_nr}` : ""].filter(Boolean).join(" / ") || (p.nr_cadastral ? `Cad. ${p.nr_cadastral}` : p.id.slice(0, 8)),
      uat: p.locality ?? p.county ?? "—", culture: pp?.prepared_crop ?? crops.get(p.id) ?? p.culture ?? "",
      areaApp, areaDoc, declared, excluded: pp ? !pp.included : false, flagged: pp?.review_status === "NEEDS_REVIEW",
      verified: pp?.review_status === "CONFIRMED", interventions: [], contractId: p.contract_id, note: pp?.notes ?? "",
    };
  });
  const codeById = new Map(parcels.map(p => [p.id, p.code]));

  // Documente de utilizare, câte unul per contract folosit
  const byContract = new Map<string, Parcel[]>();
  for (const p of parcels) if (p.contractId) byContract.set(p.contractId, [...(byContract.get(p.contractId) ?? []), p]);
  const usage: UsageDoc[] = [];
  const docs: HubDoc[] = [];
  for (const c of src.contracts) {
    const ps = byContract.get(c.id); if (!ps?.length) continue;
    const cd = src.contractDocs.filter(d => d.contract_id === c.id).sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0];
    const extra = prep.docs.filter(d => !d.archived && d.contract_id === c.id && d.storage_path).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const fileName = extra?.file_name ?? cd?.original_file_name ?? cd?.title ?? null;
    const hasFile = hasContractDoc.has(c.id) || prepContractDoc.has(c.id);
    const type = usageTypeOf(c.contract_type);
    const st = usageStatus(type, c.end_date, hasFile, today);
    const id = `uc-${c.id}`;
    usage.push({ id, type, number: c.contract_number ?? "fără număr", owner: ownerName(c), parcels: ps.map(p => p.code), start: c.start_date, end: c.end_date, file: hasFile ? (fileName ?? "document atașat") : null, status: st, hubId: id, contractId: c.id, filePath: extra?.storage_path ?? cd?.active_storage_path ?? cd?.storage_path ?? null });
    docs.push({ id, name: `${type} ${c.contract_number ?? ""}`.trim(), cat: "Contracte", status: U2D[st], file: hasFile ? (fileName ?? "document atașat") : null, version: 1, expiry: c.end_date, note: "", parcel: "", interv: "", owner: ownerName(c), usageId: id, archived: false, date: (cd?.created_at ?? "").slice(0, 10), section: "usage", source: "contract", storagePath: extra?.storage_path ?? cd?.active_storage_path ?? cd?.storage_path ?? null });
  }
  const noContract = parcels.filter(p => !p.contractId);
  if (noContract.length) {
    const covered = noContract.filter(p => prepParcelDoc.has(p.id));
    usage.push({ id: "u-none", type: "Alt document", number: "Fără contract asociat în ArendaPro", owner: "—", parcels: noContract.map(p => p.code), start: null, end: null, file: covered.length === noContract.length ? "document atașat" : null, status: covered.length === noContract.length ? "u_verificare" : "u_fisier", hubId: "u-none" });
  }

  // Documente încărcate în dosar
  const mapSection = (s: string) => (["usage", "bank", "cultures", "interventions", "notebooks", "applicant", "documents"].includes(s) ? s : "documents") as HubDoc["section"];
  for (const d of prep.docs) {
    docs.push({ id: d.id, name: d.name, cat: d.category, status: d.status === "REPLACED" ? "doc_inlocuit" : d.expiry && d.expiry < today ? "doc_expirat" : d.expiry && daysBetween(today, d.expiry) <= EXPIRY_WARN_DAYS ? "doc_aproape" : d.status === "MISSING" ? "doc_lipsa" : d.status === "NEEDS_REVIEW" ? "doc_verificare" : "doc_disponibil", file: d.file_name, version: d.version, expiry: d.expiry, note: d.note ?? "", parcel: d.parcel_id ? codeById.get(d.parcel_id) ?? "" : "", interv: d.intervention_code ?? "", owner: "", usageId: "", archived: d.archived, date: d.created_at.slice(0, 10), section: mapSection(d.section), source: "dosar", storagePath: d.storage_path });
  }
  if (!docs.some(d => d.cat === "Bancă" && !d.archived && d.status !== "doc_lipsa")) {
    docs.push({ id: "req-bank", name: "Document bancar (confirmare IBAN)", cat: "Bancă", status: "doc_lipsa", file: null, version: 1, expiry: null, note: "", parcel: "", interv: "", owner: "", usageId: "", archived: false, date: "", section: "bank", source: "cerut", storagePath: null });
  }

  // Intervenții
  const selected = new Map(prep.interventions.map(i => [i.intervention_code, i]));
  const ivs: Intervention[] = src.catalog.map(c => {
    const cfg = (c.config ?? {}) as Record<string, unknown>;
    const sel = selected.get(c.code);
    const isSel = !!sel && sel.status !== "NOT_SELECTED" && sel.status !== "NOT_APPLICABLE";
    const cat: Intervention["cat"] = c.category === "DIRECT" ? "Plăți directe" : c.category === "ECO_SCHEMA" ? "Eco-scheme" : c.category === "ANT" ? (c.subcategory === "Zootehnic" ? "Sprijin cuplat zootehnic" : "Sprijin cuplat vegetal") : c.category === "DR" ? "Intervenții de dezvoltare rurală" : "Ajutoare tranzitorii";
    const nb = cfg.notebook === true;
    const zoo = cat === "Sprijin cuplat zootehnic";
    return {
      code: c.code, name: c.name, cat, desc: c.description ?? "", cultures: null,
      reqDocs: [{ label: "Documente de utilizare a terenului", ok: true }, ...(nb ? [{ label: "Caiet de evidențe", ok: false }] : [])],
      notebook: nb ? `nb-${c.code}` : undefined, rel: [],
      checks: [{ kind: "matematic", text: "Suprafețele parcelelor asociate se compară cu documentele." }, { kind: "administrativ", text: "Condițiile și pragurile se verifică în ghidul oficial al campaniei." }],
      selected: isSel, note: sel?.notes ?? "", ruleVersion: c.rule_version ?? RULE_VERSION, configNote: String(cfg.config_note ?? "Catalog ArendaPro; verifică ghidul oficial al campaniei."),
      parcelIds: sel?.parcel_ids ?? [], needsParcels: cat !== "Plăți directe" && !zoo,
    };
  });

  // Caiete: sugestii din lucrări + registrul fitosanitar
  const included = parcels.filter(p => !p.excluded);
  const nbs: Notebook[] = [];
  let plannedSkipped = 0; let unmatched = 0;
  for (const iv of ivs) {
    if (!iv.selected || !iv.notebook) continue;
    const scope = new Set((iv.parcelIds?.length ? iv.parcelIds : included.map(p => p.id)));
    const sources = iv.code === "ECO-M6" ? ["FITOSANITAR"] : ["WORK_ORDER_INPUT", "FITOSANITAR"];
    const stored = new Map(prep.nbRows.filter(r => r.intervention_code === iv.code).map(r => [`${r.source_type}:${r.source_id ?? r.id}`, r]));
    const entries: Activity[] = []; const suggestions: Activity[] = [];
    const push = (key: string, a: Omit<Activity, "id" | "status" | "dbId">) => {
      const s = stored.get(key);
      let status: Activity["status"] = "SUGGESTED"; let dbId: string | null = null;
      if (s) { dbId = s.id; status = s.inclusion_status; if (s.source_version && a.sourceVersion && s.source_version !== a.sourceVersion && (status === "ACCEPTED" || status === "EXCLUDED")) status = "SOURCE_CHANGED"; }
      const row: Activity = { ...a, id: dbId ?? key, status, dbId };
      (status === "ACCEPTED" ? entries : suggestions).push(row);
      stored.delete(key);
    };
    if (sources.includes("WORK_ORDER_INPUT")) {
      for (const wo of src.workOrders) {
        if (!wo.parcel_id || !scope.has(wo.parcel_id)) continue;
        const inputs = wo.work_order_inputs ?? [];
        if (wo.status !== "FINALIZAT") { if (wo.status !== "ANULAT" && inputs.length) plannedSkipped += inputs.length; continue; }
        for (const inp of inputs) {
          const issues: string[] = [];
          if (inp.actual_qty === null || inp.actual_qty === undefined) issues.push("Cantitate realizată lipsă");
          if (!inp.unit) issues.push("Unitate lipsă");
          const par = parcels.find(p => p.id === wo.parcel_id);
          push(`WORK_ORDER_INPUT:${inp.id}`, {
            date: wo.completed_date ?? wo.planned_date ?? "", parcel: par?.code ?? "", parcelId: wo.parcel_id, culture: par?.culture ?? "", activity: wo.title || wo.operation_type || "Lucrare",
            area: Number(wo.area_ha ?? par?.areaApp ?? 0), input: inp.product_name ?? "", qty: inp.actual_qty === null || inp.actual_qty === undefined ? "" : `${inp.actual_qty} ${inp.unit ?? ""}`.trim(),
            qtyNum: inp.actual_qty, unit: inp.unit ?? "", doc: "", by: wo.operators?.name ?? "", note: "", sourceType: "WORK_ORDER_INPUT", sourceId: inp.id,
            sourceVersion: hashOf([wo.status, wo.completed_date, wo.area_ha, wo.parcel_id, inp.product_name, inp.actual_qty, inp.unit]), issues, interv: iv.code,
          });
        }
      }
    }
    if (sources.includes("FITOSANITAR")) {
      for (const t of src.treatments) {
        const cands = included.filter(p => norm(p.bloc) === norm(t.nr_bloc_fizic) && p.name.toLowerCase().includes(`parcela ${norm(t.nr_parcela)}`));
        const par = cands.length === 1 ? cands[0] : null;
        if (par && !scope.has(par.id)) continue;
        const issues: string[] = [];
        if (!par) { issues.push("Parcela nu a putut fi asociată automat"); unmatched++; }
        if (t.cantitate_utilizata === null || t.cantitate_utilizata === undefined) issues.push("Cantitate lipsă");
        if (!t.unitate_cantitate) issues.push("Unitate lipsă");
        push(`FITOSANITAR:${t.id}`, {
          date: t.data_tratament ?? "", parcel: par?.code ?? "", parcelId: par?.id ?? null, culture: t.cultura ?? par?.culture ?? "", activity: "Tratament fitosanitar",
          area: Number(t.suprafata_tratata ?? 0), input: t.denumire_produs ?? "", qty: t.cantitate_utilizata === null || t.cantitate_utilizata === undefined ? "" : `${t.cantitate_utilizata} ${t.unitate_cantitate ?? ""}`.trim(),
          qtyNum: t.cantitate_utilizata, unit: t.unitate_cantitate ?? "", doc: t.numar_document ?? "", by: t.nume_prenume_responsabil ?? "", note: "", sourceType: "FITOSANITAR", sourceId: t.id,
          sourceVersion: hashOf([t.data_tratament, t.denumire_produs, t.cantitate_utilizata, t.unitate_cantitate, t.suprafata_tratata, t.nr_parcela, t.nr_bloc_fizic]), issues, interv: iv.code,
        });
      }
    }
    // Rânduri manuale / a căror sursă nu mai există în listă
    for (const [, r] of stored) {
      const par = parcels.find(p => p.id === r.parcel_id);
      const a: Activity = {
        id: r.id, dbId: r.id, date: r.activity_date ?? "", parcel: par?.code ?? "", parcelId: r.parcel_id, culture: r.culture ?? "", activity: r.activity ?? "", area: Number(r.area_ha ?? 0),
        input: r.input_name ?? "", qty: r.qty === null ? "" : `${r.qty} ${r.unit ?? ""}`.trim(), qtyNum: r.qty, unit: r.unit ?? "", doc: r.doc_name ?? "", by: r.operator_name ?? "", note: r.note ?? "",
        sourceType: r.source_type, sourceId: r.source_id, sourceVersion: r.source_version, status: r.inclusion_status, issues: [], interv: iv.code,
      };
      (a.status === "ACCEPTED" ? entries : suggestions).push(a);
    }
    const target = Math.max(1, entries.length + suggestions.filter(s => s.status !== "EXCLUDED").length);
    nbs.push({
      id: iv.notebook, interv: iv.code, name: `Caiet ${iv.code}`, target, suggestions,
      confirmed: prep.confirmations.some(c => c.kind === "NOTEBOOK_COMPLETE" && c.entity_key === iv.code),
      entries, history: [],
    } as Notebook & { suggestions: Activity[] });
  }
  const sourceHash = hashOf([
    ...parcels.map(p => `${p.id}:${p.areaApp}:${p.declared}:${p.culture}:${p.excluded}`),
    ...usage.map(u => `${u.id}:${u.end}:${u.file}`), ...ivs.filter(i => i.selected).map(i => i.code),
  ]);
  return { year, parcels, usage, docs, ivs, notebooks: nbs, plannedSkipped, sourceHash, unmatchedTreatments: unmatched };
}

// ── Verificări ───────────────────────────────────────────────────────────────
export interface VerifyCtx {
  view: View; company: SrcCompany | null; applicantOverrides: Record<string, string>; livestockApplicable: boolean;
  bndConfirmed: boolean; confirmations: Set<string>; today: string;
}
export function verify(ctx: VerifyCtx): Warning[] {
  const { view, confirmations: conf } = ctx;
  const out: Warning[] = [];
  const add = (code: string, entity: string, sev: Sev, kind: Warning["kind"], title: string, desc: string, section: Warning["section"], parcels?: string[], zooOnly?: boolean) => {
    const id = `${code}:${entity}`;
    out.push({ id, code, sev, kind, title, desc, section, parcels, resolved: sev !== "critic" && conf.has(id), zooOnly, ruleVersion: RULE_VERSION });
  };
  const co = { ...(ctx.company ?? {}), ...ctx.applicantOverrides } as Record<string, string | null | undefined>;
  if (!co.name || !co.cif) add("APPLICANT_INCOMPLETE", "-", "critic", "administrativ", "Datele solicitantului sunt incomplete.", "Completează denumirea și CUI-ul în Setări companie sau în această secțiune.", "applicant");
  if (!co.iban) add("BANK_NO_IBAN", "-", "critic", "administrativ", "Lipsește IBAN-ul solicitantului.", "Completează contul bancar în secțiunea Cont bancar.", "bank");
  const bankDoc = view.docs.find(d => d.cat === "Bancă" && !d.archived);
  if (!bankDoc || bankDoc.status === "doc_lipsa") add("BANK_NO_DOC", "-", "critic", "administrativ", "Lipsește documentul bancar.", "Încarcă documentul care confirmă contul bancar al solicitantului.", "bank");

  const active = view.parcels.filter(p => !p.excluded);
  for (const p of active) {
    if (!(p.areaApp > 0)) add("PARCEL_NO_AREA", p.id, "critic", "matematic", `Parcela ${p.code} nu are suprafață.`, "Completează suprafața în modulul Parcele.", "parcels", [p.code]);
    if (!p.culture) add("PARCEL_NO_CROP", p.id, "verificare", "administrativ", `Parcela ${p.code} nu are cultură.`, "Alege cultura pregătită pentru această campanie.", "cultures", [p.code]);
    if (p.areaDoc !== null && !sameArea(p.areaApp, p.areaDoc) && !p.verified) {
      add("AREA_DIFF", p.id, "verificare", "matematic", `Suprafețele diferă pentru ${p.code}.`, `ArendaPro: ${p.areaApp.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} ha. Document: ${p.areaDoc.toLocaleString("ro-RO", { minimumFractionDigits: 2 })} ha. Verifică documentele și delimitarea parcelei.`, "parcels", [p.code]);
    }
    if (p.declared !== null && p.areaDoc !== null && p.declared > p.areaDoc + AREA_TOLERANCE_HA) {
      add("AREA_EXCEEDS_DOC", p.id, "critic", "matematic", `Suprafața pregătită pentru ${p.code} depășește suprafața din document.`, "Ajustează suprafața pregătită sau adaugă documentul corect.", "parcels", [p.code]);
    }
  }
  for (const u of view.usage) {
    const pcs = u.parcels.filter(c => active.some(p => p.code === c)); if (!pcs.length) continue;
    if (u.id === "u-none") { add("PARCEL_NO_DOC", "-", "critic", "administrativ", `Lipsește documentul de utilizare pentru ${pcs.join(", ")}.`, "Aceste parcele nu sunt asociate unui contract în ArendaPro.", "usage", pcs); continue; }
    if (u.status === "u_fisier") add("DOC_NO_FILE", u.id, "critic", "administrativ", `Lipsește fișierul pentru ${u.type} ${u.number}.`, "Documentul există ca înregistrare, dar nu are fișier atașat.", "usage", pcs);
    if (u.status === "u_expirat") add("DOC_EXPIRED", u.id, "critic", "administrativ", `${u.type} ${u.number} a expirat.`, `Data de expirare: ${u.end}. Încarcă un document nou sau un act adițional.`, "usage", pcs);
    if (u.status === "u_curand") add("DOC_EXPIRING", u.id, "verificare", "administrativ", `${u.type} ${u.number} expiră în curând.`, `Data de expirare: ${u.end}. Confirmă dacă este prelungit.`, "usage", pcs);
    if (u.status === "u_incomplet") add("DOC_INCOMPLETE", u.id, "verificare", "administrativ", `${u.type} ${u.number} nu are dată de expirare.`, "Completează perioada de valabilitate în contract.", "usage", pcs);
  }
  for (const iv of view.ivs.filter(i => i.selected)) {
    if (iv.needsParcels && !iv.parcelIds?.length) add("IV_NO_PARCELS", iv.code, "verificare", "administrativ", `Intervenția ${iv.code} nu are parcele asociate.`, "Alege parcelele pentru care o analizezi.", "interventions");
  }
  for (const nb of view.notebooks) {
    const sug = (nb as Notebook & { suggestions?: Activity[] }).suggestions ?? [];
    if (!nb.entries.length) add("NB_EMPTY", nb.interv, "verificare", "administrativ", `${nb.name} nu are activități acceptate.`, "Acceptă activitățile sugerate din Lucrări și activități sau Registrul fitosanitar, ori adaugă manual.", "notebooks");
    for (const e of nb.entries) if (e.issues?.length) add("NB_ROW_INCOMPLETE", e.id, "verificare", "administrativ", `Activitate incompletă în ${nb.name} (${e.parcel || "fără parcelă"}, ${e.date}).`, e.issues.join(". ") + ".", "notebooks", e.parcel ? [e.parcel] : undefined);
    const changed = [...nb.entries, ...sug].filter(e => e.status === "SOURCE_CHANGED");
    if (changed.length) add("NB_SOURCE_CHANGED", nb.interv, "verificare", "administrativ", `${changed.length} activități din ${nb.name} au fost modificate în sursă după preluare.`, "Revizuiește rândurile marcate și confirmă din nou.", "notebooks");
  }
  if (view.plannedSkipped > 0) add("NB_PLANNED_ONLY", "-", "recomandare", "administrativ", `${view.plannedSkipped} aplicări planificate nu sunt incluse în caiete.`, "Doar activitățile realizate (finalizate) pot fi propuse. Finalizează lucrările după execuție.", "notebooks");
  if (ctx.livestockApplicable && !ctx.bndConfirmed) add("BND_UNCONFIRMED", "-", "verificare", "administrativ", "Confirmă actualizarea datelor din BND.", "Nu avem o confirmare înregistrată pentru efectivele de animale. ArendaPro nu sincronizează automat BND.", "zoo", undefined, true);
  return out;
}

// ── Completare ──────────────────────────────────────────────────────────────
export function completionPercent(statuses: string[]): number {
  const app = statuses.filter(s => s !== "s_na"); if (!app.length) return 0;
  const score = app.reduce((a, s) => a + (s === "s_complet" ? 1 : s === "s_verificare" ? 0.5 : 0), 0);
  return Math.round((100 * score) / app.length);
}

// ── Snapshot și diferențe ───────────────────────────────────────────────────
export interface SnapshotPayload {
  version: number; createdAt: string; campaignYear: number; sourceHash: string; ruleVersion: string;
  parcels: Array<{ id: string; code: string; area: number; declared: number | null; culture: string; included: boolean }>;
  usage: Array<{ id: string; number: string; end: string | null; hasFile: boolean }>;
  interventions: string[]; notebooks: Array<{ interv: string; accepted: number }>; openWarnings: number;
}
export function buildSnapshotPayload(view: View, version: number, openWarnings: number, nowIso: string): SnapshotPayload {
  return {
    version, createdAt: nowIso, campaignYear: view.year, sourceHash: view.sourceHash, ruleVersion: RULE_VERSION,
    parcels: view.parcels.map(p => ({ id: p.id, code: p.code, area: p.areaApp, declared: p.declared, culture: p.culture, included: !p.excluded })),
    usage: view.usage.map(u => ({ id: u.id, number: u.number, end: u.end, hasFile: !!u.file })),
    interventions: view.ivs.filter(i => i.selected).map(i => i.code).sort(),
    notebooks: view.notebooks.map(n => ({ interv: n.interv, accepted: n.entries.length })), openWarnings,
  };
}
export interface DiffItem { kind: "parcelă" | "document" | "intervenție" | "caiet"; key: string; label: string; before: string; after: string }
export function diffSnapshot(prev: SnapshotPayload, next: SnapshotPayload): DiffItem[] {
  const out: DiffItem[] = [];
  const pm = new Map(prev.parcels.map(p => [p.id, p]));
  for (const n of next.parcels) {
    const o = pm.get(n.id);
    if (!o) { out.push({ kind: "parcelă", key: n.id, label: n.code, before: "—", after: "adăugată" }); continue; }
    if (!sameArea(o.area, n.area)) out.push({ kind: "parcelă", key: n.id, label: `${n.code} suprafață`, before: String(o.area), after: String(n.area) });
    if (o.culture !== n.culture) out.push({ kind: "parcelă", key: n.id, label: `${n.code} cultură`, before: o.culture || "—", after: n.culture || "—" });
    if (o.included !== n.included) out.push({ kind: "parcelă", key: n.id, label: `${n.code} inclusă`, before: o.included ? "da" : "nu", after: n.included ? "da" : "nu" });
    pm.delete(n.id);
  }
  for (const o of pm.values()) out.push({ kind: "parcelă", key: o.id, label: o.code, before: "prezentă", after: "eliminată" });
  const um = new Map(prev.usage.map(u => [u.id, u]));
  for (const n of next.usage) {
    const o = um.get(n.id);
    if (!o) out.push({ kind: "document", key: n.id, label: n.number, before: "—", after: "adăugat" });
    else if (o.hasFile !== n.hasFile || o.end !== n.end) out.push({ kind: "document", key: n.id, label: n.number, before: `${o.end ?? "—"} / ${o.hasFile ? "fișier" : "fără fișier"}`, after: `${n.end ?? "—"} / ${n.hasFile ? "fișier" : "fără fișier"}` });
  }
  for (const c of next.interventions.filter(c => !prev.interventions.includes(c))) out.push({ kind: "intervenție", key: c, label: c, before: "neselectată", after: "selectată" });
  for (const c of prev.interventions.filter(c => !next.interventions.includes(c))) out.push({ kind: "intervenție", key: c, label: c, before: "selectată", after: "neselectată" });
  const nm = new Map(prev.notebooks.map(n => [n.interv, n.accepted]));
  for (const n of next.notebooks) { const o = nm.get(n.interv) ?? 0; if (o !== n.accepted) out.push({ kind: "caiet", key: n.interv, label: `Caiet ${n.interv}`, before: `${o} activități`, after: `${n.accepted} activități` }); }
  return out;
}

export const DISCLAIMER = "ArendaPro te ajută să centralizezi și să verifici informațiile necesare. Completarea și depunerea oficială se realizează prin canalele puse la dispoziție de APIA.";
export const FORBIDDEN_TERMS = /\b(eligibil|aprobat|validat apia)\b/i;
