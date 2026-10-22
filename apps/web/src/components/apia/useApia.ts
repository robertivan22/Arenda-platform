"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, Activity2, HubDoc, Intervention, MOD_TYPES, Modification, Notebook, Parcel, SectionKey, SECTION_ORDER, UsageDoc, Warning, access,
} from "./data";
import {
  AuditRow, ChangeRow, DossierRow, Scope, SnapshotRow, audit as auditRepo, createDossier as createDossierRepo, getDossier, getScope, insertNbManual, loadPrep, loadSources,
  patchDossier, recordSubmission, saveChange, setConfirmation, signedUrl, updateCompany, uploadDocument, upsertIntervention, upsertNbRow, upsertPrepParcel,
} from "@/lib/apia-prep/repo";
import {
  DiffItem, Prep, Sources, buildSnapshotPayload, buildView, completionPercent, diffSnapshot, verify,
} from "@/lib/apia-prep/engine";

export interface Submission { date: string; number: string; center: string; sign: string; proof: string; note: string; by: string }
export interface ExportRec { id: string; name: string; format: string; time: string }
export type SecStatus = "s_complet" | "s_incomplet" | "s_verificare" | "s_na" | "s_neinceput";

const EMPTY_PREP: Prep = { parcels: [], interventions: [], nbRows: [], docs: [], confirmations: [], livestockApplicable: false, bndConfirmedOn: null };
export const PROFILE_COLS: Record<string, string> = { nume: "name", cui: "cif", adresa: "address", loc: "locality", jud: "county", tel: "phone", mail: "email" };
const MOD_STATUS: Record<string, Modification["status"]> = { DRAFT: "m_draft", PREPARED: "m_pregatita", SENT_RECORDED: "m_transmisa", CANCELLED: "m_anulata" };
const MOD_BACK: Record<string, string> = { m_draft: "DRAFT", m_pregatita: "PREPARED", m_transmisa: "SENT_RECORDED", m_anulata: "CANCELLED" };

export function useApia() {
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => [String(thisYear - 1), String(thisYear), String(thisYear + 1)], [thisYear]);
  const [campaign, setCampaign] = useState(String(thisYear));
  const [section, setSectionRaw] = useState<SectionKey>("overview");
  const [lastSection, setLastSection] = useState<SectionKey>("usage");
  const [scope, setScope] = useState<Scope | null>(null);
  const [src, setSrc] = useState<Sources | null>(null);
  const [dossier, setDossier] = useState<DossierRow | null>(null);
  const [prep, setPrep] = useState<Prep>(EMPTY_PREP);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [changes, setChanges] = useState<ChangeRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportsDone, setExportsDone] = useState<ExportRec[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [openNb, setOpenNb] = useState<string | null>(null);
  const [focusParcel, setFocusParcel] = useState<string | null>(null);
  const seq = useRef(0);

  const today = new Date().toISOString().slice(0, 10);
  const year = Number(campaign);
  const role = scope?.role ?? "vizualizare";

  const notify = useCallback((m: string) => { setToast(m); window.setTimeout(() => setToast(t => (t === m ? null : t)), 3500); }, []);
  const setSection = useCallback((s: SectionKey) => { setSectionRaw(s); if (s !== "overview") setLastSection(s); }, []);

  const loadAll = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true); setError(null);
    try {
      const sc = await getScope();
      const [s, d] = await Promise.all([loadSources(sc, Number(campaign)), getDossier(sc, Number(campaign))]);
      let pr: Prep = EMPTY_PREP; let sn: SnapshotRow[] = []; let ch: ChangeRow[] = []; let au: AuditRow[] = [];
      if (d) {
        const l = await loadPrep(d.id);
        pr = { ...l.prep, livestockApplicable: d.livestock_applicable, bndConfirmedOn: d.bnd_confirmed_on };
        sn = l.snapshots; ch = l.changes; au = l.audit;
      }
      if (my !== seq.current) return;
      setScope(sc); setSrc(s); setDossier(d); setPrep(pr); setSnapshots(sn); setChanges(ch); setAuditRows(au);
    } catch (e) {
      if (my === seq.current) setError(e instanceof Error ? e.message : "Eroare necunoscută");
    } finally { if (my === seq.current) setLoading(false); }
  }, [campaign]);
  useEffect(() => { void loadAll(); }, [loadAll]);

  const refresh = useCallback(async () => {
    if (!scope) return;
    const d = await getDossier(scope, year); setDossier(d);
    if (d) { const l = await loadPrep(d.id); setPrep({ ...l.prep, livestockApplicable: d.livestock_applicable, bndConfirmedOn: d.bnd_confirmed_on }); setSnapshots(l.snapshots); setChanges(l.changes); setAuditRows(l.audit); }
  }, [scope, year]);

  /** Execută o mutație, apoi reîncarcă starea salvată. Erorile (inclusiv RLS) sunt afișate utilizatorului. */
  const run = useCallback(async <T,>(fn: () => Promise<T>, okMsg?: string): Promise<T | undefined> => {
    try { const r = await fn(); await refresh(); if (okMsg) notify(okMsg); return r; }
    catch (e) { notify(`Nu am putut salva: ${e instanceof Error ? e.message : "eroare"}`); return undefined; }
  }, [refresh, notify]);

  const dossierId = dossier?.id ?? null;
  const logEvent = useCallback((text: string, action = "NOTE") => { if (scope && dossierId) void auditRepo(scope, dossierId, action, "dossier", dossierId, null, null, text).then(refresh); }, [scope, dossierId, refresh]);
  const log = useCallback((text: string) => logEvent(text), [logEvent]);

  // ── Model derivat ──────────────────────────────────────────────────────────
  const view = useMemo(() => (src ? buildView(src, prep, year, today) : null), [src, prep, year, today]);
  const confSet = useMemo(() => new Set(prep.confirmations.filter(c => c.kind === "WARNING_REVIEWED").map(c => c.entity_key)), [prep.confirmations]);
  const overrides = dossier?.applicant_overrides ?? {};
  const baseWarnings = useMemo(() => (view ? verify({ view, company: src?.company ?? null, applicantOverrides: overrides, livestockApplicable: prep.livestockApplicable, bndConfirmed: !!prep.bndConfirmedOn, confirmations: confSet, today }) : []), [view, src, overrides, prep.livestockApplicable, prep.bndConfirmedOn, confSet, today]);

  const lastSnap = snapshots.length ? snapshots[snapshots.length - 1] : null;
  const currentPayload = useMemo(() => (view && dossier ? buildSnapshotPayload(view, dossier.version, baseWarnings.filter(w => !w.resolved).length, new Date().toISOString()) : null), [view, dossier, baseWarnings]);
  const diff: DiffItem[] = useMemo(() => (lastSnap && currentPayload ? diffSnapshot(lastSnap.payload, currentPayload) : []), [lastSnap, currentPayload]);
  const allWarnings = useMemo<Warning[]>(() => (diff.length ? [...baseWarnings, { id: "SNAPSHOT_DIFF:-", code: "SNAPSHOT_DIFF", sev: "verificare", kind: "administrativ", title: `Dosarul s-a modificat după depunerea înregistrată (${diff.length} diferențe).`, desc: "Vezi diferențele și pregătește, dacă este cazul, o modificare M1–M4.", section: "modifications", resolved: false }] : baseWarnings), [baseWarnings, diff]);
  const activeWarnings = useMemo(() => allWarnings.filter(w => !w.zooOnly || prep.livestockApplicable), [allWarnings, prep.livestockApplicable]);
  const open = useMemo(() => activeWarnings.filter(w => !w.resolved), [activeWarnings]);
  const count = (sev: Warning["sev"]) => open.filter(w => w.sev === sev).length;

  const parcels: Parcel[] = view?.parcels ?? [];
  const usage: UsageDoc[] = view?.usage ?? [];
  const docs: HubDoc[] = view?.docs ?? [];
  const codeOf = (id: string) => parcels.find(p => p.id === id)?.code ?? "";
  const idOf = (code: string) => parcels.find(p => p.code === code)?.id;

  const ivs: Intervention[] = useMemo(() => {
    if (!view) return [];
    const included = parcels.filter(p => !p.excluded);
    return view.ivs.map(iv => {
      const ids = iv.parcelIds?.length ? iv.parcelIds : iv.needsParcels ? [] : included.map(p => p.id);
      const codes = new Set(ids.map(codeOf));
      const rel = activeWarnings.filter(w => w.sev !== "recomandare" && !w.resolved && (w.parcels?.some(c => codes.has(c)) || w.id.endsWith(`:${iv.code}`) && w.code?.startsWith("NB_"))).map(w => w.id);
      const nb = iv.notebook ? view.notebooks.find(n => n.id === iv.notebook) : null;
      const usageOk = !activeWarnings.some(w => !w.resolved && w.sev === "critic" && w.section === "usage" && w.parcels?.some(c => codes.has(c)));
      const nbOk = !nb || nb.confirmed || (nb.entries.length > 0 && !(nb.suggestions ?? []).some(s => s.status !== "EXCLUDED"));
      return { ...iv, rel, parcelIds: ids, reqDocs: iv.reqDocs.map(d => ({ label: d.label, ok: d.label.startsWith("Caiet") ? nbOk : usageOk })) };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [view, activeWarnings]); // eslint-disable-line react-hooks/exhaustive-deps

  const notebooks: Notebook[] = view?.notebooks ?? [];
  const ivReq = (iv: Intervention) => iv.reqDocs;
  const ivStatus = (iv: Intervention) => {
    if (!iv.selected) return "i_neselectata";
    if (iv.reqDocs.some(d => !d.ok)) return "i_incompleta";
    if (iv.rel.length) return "i_verificare";
    return "i_pregatita";
  };
  const nbStatus = (n: Notebook) => {
    if (n.confirmed) return "n_complet";
    if (open.some(w => w.code?.startsWith("NB_") && w.id.endsWith(`:${n.interv}`) && w.code !== "NB_EMPTY")) return "n_verificare";
    if (n.entries.length === 0) return "n_neinceput";
    if ((n.suggestions ?? []).some(s => s.status !== "EXCLUDED")) return "n_lucru";
    return "n_complet";
  };

  const liveDocs = docs.filter(d => !d.archived && d.status !== "doc_inlocuit");
  const docsMissing = liveDocs.filter(d => d.status === "doc_lipsa" || d.status === "doc_expirat").length;
  const docsOk = liveDocs.filter(d => d.status !== "doc_lipsa" && d.status !== "doc_expirat").length;
  const verifRan = !!dossier?.verification_ran_at;
  const submission: Submission | null = dossier?.submitted_on ? { date: dossier.submitted_on, number: dossier.request_number ?? "", center: dossier.apia_center ?? "", sign: dossier.sign_method ?? "", proof: dossier.submission_proof_path ? "Dovadă încărcată" : "", note: dossier.submission_note ?? "", by: scope?.userEmail ?? "" } : null;
  const inControl = dossier?.lifecycle === "UNDER_REVIEW_USER_CONFIRMED";
  const mods: Modification[] = changes.map(c => ({ id: c.id, code: c.form_type, started: c.created_at.slice(0, 10), reason: c.reason ?? "", parcels: c.parcel_ids.map(codeOf).filter(Boolean), changed: c.changed_summary ?? "", docs: c.doc_names, status: MOD_STATUS[c.status] ?? "m_draft", sentOn: c.sent_on ?? "", proof: c.proof_note ?? "" }));
  const activity: Activity2[] = auditRows.map(r => ({ id: r.id, text: r.notes ?? r.action, time: new Date(r.created_at).toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }), who: r.actor_id === scope?.userId ? "Tu" : "Coleg" }));

  const sectionInfo = (k: SectionKey): { status: SecStatus; issues: number } => {
    const inSec = open.filter(w => w.section === k && w.sev !== "recomandare");
    switch (k) {
      case "overview": return { status: "s_neinceput", issues: 0 };
      case "zoo": return prep.livestockApplicable ? { status: inSec.length ? "s_verificare" : "s_complet", issues: inSec.length } : { status: "s_na", issues: 0 };
      case "documents": return { status: docsMissing ? "s_incomplet" : "s_complet", issues: docsMissing };
      case "interventions": {
        const sel = ivs.filter(i => i.selected);
        if (!sel.length) return { status: "s_neinceput", issues: 0 };
        const st = sel.map(ivStatus); const bad = st.filter(s => s !== "i_pregatita").length;
        return { status: st.includes("i_incompleta") ? "s_incomplet" : bad ? "s_verificare" : "s_complet", issues: bad };
      }
      case "verification": return { status: !verifRan ? "s_neinceput" : count("critic") ? "s_incomplet" : count("verificare") ? "s_verificare" : "s_complet", issues: 0 };
      case "export": return { status: submission ? "s_complet" : exportsDone.length ? "s_incomplet" : "s_neinceput", issues: 0 };
      case "modifications": return { status: !mods.length && !diff.length ? "s_neinceput" : mods.some(m => m.status === "m_draft" || m.status === "m_pregatita") || diff.length ? "s_incomplet" : "s_complet", issues: diff.length };
      case "notebooks": { const act = notebooks; if (!act.length) return { status: "s_na", issues: 0 }; return { status: inSec.length ? "s_verificare" : "s_complet", issues: inSec.length }; }
      default: {
        const crit = inSec.some(w => w.sev === "critic");
        return { status: crit ? "s_incomplet" : inSec.length ? "s_verificare" : "s_complet", issues: inSec.length };
      }
    }
  };
  const prepKeys: SectionKey[] = ["applicant", "bank", "parcels", "usage", "cultures", "interventions", "notebooks", "zoo", "documents"];
  const infos = prepKeys.map(k => ({ k, ...sectionInfo(k) }));
  const applicable = infos.filter(i => i.status !== "s_na");
  const secComplete = applicable.filter(i => i.status === "s_complet").length;
  const secIncomplete = applicable.length - secComplete;
  const percent = completionPercent(infos.map(i => i.status));
  const needsCheck = open.filter(w => w.sev === "verificare").length;
  const nextTarget: Warning | undefined = open.find(w => w.sev === "critic") ?? open.find(w => w.sev === "verificare");

  const dossierStatus = (() => {
    if (!dossier) return "d_neinceput";
    if (submission) {
      if (inControl) return "d_control";
      if (mods.some(m => m.code === "M3" && m.status === "m_transmisa")) return "d_retras";
      if (diff.length || mods.some(m => m.status === "m_draft" || m.status === "m_pregatita")) return "d_modificare";
      return "d_depus";
    }
    if (open.some(w => w.sev === "critic")) return "d_documente";
    if (open.some(w => w.sev === "verificare")) return "d_verificare";
    return infos.every(i => i.status === "s_neinceput") ? "d_pregatire" : "d_pregatit";
  })();

  const can = (k: SectionKey) => access(role, k) === "edit";
  const canSubmit = role === "admin";
  const need = () => { if (!scope || !dossierId) throw new Error("Dosarul nu există încă."); return { sc: scope, id: dossierId }; };

  // ── Acțiuni ────────────────────────────────────────────────────────────────
  const createDossier = () => run(async () => { if (!scope) throw new Error("Fără sesiune"); await createDossierRepo(scope, year); }, `Dosar creat pentru campania ${campaign}.`);

  const resolve = (id: string, why?: string) => run(async () => { const { sc, id: d } = need(); await setConfirmation(sc, d, "WARNING_REVIEWED", id, why); await auditRepo(sc, d, "WARNING_REVIEWED", "warning", null, null, { id }, `Verificare marcată de utilizator: ${activeWarnings.find(w => w.id === id)?.title ?? id}${why ? ` (${why})` : ""}`); });

  const updateParcel = (code: string, patch: Partial<Parcel>) => run(async () => {
    const { sc, id } = need(); const pid = idOf(code); if (!pid) return;
    const row: Record<string, unknown> = {};
    if (patch.flagged !== undefined) row.review_status = patch.flagged ? "NEEDS_REVIEW" : "PENDING";
    if (patch.excluded !== undefined) { row.included = !patch.excluded; if (patch.excluded) row.exclusion_reason = "Exclus de utilizator"; }
    if (patch.culture !== undefined) row.prepared_crop = patch.culture;
    if (patch.note !== undefined) row.notes = patch.note;
    await upsertPrepParcel(sc, id, pid, row);
    await auditRepo(sc, id, "PARCEL_UPDATED", "parcel", pid, null, row, `Parcela ${code} actualizată`);
  });

  const confirmArea = (code: string, value: number, how: string) => run(async () => {
    const { sc, id } = need(); const pid = idOf(code); if (!pid) return;
    const p = parcels.find(x => x.code === code);
    await upsertPrepParcel(sc, id, pid, { prepared_area: value, review_status: "CONFIRMED", confirmed_by: sc.userId, confirmed_at: new Date().toISOString() });
    await auditRepo(sc, id, "AREA_CONFIRMED", "parcel", pid, { areaApp: p?.areaApp, areaDoc: p?.areaDoc }, { prepared: value }, `Suprafața ${code} confirmată de utilizator: ${value} ha (${how})`);
  }, `Suprafața pentru ${code} a fost salvată de tine.`);

  const attach = async (file: File, meta: Parameters<typeof uploadDocument>[3]) => { const { sc, id } = need(); return uploadDocument(sc, id, file, meta); };

  const uploadUsageFile = (usageId: string, file: File) => run(async () => {
    const u = usage.find(x => x.id === usageId); if (!u) return;
    if (u.contractId) await attach(file, { category: "Contracte", name: `${u.type} ${u.number}`, section: "usage", contractId: u.contractId });
    else for (const code of u.parcels) await attach(file, { category: "Terenuri", name: `Document utilizare ${code}`, section: "usage", parcelId: idOf(code) });
    const { sc, id } = need(); await auditRepo(sc, id, "DOCUMENT_ADDED", "document", null, null, { usageId }, `Document încărcat pentru ${u.type} ${u.number}`);
  }, "Document disponibil pentru verificare.");

  const addDoc = (file: File, meta: { cat?: string; name?: string; parcel?: string; interv?: string; section?: string } = {}) => run(async () => {
    const id = await attach(file, { category: meta.cat ?? "Alte documente", name: meta.name, section: meta.section ?? "documents", parcelId: meta.parcel ? idOf(meta.parcel) : null, interventionCode: meta.interv || null });
    const { sc, id: d } = need(); await auditRepo(sc, d, "DOCUMENT_ADDED", "document", id, null, null, `Document încărcat: ${meta.name ?? file.name}`); return id;
  }, "Document disponibil pentru verificare.");

  const uploadBank = (file: File) => addDoc(file, { cat: "Bancă", name: "Document bancar (confirmare IBAN)", section: "bank" });

  const updateDoc = (id: string, patch: Partial<HubDoc>) => run(async () => {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name; if (patch.cat !== undefined) row.category = patch.cat; if (patch.expiry !== undefined) row.expiry = patch.expiry;
    if (patch.note !== undefined) row.note = patch.note; if (patch.interv !== undefined) row.intervention_code = patch.interv || null;
    if (patch.parcel !== undefined) row.parcel_id = patch.parcel ? idOf(patch.parcel) ?? null : null;
    if (patch.archived !== undefined) row.archived = patch.archived;
    if (patch.status !== undefined) row.status = patch.status === "doc_lipsa" ? "MISSING" : patch.status === "doc_verificare" ? "NEEDS_REVIEW" : "AVAILABLE";
    const { createClient } = await import("@/lib/supabase/client");
    const { error } = await createClient().from("apia_prep_documents").update(row).eq("id", id); if (error) throw new Error(error.message);
    const { sc, id: d } = need(); await auditRepo(sc, d, patch.archived ? "DOCUMENT_ARCHIVED" : "DOCUMENT_UPDATED", "document", id, null, row, patch.archived ? "Document arhivat" : "Document actualizat");
  });

  const replaceDoc = (d: HubDoc, file: File) => run(async () => {
    await attach(file, { category: d.cat, name: d.name, section: d.section, parcelId: d.parcel ? idOf(d.parcel) : null, interventionCode: d.interv || null, expiry: d.expiry, replacesId: d.id, version: d.version + 1 });
  }, "Versiune nouă salvată.");

  const openFile = async (path: string | null) => { if (!path) return; const url = await signedUrl(path); if (url) window.open(url, "_blank", "noopener,noreferrer"); else notify("Nu am putut deschide fișierul."); };

  const setZoo = (on: boolean) => run(async () => { const { sc, id } = need(); await patchDossier(id, { livestock_applicable: on }); await auditRepo(sc, id, "LIVESTOCK_TOGGLED", "dossier", id, null, { on }, on ? "Sectorul zootehnic activat" : "Sectorul zootehnic marcat „Nu se aplică”"); });
  const saveZoo = (code: string, livestock: Array<{ species: string; count: number }>) => run(async () => { const { sc, id } = need(); await patchDossier(id, { exploitation_code: code, livestock }); await auditRepo(sc, id, "LIVESTOCK_UPDATED", "dossier", id, null, { code, livestock }, "Date zootehnice actualizate manual"); }, "Date zootehnice salvate.");
  const confirmBnd = (date: string) => run(async () => { const { sc, id } = need(); await patchDossier(id, { bnd_confirmed_on: date }); await auditRepo(sc, id, "BND_CONFIRMED", "dossier", id, null, { date }, `Utilizatorul confirmă verificarea efectivelor în BND la ${date}`); });

  const setVerifRan = (_v: boolean) => run(async () => { const { sc, id } = need(); await patchDossier(id, { verification_ran_at: new Date().toISOString() }); await auditRepo(sc, id, "VERIFICATION_RUN", "dossier", id, null, { open: open.length, percent }, "Verificarea dosarului a fost rulată"); });
  const setSignMethod = (v: string) => run(async () => { const { id } = need(); await patchDossier(id, { sign_method: v }); });
  const signMethod = dossier?.sign_method ?? "";

  const saveApplicant = (changes: Record<string, string>, scopeSel: "profil" | "dosar") => run(async () => {
    const { sc, id } = need();
    const ov = { ...overrides }; const prof: Record<string, string> = {};
    for (const [k, v] of Object.entries(changes)) {
      if (scopeSel === "profil" && PROFILE_COLS[k]) { prof[PROFILE_COLS[k]] = v; delete ov[k]; } else ov[k] = v;
    }
    if (Object.keys(prof).length) await updateCompany(sc, prof);
    await patchDossier(id, { applicant_overrides: ov });
    await auditRepo(sc, id, "APPLICANT_UPDATED", "dossier", id, null, { fields: Object.keys(changes), scope: scopeSel }, `Date solicitant modificate (${Object.keys(changes).join(", ")}) – ${scopeSel === "profil" ? "profil fermă actualizat" : "doar în dosarul APIA"}`);
    if (Object.keys(prof).length) setSrc(s => (s ? { ...s, company: { ...(s.company ?? ({} as NonNullable<Sources["company"]>)), ...prof } as Sources["company"] } : s));
  }, scopeSel === "profil" ? "Datele au fost actualizate și în profilul fermei." : "Datele se aplică doar dosarului APIA.");

  const toggleIv = (code: string) => run(async () => {
    const { sc, id } = need(); const cur = ivs.find(i => i.code === code); const on = !cur?.selected;
    await upsertIntervention(sc, id, code, { status: on ? "SELECTED_FOR_ANALYSIS" : "NOT_SELECTED", rule_version: cur?.ruleVersion, parcel_ids: cur?.parcelIds ?? [] });
    await auditRepo(sc, id, on ? "INTERVENTION_SELECTED" : "INTERVENTION_DESELECTED", "intervention", null, null, { code }, `${on ? "Selectată pentru analiză" : "Eliminată"}: intervenția ${code}`);
  });
  const setIvParcels = (code: string, parcelIds: string[]) => run(async () => { const { sc, id } = need(); await upsertIntervention(sc, id, code, { parcel_ids: parcelIds }); });
  const setIvNote = (code: string, text: string) => run(async () => { const { sc, id } = need(); await upsertIntervention(sc, id, code, { notes: text, status: ivs.find(i => i.code === code)?.selected ? "SELECTED_FOR_ANALYSIS" : "NOT_SELECTED" }); });

  const rowPayload = (nb: Notebook, e: Activity, inclusion: string, reason?: string) => ({
    intervention_code: nb.interv, source_type: e.sourceType ?? "MANUAL", source_id: e.sourceId ?? null, source_version: e.sourceVersion ?? null, parcel_id: e.parcelId ?? null, activity_date: e.date || null,
    culture: e.culture, activity: e.activity, area_ha: e.area, input_name: e.input, qty: e.qtyNum ?? null, unit: e.unit ?? "", doc_name: e.doc, operator_name: e.by, note: e.note,
    inclusion_status: inclusion, override_reason: reason ?? null, confirmed_by: scope?.userId, confirmed_at: new Date().toISOString(),
  });
  const decideRow = (nbId: string, e: Activity, inclusion: "ACCEPTED" | "EXCLUDED" | "NEEDS_REVIEW", reason?: string) => run(async () => {
    const { sc, id } = need(); const nb = notebooks.find(n => n.id === nbId); if (!nb) return;
    await upsertNbRow(sc, id, rowPayload(nb, e, inclusion, reason));
    await auditRepo(sc, id, `NOTEBOOK_ROW_${inclusion}`, "notebook_row", null, null, { source: e.sourceType, sourceId: e.sourceId }, `${nb.name}: ${e.activity} (${e.parcel || "fără parcelă"}) – ${inclusion === "ACCEPTED" ? "acceptat" : inclusion === "EXCLUDED" ? "exclus" : "marcat pentru verificare"}`);
  });
  const addActivity = (nbId: string, a: Omit<Activity, "id">) => run(async () => {
    const { sc, id } = need(); const nb = notebooks.find(n => n.id === nbId); if (!nb) return;
    await insertNbManual(sc, id, { ...rowPayload(nb, { ...a, id: "", sourceType: "MANUAL" }, "ACCEPTED"), source_id: crypto.randomUUID() });
    await auditRepo(sc, id, "NOTEBOOK_ROW_ADDED", "notebook_row", null, null, null, `${nb.name}: activitate adăugată manual (${a.activity}, ${a.parcel})`);
  });
  const confirmNotebook = (nbId: string) => run(async () => { const { sc, id } = need(); const nb = notebooks.find(n => n.id === nbId); if (!nb) return; await setConfirmation(sc, id, "NOTEBOOK_COMPLETE", nb.interv); await auditRepo(sc, id, "NOTEBOOK_CONFIRMED", "notebook", null, null, { interv: nb.interv }, `${nb.name} confirmat de utilizator ca fiind complet`); });

  const addMod = (m: Omit<Modification, "id">) => run(async () => {
    const { sc, id } = need();
    await saveChange(sc, id, { form_type: m.code, status: "DRAFT", reason: m.reason, parcel_ids: m.parcels.map(idOf).filter(Boolean), changed_summary: m.changed, doc_names: m.docs, old_data: lastSnap?.payload ?? null });
    await auditRepo(sc, id, "CHANGE_DRAFTED", "change", null, null, { code: m.code }, `Modificare ${m.code} adăugată ca draft`);
  }, "Modificarea a fost salvată ca draft.");
  const updateMod = (mid: string, patch: Partial<Modification>) => run(async () => {
    const { sc, id } = need(); const row: Record<string, unknown> = {};
    if (patch.status) row.status = MOD_BACK[patch.status]; if (patch.sentOn !== undefined) row.sent_on = patch.sentOn || null; if (patch.proof !== undefined) row.proof_note = patch.proof;
    await saveChange(sc, id, row, mid);
    await auditRepo(sc, id, "CHANGE_UPDATED", "change", mid, null, row, `Modificare actualizată (${patch.status ?? "date"})`);
  });

  const submit = (s: Submission, proof?: File) => run(async () => {
    if (!scope || !dossier || !currentPayload) throw new Error("Dosarul nu există încă.");
    await recordSubmission(scope, dossier, s, { ...currentPayload, createdAt: new Date().toISOString() }, proof);
  }, "Depunerea a fost înregistrată în ArendaPro (nu este o confirmare APIA).");
  const setInControl = (v: boolean) => run(async () => { const { sc, id } = need(); await patchDossier(id, { lifecycle: v ? "UNDER_REVIEW_USER_CONFIRMED" : "SUBMISSION_RECORDED" }); await auditRepo(sc, id, "LIFECYCLE", "dossier", id, null, { v }, v ? "Marcat „În control” de utilizator" : "Scos din „În control”"); });

  const goFirstIssue = () => { const w = nextTarget; setSection(w ? w.section : "verification"); if (w?.parcels?.[0]) setFocusParcel(w.parcels[0]); };

  return {
    campaign, setCampaign, years, hasDossier: !!dossier, dossiers: { [campaign]: !!dossier } as Record<string, boolean>, role, section, setSection, lastSection, parcels, usage, docs, warnings: activeWarnings, open, ivs, notebooks, mods, activity,
    zoo: prep.livestockApplicable, setZoo, bndDate: prep.bndConfirmedOn, verifRan, setVerifRan, signMethod, setSignMethod, submission, inControl, setInControl, exportsDone, setExportsDone, toast, notify, openNb, setOpenNb,
    focusParcel, setFocusParcel, log, percent, count, resolve, docsOk, docsTotal: liveDocs.length, docsMissing, ivStatus, ivReq, nbStatus, sectionInfo, secComplete, secIncomplete, applicableCount: applicable.length,
    needsCheck, nextTarget, dossierStatus, can, canSubmit, updateParcel, confirmArea, uploadUsageFile, addDoc, uploadBank, addActivity, confirmNotebook, toggleIv, addMod, updateMod,
    submit, confirmBnd, createDossier, goFirstIssue, MOD_TYPES, SECTION_ORDER,
    // date reale
    loading, error, reload: loadAll, scope, farmName: scope?.farmName ?? "", company: src?.company ?? null, overrides, saveApplicant, saveZoo, livestock: dossier?.livestock ?? [], exploitationCode: dossier?.exploitation_code ?? "",
    updateDoc, replaceDoc, openFile, decideRow, setIvParcels, setIvNote, diff, snapshots, dossier, today, plannedSkipped: view?.plannedSkipped ?? 0, version: dossier?.version ?? 1,
  };
}
export type Apia = ReturnType<typeof useApia>;
