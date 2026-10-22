import { useState } from "react";
import { CheckCircle2, FilePlus2, Loader2, PawPrint, ShieldCheck, Archive, Download as Dl, Eye } from "lucide-react";
import { C, DOC_CATS, HubDoc, MOD_TYPES, ROLE_LABEL, SECTION_TITLES, SectionKey, STATUS, ha } from "./data";
import type { Apia, SecStatus } from "./useApia";
import { DISCLAIMER } from "@/lib/apia-prep/engine";
import type { SP } from "./sections1";
import {
  Btn, Card, csv, Disclaimer, DocumentRow, DocumentUploader, download, EmptyState, ExportCard, Field, H, Input, Modal, ProgressBar, ReadOnlyBanner,
  SectionHeader, Select, StatusBadge, SubmissionConfirmation, Tabs, VerificationSummary, fmtDate, inputCls, inputStyle, Card as _C,
} from "./ui";

// ── Zootehnie ────────────────────────────────────────────────────────────────
export function Zoo({ a }: SP) {
  const edit = a.can("zoo");
  const [date, setDate] = useState(a.today);
  const [code, setCode] = useState(a.exploitationCode);
  const [rows, setRows] = useState<{ species: string; count: string }[]>(() => a.livestock.map(l => ({ species: l.species, count: String(l.count) })));
  if (!a.zoo) return (
    <div>
      {!edit && <ReadOnlyBanner role={ROLE_LABEL[a.role]} />}
      <SectionHeader title="Sector zootehnic" />
      <EmptyState icon={<PawPrint size={22} />} title="Această secțiune nu se aplică exploatației curente." text="Dacă ferma ta are animale, poți activa manual secțiunea." action={<Btn v="primary" disabled={!edit} onClick={() => a.setZoo(true)}>Ferma are animale</Btn>} />
    </div>
  );
  const saveLivestock = () => a.saveZoo(code.trim(), rows.filter(r => r.species.trim()).map(r => ({ species: r.species.trim(), count: Math.max(0, Math.round(Number(r.count.replace(",", ".")) || 0)) })));
  return (
    <div>
      {!edit && <ReadOnlyBanner role={ROLE_LABEL[a.role]} />}
      <SectionHeader title="Sector zootehnic" desc="Efective introduse de tine. ArendaPro nu are integrare cu BND sau ANSVSA." action={<Btn disabled={!edit} onClick={() => a.setZoo(false)}>Marchează ca „Nu se aplică”</Btn>} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card><h3 className="mb-3 text-[15px] font-extrabold" style={H}>Exploatație</h3>
          <Field label="Cod exploatație (ANSVSA)"><Input disabled={!edit} value={code} onChange={e => setCode(e.target.value)} /></Field></Card>
        <Card><h3 className="mb-3 text-[15px] font-extrabold" style={H}>Specii și efective</h3>
          <div className="space-y-2">{rows.map((r, i) => <div key={i} className="flex gap-2"><Input disabled={!edit} placeholder="Specia" value={r.species} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, species: e.target.value } : x))} /><Input disabled={!edit} inputMode="numeric" placeholder="Capete" value={r.count} onChange={e => setRows(rs => rs.map((x, j) => j === i ? { ...x, count: e.target.value } : x))} /></div>)}</div>
          <div className="mt-3 flex gap-2"><Btn size="sm" disabled={!edit} onClick={() => setRows(rs => [...rs, { species: "", count: "" }])}>Adaugă specie</Btn><Btn size="sm" v="primary" disabled={!edit} onClick={saveLivestock}>Salvează</Btn></div></Card>
        <Card className="md:col-span-2"><h3 className="mb-1 text-[15px] font-extrabold" style={H}>Confirmare BND</h3>
          {a.bndDate ? <p className="flex items-center gap-2 text-[13px]"><CheckCircle2 size={16} color="#4E8B62" />Actualizare BND confirmată de utilizator la data de <b>{fmtDate(a.bndDate)}</b>.</p> : (
            <><p className="mb-3 text-[13px]" style={{ color: C.muted }}>Nu avem o integrare cu BND. Spune-ne când ai verificat tu efectivele acolo.</p>
              <div className="flex flex-wrap items-end gap-2"><Field label="Data verificării"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field><Btn v="primary" disabled={!edit} onClick={() => a.confirmBnd(date)}>Confirm actualizarea în BND</Btn></div></>
          )}
        </Card>
        <Card className="md:col-span-2"><h3 className="mb-2 text-[15px] font-extrabold" style={H}>Intervenții zootehnice</h3>
          <p className="text-[13px]">Selectate: {a.ivs.filter(i => i.selected && i.cat === "Sprijin cuplat zootehnic").map(i => i.code).join(", ") || "niciuna"} <button className="ml-2 font-semibold underline" style={{ color: C.primary }} onClick={() => a.setSection("interventions")}>Alege intervenții</button></p></Card>
      </div>
    </div>
  );
}

// ── Documente justificative ──────────────────────────────────────────────────
export function Documents({ a }: SP) {
  const edit = a.can("documents");
  const [view, setView] = useState<"lista" | "grup">("lista");
  const [cat, setCat] = useState(""); const [st, setSt] = useState(""); const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [prev, setPrev] = useState(false);
  const list = a.docs.filter(d => !d.archived && (!cat || d.cat === cat) && (!st || d.status === st) && (!q || d.name.toLowerCase().includes(q.toLowerCase())));
  const doc = a.docs.find(d => d.id === sel);
  const upd = (id: string, patch: Partial<HubDoc>) => { void a.updateDoc(id, patch); };
  const ro = !edit || doc?.source === "contract" || doc?.source === "cerut";
  const missing = a.docs.filter(d => !d.archived && (d.status === "doc_lipsa" || d.status === "doc_expirat"));

  return (
    <div>
      {!edit && <ReadOnlyBanner role={ROLE_LABEL[a.role]} />}
      <SectionHeader title="Documente justificative" desc="Toate documentele dosarului, într-un singur loc." action={<Tabs value={view} onChange={setView} items={[{ v: "lista", label: "Listă" }, { v: "grup", label: "Pe secțiuni" }]} />} />
      {missing.length > 0 && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-3 text-[13px]" style={{ background: "#FFF6EA", border: "1px solid #F6D3A9" }}><b style={{ color: "#A24A07" }}>{missing.length} documente lipsesc sau au expirat:</b><span className="min-w-[200px] flex-1" style={{ color: C.muted }}>{missing.map(m => m.name).join(" · ")}</span><Btn size="sm" onClick={() => { setSt("doc_lipsa"); setCat(""); }}>Arată doar lipsă</Btn></div>}
      <div className="mb-4"><DocumentUploader disabled={!edit} onFile={async (_n, _s, f) => { const id = await a.addDoc(f, { cat: cat || "Alte documente" }); if (id) setSel(id); }} /></div>
      <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
        <Input placeholder="Caută document" value={q} onChange={e => setQ(e.target.value)} />
        <Select value={cat} onChange={setCat}><option value="">Toate categoriile</option>{DOC_CATS.map(c => <option key={c}>{c}</option>)}</Select>
        <Select value={st} onChange={setSt}><option value="">Toate statusurile</option>{["doc_disponibil", "doc_lipsa", "doc_expirat", "doc_aproape", "doc_verificare", "doc_inlocuit"].map(k => <option key={k} value={k}>{STATUS[k].label}</option>)}</Select>
      </div>
      {list.length === 0 ? <EmptyState icon={<FilePlus2 size={22} />} title="Nu există documente încărcate" text="Încarcă documentele și asociază-le cu secțiunea corespunzătoare." action={<Btn v="primary" disabled={!edit}>Încarcă document</Btn>} /> : view === "lista" ? (
        <div className="space-y-2">{list.map(d => <DocumentRow key={d.id} d={d} onOpen={() => { setSel(d.id); setPrev(false); }} />)}</div>
      ) : (
        <div className="space-y-5">{Object.entries(list.reduce<Record<string, HubDoc[]>>((m, d) => { const k = SECTION_TITLES[d.section]; (m[k] ??= []).push(d); return m; }, {})).map(([k, ds]) => (
          <div key={k}><div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{k}<span className="rounded-full px-2 py-0.5 text-[10.5px]" style={{ background: "#F1EFE6" }}>{ds.length}</span></div><div className="space-y-2">{ds.map(d => <DocumentRow key={d.id} d={d} onOpen={() => { setSel(d.id); setPrev(false); }} />)}</div></div>
        ))}</div>
      )}

      <Modal open={!!doc} onClose={() => setSel(null)} wide title={doc?.name ?? ""} desc={doc ? `${doc.cat} · versiunea ${doc.version}` : ""}>
        {doc && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><StatusBadge status={doc.status} />{doc.file && <span className="text-[12px]" style={{ color: C.muted }}>{doc.file}</span>}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Denumire"><Input key={doc.id} disabled={ro} defaultValue={doc.name} onBlur={e => { if (e.target.value !== doc.name) upd(doc.id, { name: e.target.value }); }} /></Field>
              <Field label="Categorie"><Select disabled={ro} value={doc.cat} onChange={v => upd(doc.id, { cat: v })}>{DOC_CATS.map(c => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Parcelă asociată"><Select disabled={ro} value={doc.parcel} onChange={v => upd(doc.id, { parcel: v })}><option value="">—</option>{a.parcels.map(p => <option key={p.code}>{p.code}</option>)}</Select></Field>
              <Field label="Intervenție asociată"><Select disabled={ro} value={doc.interv} onChange={v => upd(doc.id, { interv: v })}><option value="">—</option>{a.ivs.map(i => <option key={i.code}>{i.code}</option>)}</Select></Field>
              <Field label="Data expirării"><Input disabled={ro} type="date" value={doc.expiry ?? ""} onChange={e => upd(doc.id, { expiry: e.target.value || null })} /></Field>
            </div>
            <Field label="Notă"><textarea key={doc.id} disabled={ro} rows={2} defaultValue={doc.note} onBlur={e => { if (e.target.value !== doc.note) upd(doc.id, { note: e.target.value }); }} className={inputCls} style={inputStyle} /></Field>
            {ro && <p className="text-[12px]" style={{ color: C.muted }}>Document preluat automat din contracte sau din cerințele dosarului. Se modifică la sursa lui.</p>}
            <DocumentUploader compact disabled={!edit} label={doc.file ? "Încarcă o versiune nouă" : "Încarcă fișierul"} onFile={(_n, _s, f) => { if (doc.usageId) void a.uploadUsageFile(doc.usageId, f); else if (doc.id === "req-bank") void a.uploadBank(f); else void a.replaceDoc(doc, f); }} />
            <div className="flex flex-wrap justify-between gap-2">
              <div className="flex flex-wrap gap-2"><Btn disabled={!doc.storagePath} onClick={() => void a.openFile(doc.storagePath ?? null)} icon={<Eye size={13} />}>Deschide fișierul</Btn></div>
              <Btn v="danger" disabled={ro} icon={<Archive size={13} />} onClick={() => { upd(doc.id, { archived: true }); setSel(null); }}>Arhivează</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Verificare ───────────────────────────────────────────────────────────────
export function Verification({ a }: SP) {
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); await a.setVerifRan(true); setBusy(false); };
  const defs: { key: SectionKey | "semnare"; label: string; sec?: SectionKey }[] = [
    { key: "applicant", label: "Date solicitant", sec: "applicant" }, { key: "bank", label: "Date bancare", sec: "bank" }, { key: "parcels", label: "Parcelele", sec: "parcels" },
    { key: "usage", label: "Documentele de utilizare", sec: "usage" }, { key: "cultures", label: "Culturile", sec: "cultures" }, { key: "interventions", label: "Intervențiile", sec: "interventions" },
    { key: "notebooks", label: "Caietele", sec: "notebooks" }, { key: "zoo", label: "Zootehnia", sec: "zoo" }, { key: "documents", label: "Documentele justificative", sec: "documents" }, { key: "semnare", label: "Semnarea" },
  ];
  const rows = defs.map(d => {
    if (d.key === "semnare") return { key: d.key, label: d.label, status: (a.signMethod ? "s_complet" : "s_neinceput") as SecStatus, issues: a.signMethod ? [] : ["Modalitatea de semnare nu a fost aleasă încă."], recs: [] as string[] };
    const k = d.key as SectionKey; const info = a.sectionInfo(k);
    let issues = a.open.filter(w => w.section === k && w.sev !== "recomandare").map(w => w.title);
    if (k === "documents") issues = a.docs.filter(x => !x.archived && (x.status === "doc_lipsa" || x.status === "doc_expirat")).map(x => `${x.status === "doc_lipsa" ? "Lipsește" : "A expirat"}: ${x.name}`);
    if (k === "interventions") issues = a.ivs.filter(i => i.selected && a.ivStatus(i) !== "i_pregatita").map(i => `${i.code}: ${STATUS[a.ivStatus(i)].label.toLowerCase()}`);
    return { key: d.key, label: d.label, status: info.status as SecStatus, issues, recs: a.open.filter(w => w.section === k && w.sev === "recomandare").map(w => w.title) };
  });
  const math = a.open.filter(w => w.kind === "matematic" && w.sev !== "recomandare").length;
  const adm = a.open.filter(w => w.kind === "administrativ" && w.sev !== "recomandare").length;
  const crit = a.count("critic"), ver = a.count("verificare");
  const msg = crit ? "Dosarul conține informații lipsă." : ver ? "Dosarul necesită verificări suplimentare." : "Dosarul este pregătit pentru revizuirea finală.";
  const tone = crit ? "#A5281B" : ver ? "#7A5B00" : "#2A6240";
  return (
    <div>
      <SectionHeader title="Verificarea dosarului" desc="Revizuiește informațiile, documentele și diferențele identificate înainte de pregătirea exportului." action={<Btn v="primary" disabled={busy} onClick={run} icon={busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}>{a.verifRan ? "Rulează din nou" : "Generează verificarea"}</Btn>} />
      {!a.verifRan && !busy && <EmptyState icon={<ShieldCheck size={22} />} title="Verificarea nu a fost generată încă" text="Apasă „Generează verificarea” ca să vezi, pe categorii, ce mai trebuie rezolvat." />}
      {busy && <Card className="flex items-center gap-3"><Loader2 className="animate-spin" size={18} color={C.primary} /><span className="text-[13px]">Verificăm datele din ArendaPro…</span></Card>}
      {a.verifRan && !busy && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-5">
              <div><div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Nivel de completare</div><div className="text-[34px] font-extrabold leading-none" style={{ ...H, color: C.primary }}>{a.percent}%</div></div>
              <div className="min-w-[200px] flex-1"><ProgressBar value={a.percent} /><div className="mt-2 text-[12.5px]" style={{ color: C.muted }}>{math} verificări matematice și {adm} administrative necesită atenție.</div></div>
            </div>
            <div className="mt-4 rounded-xl px-4 py-3 text-[14px] font-bold" style={{ background: crit ? "#FDECEA" : ver ? "#FFF8D9" : "#E8F2EA", color: tone }}>{msg}</div>
            <div className="mt-3"><Disclaimer>Nivelul de completare arată cât din informațiile cerute este pregătit în ArendaPro. Nu este o evaluare a eligibilității.</Disclaimer></div>
          </Card>
          <VerificationSummary rows={rows} onGo={k => a.setSection(k)} />
        </div>
      )}
    </div>
  );
}

// ── Export și depunere ───────────────────────────────────────────────────────
export function ExportPage({ a }: SP) {
  const gen = a.can("export");
  const [f, setF] = useState({ date: a.today, number: "", center: "", note: "" });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [ask, setAsk] = useState(false);
  const [tried, setTried] = useState(false);
  const opts: [string, string, "CSV"[]][] = [
    ["Rezumat dosar", "Starea dosarului, secțiuni și avertizări deschise.", ["CSV"]],
    ["Lista parcelelor", "Parcele, suprafețe, culturi și documente asociate.", ["CSV"]],
    ["Centralizator documente", "Toate documentele, cu status și valabilitate.", ["CSV"]],
    ["Centralizator intervenții", "Intervențiile selectate și starea lor.", ["CSV"]],
    ["Caiete și evidențe", "Activitățile înregistrate pe fiecare caiet.", ["CSV"]],
    ["Lista avertizărilor", "Critice, de verificat și recomandări.", ["CSV"]],
  ];
  const exportIt = (name: string, fmt: string) => {
    const head: (string | number)[][] = [["Atenționare", DISCLAIMER], ["Fermă", a.farmName], ["Campanie", a.campaign], ["Data", a.today], ["Utilizator", a.scope?.userEmail ?? ""], ["Versiune dosar", a.version], ["Status", STATUS[a.dossierStatus].label], []];
    const rows: Record<string, (string | number)[][]> = {
      "Rezumat dosar": [["Completare", `${a.percent}%`], ["Documente verificate", `${a.docsOk}/${a.docsTotal}`], ["Avertizări deschise", a.open.length]],
      "Lista parcelelor": [["Parcelă", "Bloc", "UAT", "Cultură", "Suprafață ArendaPro (ha)", "Suprafață document (ha)", "Declarată (ha)"], ...a.parcels.map(p => [p.code, p.bloc, p.uat, p.culture, p.areaApp, p.areaDoc ?? "", p.declared ?? ""])],
      "Centralizator documente": [["Document", "Categorie", "Status", "Expiră"], ...a.docs.filter(d => !d.archived).map(d => [d.name, d.cat, STATUS[d.status].label, d.expiry ?? ""])],
      "Centralizator intervenții": [["Cod", "Denumire", "Status", "Versiune regulă"], ...a.ivs.filter(i => i.selected).map(i => [i.code, i.name, STATUS[a.ivStatus(i)].label, i.ruleVersion ?? ""])],
      "Caiete și evidențe": [["Caiet", "Dată", "Parcelă", "Activitate", "Produs", "Cantitate", "Sursă"], ...a.notebooks.flatMap(n => n.entries.map(e => [n.name, e.date, e.parcel, e.activity, e.input, e.qty, e.sourceType ?? ""]))],
      "Lista avertizărilor": [["Tip", "Titlu", "Secțiune"], ...a.warnings.map(w => [w.sev, w.title, SECTION_TITLES[w.section]])],
    };
    download(`${name.toLowerCase().replace(/\s+/g, "-")}-${a.campaign}.csv`, csv([...head, ...(rows[name] ?? [])]));
    a.setExportsDone(e => [{ id: String(Math.random()), name, format: fmt, time: new Date().toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) }, ...e]);
    a.notify("Fișierul CSV a fost descărcat.");
    a.log(`Export generat: ${name} (${fmt})`);
  };
  const valid = f.date && f.number.trim() && f.center.trim();
  const crit = a.count("critic");
  const s = a.submission;
  return (
    <div>
      {!gen && <ReadOnlyBanner role={ROLE_LABEL[a.role]} />}
      <SectionHeader title="Export și depunere" desc="Pregătește fișierele, apoi înregistrează depunerea făcută prin canalele oficiale APIA." />
      <h3 className="mb-2 text-[15px] font-extrabold" style={H}>Pregătește exportul</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{opts.map(([t, d, fm]) => <ExportCard key={t} title={t} desc={d} formats={fm} disabled={!gen} onExport={x => exportIt(t, x)} />)}</div>
      {a.exportsDone.length > 0 && <Card className="mt-3"><div className="mb-1 text-[12px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Exporturi generate</div>{a.exportsDone.slice(0, 5).map(e => <div key={e.id} className="flex justify-between py-1 text-[12.5px]"><span>{e.name} · {e.format}</span><span style={{ color: C.muted }}>{e.time}</span></div>)}</Card>}

      <h3 className="mb-2 mt-8 text-[15px] font-extrabold" style={H}>Înregistrează depunerea</h3>
      {s ? (
        <Card style={{ borderColor: "#CBE1D0", background: "#F6FAF6" }}>
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={a.dossierStatus} /><span className="text-[13px] font-semibold">Depunere înregistrată în ArendaPro</span></div>
          <dl className="mt-3 grid gap-y-2 text-[13px] sm:grid-cols-2">{([["Data depunerii", fmtDate(s.date)], ["Numărul cererii", s.number], ["Centrul APIA", s.center], ["Modalitatea de semnare", s.sign || "—"], ["Dovada depunerii", s.proof || "—"], ["Înregistrat de", s.by]] as const).map(([l, v]) => <div key={l}><dt className="text-[11.5px] font-semibold" style={{ color: C.muted }}>{l}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
          {s.note && <p className="mt-2 text-[12.5px]" style={{ color: C.muted }}>{s.note}</p>}
          <div className="mt-4 flex flex-wrap gap-2"><Btn disabled={!a.canSubmit} onClick={() => a.setInControl(!a.inControl)}>{a.inControl ? "Scoate din „În control”" : "Marchează „În control”"}</Btn></div>
        </Card>
      ) : (
        <Card>
          {!a.canSubmit && <p className="mb-3 text-[12.5px]" style={{ color: C.muted }}>Doar administratorul poate marca dosarul ca depus.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Data depunerii"><Input type="date" disabled={!a.canSubmit} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Numărul cererii"><Input disabled={!a.canSubmit} value={f.number} onChange={e => setF({ ...f, number: e.target.value })} placeholder="ex. 123456/2026" />{tried && !f.number.trim() && <span className="text-[11px]" style={{ color: "#A5281B" }}>Completează numărul cererii.</span>}</Field>
            <Field label="Centrul APIA"><Input disabled={!a.canSubmit} value={f.center} onChange={e => setF({ ...f, center: e.target.value })} /></Field>
            <Field label="Modalitatea de semnare"><Select disabled={!a.canSubmit} value={a.signMethod} onChange={a.setSignMethod}><option value="">Alege modalitatea</option><option>Semnătură electronică calificată</option><option>Semnătură la centrul APIA</option><option>Altă modalitate</option></Select></Field>
            <Field label="Utilizatorul care înregistrează"><Input disabled value={a.scope?.userEmail ?? ""} /></Field>
            <Field label="Observații"><Input disabled={!a.canSubmit} value={f.note} onChange={e => setF({ ...f, note: e.target.value })} /></Field>
          </div>
          <div className="mt-3"><DocumentUploader compact disabled={!a.canSubmit} label={proofFile ? `Dovadă atașată: ${proofFile.name}` : "Încarcă dovada depunerii"} onFile={(_n, _s, file) => setProofFile(file)} /></div>
          {crit > 0 && <p className="mt-3 rounded-xl p-2.5 text-[12.5px]" style={{ background: "#FFF6EA", color: "#A24A07" }}>Mai sunt {crit} elemente critice deschise în ArendaPro. Poți înregistra depunerea, dar verifică-le mai întâi.</p>}
          <div className="mt-4"><Btn v="primary" disabled={!a.canSubmit} onClick={() => { setTried(true); if (valid) setAsk(true); }} icon={<CheckCircle2 size={14} />}>Marchează dosarul ca depus</Btn></div>
          <div className="mt-3"><Disclaimer>ArendaPro nu depune dosarul. Înregistrezi aici doar depunerea făcută prin canalele oficiale APIA.</Disclaimer></div>
        </Card>
      )}
      <SubmissionConfirmation open={ask} onClose={() => setAsk(false)} number={f.number} date={f.date} onConfirm={() => { void a.submit({ date: f.date, number: f.number, center: f.center, note: f.note, sign: a.signMethod, proof: proofFile?.name ?? "", by: a.scope?.userEmail ?? "" }, proofFile ?? undefined); setAsk(false); }} />
    </div>
  );
}

// ── Modificări ───────────────────────────────────────────────────────────────
export function Modifications({ a }: SP) {
  const edit = a.can("modifications");
  const [add, setAdd] = useState(false);
  const [send, setSend] = useState<string | null>(null);
  const [sd, setSd] = useState({ date: a.today, proof: "" });
  const [f, setF] = useState({ code: "M1", reason: "", parcels: "", changed: "", docs: "" });
  return (
    <div>
      {!edit && <ReadOnlyBanner role={ROLE_LABEL[a.role]} />}
      <SectionHeader title="Modificări după depunere" desc="Pregătește și urmărește modificările. ArendaPro nu le transmite automat către APIA." action={<Btn v="primary" disabled={!edit} onClick={() => setAdd(true)} icon={<FilePlus2 size={14} />}>Adaugă modificare</Btn>} />
      {!a.submission && <p className="mb-3 rounded-xl p-3 text-[12.5px]" style={{ background: "#F1F0EA", color: C.muted }}>Dosarul nu este încă marcat ca depus. Poți pregăti drafturi, dar transmiterea are sens după depunere.</p>}
      {a.submission && (
        <Card className="mb-4">
          <div className="mb-1 text-[13px] font-bold" style={H}>Diferențe față de depunere</div>
          {a.diff.length === 0 ? <p className="text-[12.5px]" style={{ color: C.muted }}>Nu există diferențe față de instantaneul salvat la depunere.</p> : (
            <ul className="space-y-1 text-[12.5px]">{a.diff.map(d => <li key={`${d.kind}:${d.key}`}><b>{d.kind}</b> · {d.label}: {d.before} → {d.after}</li>)}</ul>
          )}
        </Card>
      )}
      {a.mods.length === 0 ? <EmptyState icon={<FilePlus2 size={22} />} title="Nu există modificări" text="Dacă după depunere se schimbă ceva, adaugă aici modificarea (M1–M4) și păstrează dovada transmiterii." action={<Btn v="primary" disabled={!edit} onClick={() => setAdd(true)}>Adaugă modificare</Btn>} /> : (
        <div className="space-y-3">{a.mods.map(m => (
          <Card key={m.id}>
            <div className="flex flex-wrap items-start gap-2"><div className="flex-1"><div className="text-[15px] font-extrabold" style={H}>{m.code} – {MOD_TYPES.find(t => t[0] === m.code)![1]}</div><div className="text-[12px]" style={{ color: C.muted }}>Inițiată la {fmtDate(m.started)}</div></div><StatusBadge status={m.status} /></div>
            <dl className="mt-3 grid gap-y-2 text-[12.5px] sm:grid-cols-2"><div><dt style={{ color: C.muted }}>Motiv</dt><dd className="font-medium">{m.reason || "—"}</dd></div><div><dt style={{ color: C.muted }}>Parcele afectate</dt><dd className="font-medium">{m.parcels.join(", ") || "—"}</dd></div><div><dt style={{ color: C.muted }}>Informații modificate</dt><dd className="font-medium">{m.changed || "—"}</dd></div><div><dt style={{ color: C.muted }}>Documente</dt><dd className="font-medium">{m.docs.join(", ") || "—"}</dd></div><div><dt style={{ color: C.muted }}>Data transmiterii</dt><dd className="font-medium">{fmtDate(m.sentOn || null)}</dd></div><div><dt style={{ color: C.muted }}>Dovada transmiterii</dt><dd className="font-medium">{m.proof || "—"}</dd></div></dl>
            {edit && m.status !== "m_transmisa" && m.status !== "m_anulata" && <div className="mt-3 flex flex-wrap gap-2">
              {m.status === "m_draft" && <Btn size="sm" onClick={() => a.updateMod(m.id, { status: "m_pregatita" })}>Marchează pregătită</Btn>}
              {m.status === "m_pregatita" && <Btn size="sm" v="primary" onClick={() => setSend(m.id)}>Am transmis-o prin canalul oficial</Btn>}
              <Btn size="sm" v="danger" onClick={() => a.updateMod(m.id, { status: "m_anulata" })}>Anulează</Btn></div>}
          </Card>))}</div>
      )}
      <Modal open={add} onClose={() => setAdd(false)} title="Adaugă modificare" desc="Se salvează ca draft.">
        <div className="space-y-3">
          <Field label="Tip modificare"><Select value={f.code} onChange={v => setF({ ...f, code: v })}>{MOD_TYPES.map(([c, t]) => <option key={c} value={c}>{c} – {t}</option>)}</Select></Field>
          <Field label="Motiv"><Input value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} /></Field>
          <Field label="Parcele afectate" hint="Separate prin virgulă, ex. P12, P19"><Input value={f.parcels} onChange={e => setF({ ...f, parcels: e.target.value })} /></Field>
          <Field label="Informații modificate"><Input value={f.changed} onChange={e => setF({ ...f, changed: e.target.value })} /></Field>
          <DocumentUploader compact label={f.docs ? `Atașat: ${f.docs}` : "Atașează document"} onFile={n => setF({ ...f, docs: n })} />
          <div className="flex justify-end gap-2"><Btn onClick={() => setAdd(false)}>Anulează</Btn><Btn v="primary" onClick={() => { a.addMod({ code: f.code, started: new Date().toISOString().slice(0, 10), reason: f.reason, parcels: f.parcels.split(",").map(s => s.trim()).filter(Boolean), changed: f.changed, docs: f.docs ? [f.docs] : [], status: "m_draft", sentOn: "", proof: "" }); setAdd(false); setF({ code: "M1", reason: "", parcels: "", changed: "", docs: "" }); }}>Salvează draftul</Btn></div>
        </div>
      </Modal>
      <Modal open={!!send} onClose={() => setSend(null)} title="Înregistrezi transmiterea?" desc="Confirmă că ai transmis modificarea prin canalul oficial APIA.">
        <div className="space-y-3"><Field label="Data transmiterii"><Input type="date" value={sd.date} onChange={e => setSd({ ...sd, date: e.target.value })} /></Field><DocumentUploader compact label={sd.proof ? `Dovadă: ${sd.proof}` : "Încarcă dovada transmiterii"} onFile={n => setSd({ ...sd, proof: n })} />
          <div className="flex justify-end gap-2"><Btn onClick={() => setSend(null)}>Anulează</Btn><Btn v="primary" onClick={() => { a.updateMod(send!, { status: "m_transmisa", sentOn: sd.date, proof: sd.proof }); a.log("Modificare marcată ca transmisă"); setSend(null); }}>Confirmă</Btn></div></div>
      </Modal>
    </div>
  );
}
