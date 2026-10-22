import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronUp, Eye, EyeOff, FilePlus2, Landmark, Layers, ListChecks, MapPin, MoreHorizontal, Pencil, ShieldAlert, Table2, Map as MapIcon, FileText, Wallet, Hammer, ClipboardList } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./primitives";
import { C, Parcel, ROLE_LABEL, SEV_META, SECTION_TITLES, USAGE_TYPES, ha, fmt, Sev, Warning } from "./data";
import type { Apia } from "./useApia";
import { PROFILE_COLS } from "./useApia";
import {
  ActivityTimeline, Btn, Card, DifferenceIndicator, DocumentRow, DocumentUploader, EmptyState, Field, H, Input, Modal, ProgressCard,
  ReadOnlyBanner, SecIcon, SectionHeader, Select, StatusBadge, SummaryCard, Tabs, WarningCard, fmtDate, inputStyle, ErrorState,
} from "./ui";

export type BP = "desktop" | "tablet" | "mobile";
export interface SP { a: Apia; bp: BP }

// ── Prezentare generală ──────────────────────────────────────────────────────
export function Overview({ a }: SP) {
  const [openGroups, setOpenGroups] = useState<Record<Sev, boolean>>({ critic: true, verificare: true, recomandare: false });
  const todo = a.open.slice(0, 5);
  const incomplete = a.SECTION_ORDER.map(k => ({ k, ...a.sectionInfo(k) })).filter(i => i.status === "s_incomplet" || i.status === "s_verificare");
  const recentDocs = [...a.docs].filter(d => d.file && !d.archived).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 4);
  const go = (w: Warning) => { a.setSection(w.section); if (w.parcels?.[0] && w.section === "parcels") a.setFocusParcel(w.parcels[0]); };
  const selected = a.ivs.filter(i => i.selected).length;
  const declared = a.parcels.filter(p => !p.excluded);
  const total = declared.reduce((s, p) => s + p.areaApp, 0);

  return (
    <div className="space-y-5">
      <ProgressCard a={a} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard label="Parcelele declarate" value={`${declared.length} parcele`} icon={<MapPin size={16} />} onClick={() => a.setSection("parcels")} />
        <SummaryCard label="Suprafața totală" value={ha(total)} icon={<Layers size={16} />} onClick={() => a.setSection("parcels")} />
        <SummaryCard label="Intervenții selectate" value={`${selected} intervenții`} icon={<ListChecks size={16} />} onClick={() => a.setSection("interventions")} />
        <SummaryCard label="Documente verificate" value={`${a.docsOk} din ${a.docsTotal}`} icon={<FileText size={16} />} onClick={() => a.setSection("documents")} />
        <div className="col-span-2 lg:col-span-1"><SummaryCard attention label="Necesită atenție" value={`${a.open.filter(w => w.sev !== "recomandare").length} elemente`} sub="Nimic grav, dar de rezolvat" icon={<ShieldAlert size={16} />} onClick={() => a.setSection("verification")} /></div>
      </div>

      <Card>
        <SectionHeader title="Ce mai ai de făcut" desc="Cele mai importante 5 acțiuni, în ordinea priorității." />
        {todo.length === 0 ? <p className="text-[13px]" style={{ color: C.muted }}>Nu mai ai acțiuni deschise. Poți merge la verificarea finală.</p> : (
          <div className="space-y-2">
            {todo.map(w => (
              <div key={w.id} className="flex flex-wrap items-center gap-3 rounded-xl px-3.5 py-3" style={{ border: `1px solid ${C.lineSoft}` }}>
                <StatusBadge small tone={SEV_META[w.sev].tone} label={w.sev === "critic" ? "Document / date lipsă" : w.sev === "verificare" ? "De verificat" : "Recomandare"} />
                <div className="min-w-[200px] flex-1"><div className="text-[13px] font-semibold" style={{ color: C.text }}>{w.title}</div><div className="text-[11.5px]" style={{ color: C.muted }}>{SECTION_TITLES[w.section]}</div></div>
                <Btn size="sm" v="primary" onClick={() => go(w)}>Rezolvă</Btn>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionHeader title="Avertizări grupate" />
          <div className="space-y-3">
            {(["critic", "verificare", "recomandare"] as Sev[]).map(s => {
              const items = a.warnings.filter(w => w.sev === s && !w.resolved);
              return (
                <div key={s}>
                  <button onClick={() => setOpenGroups(g => ({ ...g, [s]: !g[s] }))} className="flex w-full items-center gap-2 text-left">
                    <StatusBadge small tone={SEV_META[s].tone} label={`${SEV_META[s].label} · ${items.length}`} />
                    <span className="flex-1" />{openGroups[s] ? <ChevronUp size={15} color={C.muted} /> : <ChevronDown size={15} color={C.muted} />}
                  </button>
                  <p className="mt-1 text-[11.5px]" style={{ color: C.muted }}>{SEV_META[s].hint}</p>
                  {openGroups[s] && <div className="mt-2 space-y-2">{items.length ? items.map(w => <WarningCard key={w.id} w={w} compact onGo={() => go(w)} />) : <p className="text-[12px]" style={{ color: "#2A6240" }}>Nimic de rezolvat aici.</p>}</div>}
                </div>
              );
            })}
          </div>
        </Card>
        <div className="space-y-5">
          <Card>
            <SectionHeader title="Campania" action={<StatusBadge status={a.dossierStatus} />} />
            <dl className="grid grid-cols-2 gap-y-2.5 text-[13px]">
              <dt style={{ color: C.muted }}>Campanie</dt><dd className="font-semibold">{a.campaign}</dd>
              <dt style={{ color: C.muted }}>Fermă</dt><dd className="font-semibold">{a.farmName || "—"}</dd>
              <dt style={{ color: C.muted }}>Depunere</dt><dd className="font-semibold">{a.submission ? `Înregistrată la ${fmtDate(a.submission.date)}` : "Neînregistrată"}</dd>
              <dt style={{ color: C.muted }}>Data verificării</dt><dd className="font-semibold">{fmtDate(a.today)}</dd>
            </dl>
          </Card>
          <Card>
            <SectionHeader title="Secțiuni incomplete" />
            {incomplete.length === 0 ? <p className="text-[13px]" style={{ color: C.muted }}>Toate secțiunile sunt la zi.</p> : (
              <div className="space-y-1">{incomplete.map(i => (
                <button key={i.k} onClick={() => a.setSection(i.k)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-[#F6F4ED]"><SecIcon s={i.status} /><span className="flex-1 text-[13px] font-medium">{SECTION_TITLES[i.k]}</span><span className="text-[11.5px]" style={{ color: C.muted }}>{i.issues ? `${i.issues} de rezolvat` : ""}</span></button>
              ))}</div>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card><SectionHeader title="Ultimele activități" /><ActivityTimeline items={a.activity.slice(0, 5)} /></Card>
        <Card><SectionHeader title="Documente încărcate recent" /><div className="space-y-2">{recentDocs.map(d => <DocumentRow key={d.id} d={d} onOpen={() => a.setSection("documents")} />)}</div></Card>
      </div>
    </div>
  );
}

// ── Date solicitant ──────────────────────────────────────────────────────────
type FieldDef = { k: string; label: string; type?: string };
const CARDS: { id: string; title: string; icon: React.ReactNode; fields: FieldDef[] }[] = [
  { id: "ident", title: "Identificare", icon: <Building2 size={16} />, fields: [{ k: "tip", label: "Tip solicitant" }, { k: "nume", label: "Nume sau denumire" }, { k: "cui", label: "CNP / CUI" }, { k: "apia", label: "Cod unic de identificare APIA" }, { k: "forma", label: "Formă juridică" }, { k: "inf", label: "Data înființării", type: "date" }] },
  { id: "contact", title: "Contact", icon: <MapPin size={16} />, fields: [{ k: "adresa", label: "Adresă" }, { k: "loc", label: "Localitate" }, { k: "jud", label: "Județ" }, { k: "tel", label: "Telefon" }, { k: "mail", label: "E-mail" }] },
  { id: "rep", title: "Reprezentare", icon: <ClipboardList size={16} />, fields: [{ k: "rep", label: "Reprezentant legal" }, { k: "cal", label: "Calitate" }, { k: "imp", label: "Împuternicit" }, { k: "impdoc", label: "Document de împuternicire" }, { k: "impexp", label: "Data expirării împuternicirii", type: "date" }] },
];
export function Applicant({ a }: SP) {
  const edit = a.can("applicant");
  const allFields = CARDS.flatMap(c => c.fields);
  const co = a.company as unknown as Record<string, string | null> | null;
  const vals: Record<string, string> = useMemo(() => Object.fromEntries(allFields.map(f => [f.k, a.overrides[f.k] ?? (PROFILE_COLS[f.k] ? (co?.[PROFILE_COLS[f.k]] ?? "") : "")])), [a.overrides, co]); // eslint-disable-line react-hooks/exhaustive-deps
  const srcOf = (k: string) => (a.overrides[k] !== undefined ? "dosar" : PROFILE_COLS[k] && vals[k] ? "profil" : "gol");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<"profil" | "dosar">("profil");

  const start = (id: string) => { setEditing(id); setDraft(vals); setScope("profil"); };
  const save = (id: string) => {
    const changed = CARDS.find(c => c.id === id)!.fields.filter(f => (draft[f.k] ?? "") !== (vals[f.k] ?? ""));
    if (changed.length) void a.saveApplicant(Object.fromEntries(changed.map(f => [f.k, draft[f.k] ?? ""])), scope);
    setEditing(null);
  };

  return (
    <div>
      {!edit && <ReadOnlyBanner role={ROLE_LABEL[a.role]} />}
      <SectionHeader title="Date solicitant" desc="Informațiile sunt preluate din profilul fermei. Verifică-le și corectează ce nu mai este valabil." />
      <div className="space-y-4">
        {CARDS.map(c => {
          const isEd = editing === c.id;
          return (
            <Card key={c.id}>
              <div className="mb-3 flex items-center gap-2.5"><span style={{ color: C.primary }}>{c.icon}</span><h3 className="flex-1 text-[15px] font-extrabold" style={H}>{c.title}</h3>
                {!isEd && <Btn size="sm" disabled={!edit} onClick={() => start(c.id)} icon={<Pencil size={12} />}>Modifică</Btn>}</div>
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {c.fields.map(f => (
                  <div key={f.k}>
                    {isEd ? <Field label={f.label}><Input type={f.type} value={draft[f.k] ?? ""} onChange={e => setDraft(d => ({ ...d, [f.k]: e.target.value }))} /></Field> : (
                      <>
                        <div className="text-[11.5px] font-semibold" style={{ color: C.muted }}>{f.label}</div>
                        <div className="text-[13.5px] font-medium">{!vals[f.k] ? <span style={{ color: "#A24A07" }}>Lipsește — completează</span> : f.type === "date" ? fmtDate(vals[f.k]) : vals[f.k]}</div>
                        <div className="mt-0.5 text-[10.5px]" style={{ color: srcOf(f.k) === "dosar" ? "#7A5B00" : C.muted }}>{srcOf(f.k) === "dosar" ? "Completat în dosarul APIA (nu modifică profilul fermei)" : srcOf(f.k) === "profil" ? "Preluat din Setări companie" : PROFILE_COLS[f.k] ? "Nu există în profilul fermei" : "Nu există în ArendaPro; se completează doar în dosar"}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {isEd && (
                <div className="mt-4 rounded-xl p-3" style={{ background: "#F6F4ED" }}>
                  <div className="mb-2 text-[12.5px] font-semibold">Unde se aplică modificarea?</div>
                  {([["profil", "Actualizează și profilul fermei", "Se vor schimba datele și în celelalte module ArendaPro."], ["dosar", "Doar dosarul APIA", "Profilul fermei rămâne neschimbat."]] as const).map(([v, t, d]) => (
                    <label key={v} className="flex cursor-pointer items-start gap-2 py-1"><input type="radio" checked={scope === v} onChange={() => setScope(v)} className="mt-1" /><span><span className="block text-[13px] font-medium">{t}</span><span className="text-[11.5px]" style={{ color: C.muted }}>{d}</span></span></label>
                  ))}
                  <div className="mt-3 flex gap-2"><Btn v="primary" onClick={() => save(c.id)}>Salvează</Btn><Btn onClick={() => setEditing(null)}>Renunță</Btn></div>
                </div>
              )}
              {null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Cont bancar ──────────────────────────────────────────────────────────────
export function Bank({ a }: SP) {
  const edit = a.can("bank");
  const [show, setShow] = useState(false);
  const doc = a.docs.find(d => d.cat === "Băncă" && !d.archived)!;
  const iban = (a.company?.iban ?? "").replace(/\s+/g, "");
  const masked = iban ? `${iban.slice(0, 4)} •••• •••• •••• ${iban.slice(-4)}` : "";
  const full = iban.replace(/(.{4})/g, "$1 ").trim();
  return (
    <div>
      {!edit && <ReadOnlyBanner role={ROLE_LABEL[a.role]} />}
      <SectionHeader title="Cont bancar" desc="Contul în care se vor face eventualele plăți. IBAN-ul este ascuns până îl afișezi." />
      <Card>
        <div className="mb-4 flex items-center gap-2.5"><Landmark size={17} color={C.primary} /><h3 className="flex-1 text-[15px] font-extrabold" style={H}>Detalii cont</h3><StatusBadge status={doc.status} /></div>
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {([["Titular", a.company?.name || "—"], ["Bancă", a.company?.bank_name || "—"], ["Sursa datelor", "Setări companie (IBAN și bancă se modifică acolo)"], ["Data încărcării documentului", doc.file ? fmtDate(doc.date) : "—"]] as const).map(([l, v]) => (
            <div key={l}><div className="text-[11.5px] font-semibold" style={{ color: C.muted }}>{l}</div><div className="text-[13.5px] font-medium">{v}</div></div>
          ))}
          <div className="sm:col-span-2"><div className="text-[11.5px] font-semibold" style={{ color: C.muted }}>IBAN</div>
            <div className="flex items-center gap-2"><span className="font-mono text-[14px] font-semibold tracking-wide">{!iban ? "Lipsește IBAN-ul" : show ? full : masked}</span>
              <button onClick={() => setShow(s => !s)} className="rounded-lg p-1.5 hover:bg-[#F3F1E8]" aria-label={show ? "Ascunde IBAN" : "Arată IBAN"}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></div>
          <div className="sm:col-span-2"><div className="text-[11.5px] font-semibold" style={{ color: C.muted }}>Document bancar</div><div className="text-[13.5px] font-medium">{doc.file ?? "Lipsește documentul bancar."}{doc.file && <span className="ml-2 text-[11.5px]" style={{ color: C.muted }}>Document disponibil pentru verificare</span>}</div></div>
        </div>
      </Card>
      <div className="mt-4"><DocumentUploader disabled={!edit} label={doc.file ? "Înlocuiește documentul bancar" : "Încarcă documentul bancar"} onFile={(_n, _s, f) => void a.uploadBank(f)} /></div>
      {!edit && <p className="mt-3 text-[12px]" style={{ color: C.muted }}>Rolul curent nu poate modifica datele bancare.</p>}
    </div>
  );
}

// ── Parcele ──────────────────────────────────────────────────────────────────
const usageOf = (a: Apia, code: string) => a.usage.find(u => u.parcels.includes(code));
const hasDiff = (p: Parcel) => p.areaDoc !== null && p.areaDoc !== p.areaApp;
function parcelStatus(a: Apia, p: Parcel) {
  const u = usageOf(a, p.code);
  if (p.excluded) return "p_exclusa";
  if (!u || !u.file) return "p_fara_doc";
  if (p.flagged || (hasDiff(p) && !p.verified) || u.status === "u_expirat" || u.status === "u_verificare") return "p_verificare";
  return "p_ok";
}
const prepared = (p: Parcel) => (hasDiff(p) ? p.declared : p.areaApp);

export function ParcelRow({ a, p, mode, onOpen, onCompare }: { a: Apia; p: Parcel; mode: "row" | "card"; onOpen: () => void; onCompare: () => void }) {
  const u = usageOf(a, p.code); const st = parcelStatus(a, p); const edit = a.can("parcels");
  const prep = prepared(p);
  const menu = (
    <DropdownMenu><DropdownMenuTrigger asChild><button className="rounded-lg p-1.5 hover:bg-[#F3F1E8]" aria-label={`Acțiuni ${p.code}`}><MoreHorizontal size={16} /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onClick={onOpen}>Vezi parcela</DropdownMenuItem>
        <DropdownMenuItem onClick={onCompare}>Verifică suprafața</DropdownMenuItem>
        <DropdownMenuItem onClick={() => a.setSection("usage")}>Vezi documentele</DropdownMenuItem>
        <DropdownMenuItem onClick={() => a.setSection("interventions")}>Selectează intervențiile</DropdownMenuItem>
        <DropdownMenuItem disabled={!edit} onClick={() => a.updateParcel(p.code, { flagged: !p.flagged })}>{p.flagged ? "Scoate marcajul de verificare" : "Marchează pentru verificare"}</DropdownMenuItem>
        <DropdownMenuItem disabled={!edit} onClick={() => { a.updateParcel(p.code, { excluded: !p.excluded }); a.log(`Parcela ${p.code} ${p.excluded ? "inclusă în" : "exclusă din"} pregătirea dosarului`); }}>{p.excluded ? "Include în pregătirea dosarului" : "Exclude din pregătirea dosarului"}</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>
  );
  if (mode === "card") {
    return (
      <Card pad={false} className="p-3.5" style={{ opacity: p.excluded ? 0.6 : 1 }}>
        <div className="flex items-start gap-2"><button onClick={onOpen} className="flex-1 text-left"><div className="text-[14px] font-extrabold" style={H}>{p.code} · {p.name}</div><div className="text-[12px]" style={{ color: C.muted }}>{p.uat} · bloc {p.bloc} · {p.culture}</div></button>{menu}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge status={st} small /><span className="text-[12px] font-semibold">{ha(p.areaApp)}</span>{hasDiff(p) && <DifferenceIndicator compact app={p.areaApp} doc={p.areaDoc} />}</div>
        <div className="mt-1 text-[11.5px]" style={{ color: C.muted }}>{u ? `${u.type} ${u.number}` : "Fără document de utilizare"}</div>
      </Card>
    );
  }
  return (
    <tr className="border-t align-top hover:bg-[#FBFAF5]" style={{ borderColor: C.lineSoft, opacity: p.excluded ? 0.6 : 1 }}>
      <td className="px-3 py-2.5 text-[12.5px]">{p.bloc}</td>
      <td className="px-3 py-2.5"><button onClick={onOpen} className="text-[13px] font-extrabold hover:underline" style={{ ...H, color: C.primary }}>{p.code}</button></td>
      <td className="px-3 py-2.5 text-[12.5px]">{p.name}</td>
      <td className="px-3 py-2.5 text-[12.5px]">{p.uat}</td>
      <td className="px-3 py-2.5 text-[12.5px] font-semibold">{ha(p.areaApp)}</td>
      <td className="px-3 py-2.5 text-[12.5px]">{p.areaDoc === null ? <span style={{ color: C.muted }}>—</span> : <div>{ha(p.areaDoc)}{hasDiff(p) && <div className="mt-0.5"><DifferenceIndicator compact app={p.areaApp} doc={p.areaDoc} /></div>}</div>}</td>
      <td className="px-3 py-2.5 text-[12.5px]">{prep === null ? <button onClick={onCompare} className="font-semibold underline" style={{ color: "#A24A07" }}>Alege valoarea</button> : ha(prep)}</td>
      <td className="px-3 py-2.5 text-[12.5px]">{p.culture}</td>
      <td className="px-3 py-2.5 text-[12px]">{u ? <>{u.type}<div style={{ color: C.muted }}>{u.number}</div></> : "—"}</td>
      <td className="px-3 py-2.5"><StatusBadge status={st} small /></td>
      <td className="px-2 py-2.5">{menu}</td>
    </tr>
  );
}

export function Parcels({ a, bp }: SP) {
  const edit = a.can("parcels");
  const [view, setView] = useState<"tabel" | "harta">("tabel");
  const [f, setF] = useState({ uat: "", cult: "", owner: "", dtype: "", status: "", diff: false, nodoc: false });
  const [detail, setDetail] = useState<string | null>(null);
  const [cmp, setCmp] = useState<string | null>(null);
  const [pick, setPick] = useState<"app" | "doc" | "manual">("app");
  const [manual, setManual] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => { if (a.focusParcel) { setDetail(a.focusParcel); a.setFocusParcel(null); } }, [a.focusParcel]);

  const uniq = (fn: (p: Parcel) => string) => [...new Set(a.parcels.map(fn).filter(Boolean))].sort();
  const rows = useMemo(() => a.parcels.filter(p => {
    const u = usageOf(a, p.code);
    return (!f.uat || p.uat === f.uat) && (!f.cult || p.culture === f.cult) && (!f.owner || u?.owner === f.owner) && (!f.dtype || u?.type === f.dtype)
      && (!f.status || parcelStatus(a, p) === f.status) && (!f.diff || hasDiff(p)) && (!f.nodoc || !u?.file);
  }), [a.parcels, a.usage, f]);
  const total = rows.reduce((s, p) => s + p.areaApp, 0);
  const cur = a.parcels.find(p => p.code === (cmp ?? detail));

  const openCompare = (c: string) => { setCmp(c); setPick("app"); setManual(""); };
  const apply = () => {
    if (!cmp || !cur) return;
    const v = pick === "app" ? cur.areaApp : pick === "doc" ? cur.areaDoc! : Number(manual.replace(",", "."));
    if (!isFinite(v) || v <= 0) return;
    a.confirmArea(cmp, v, pick === "app" ? "ales valoarea ArendaPro" : pick === "doc" ? "aleasă valoarea din document" : "valoare introdusă manual");
    setCmp(null);
  };

  if (err) return <ErrorState onRetry={() => setErr(false)} />;
  if (!a.parcels.length) return <EmptyState icon={<MapPin size={22} />} title="Nu există parcele disponibile" text="Adaugă parcelele fermei înainte de a continua pregătirea dosarului." action={<Btn v="primary">Mergi la Parcelele fermei</Btn>} />;

  return (
    <div>
      {!edit && <ReadOnlyBanner role={ROLE_LABEL[a.role]} />}
      <SectionHeader title="Parcelele declarate" desc="Compară suprafețele din ArendaPro cu cele din documente. Nu alegem noi valoarea corectă." action={<Tabs value={view} onChange={setView} items={[{ v: "tabel", label: "Vizualizare tabel" }, { v: "harta", label: "Vizualizare hartă" }]} />} />
      <Card className="mb-4" pad={false} style={{ padding: 14 }}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          <Select value={f.uat} onChange={v => setF({ ...f, uat: v })}><option value="">Toate localitățile</option>{uniq(p => p.uat).map(x => <option key={x}>{x}</option>)}</Select>
          <Select value={f.cult} onChange={v => setF({ ...f, cult: v })}><option value="">Toate culturile</option>{uniq(p => p.culture).map(x => <option key={x}>{x}</option>)}</Select>
          <Select value={f.owner} onChange={v => setF({ ...f, owner: v })}><option value="">Toți proprietarii</option>{[...new Set(a.usage.map(u => u.owner))].map(x => <option key={x}>{x}</option>)}</Select>
          <Select value={f.dtype} onChange={v => setF({ ...f, dtype: v })}><option value="">Toate tipurile de document</option>{USAGE_TYPES.map(x => <option key={x}>{x}</option>)}</Select>
          <Select value={f.status} onChange={v => setF({ ...f, status: v })}><option value="">Toate statusurile</option><option value="p_ok">Date aparent complete</option><option value="p_verificare">Necesită verificare</option><option value="p_fara_doc">Document lipsă</option><option value="p_exclusa">Exclusă</option></Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[12.5px]">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.diff} onChange={e => setF({ ...f, diff: e.target.checked })} />Doar parcelele cu diferențe</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.nodoc} onChange={e => setF({ ...f, nodoc: e.target.checked })} />Doar parcelele fără document</label>
          <span className="flex-1" /><span style={{ color: C.muted }}>{rows.length} parcele · {ha(total)}</span>
          {(f.uat || f.cult || f.owner || f.dtype || f.status || f.diff || f.nodoc) && <Btn size="sm" v="ghost" onClick={() => setF({ uat: "", cult: "", owner: "", dtype: "", status: "", diff: false, nodoc: false })}>Șterge filtrele</Btn>}
        </div>
      </Card>

      {rows.length === 0 ? <EmptyState icon={<Table2 size={22} />} title="Nicio parcelă pentru filtrele alese" text="Încearcă să elimini unul dintre filtre." /> : view === "tabel" ? (
        bp === "mobile" ? <div className="space-y-2.5">{rows.map(p => <ParcelRow key={p.code} a={a} p={p} mode="card" onOpen={() => setDetail(p.code)} onCompare={() => openCompare(p.code)} />)}</div> : (
          <Card pad={false} className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left">
              <thead><tr style={{ background: "#F7F5EE" }}>{["Bloc fizic", "Parcelă", "Denumire", "Localitate/UAT", "Suprafață ArendaPro", "Suprafață documentată", "Pregătită pentru declarare", "Cultură", "Document de utilizare", "Status", ""].map(h => <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{h}</th>)}</tr></thead>
              <tbody>{rows.map(p => <ParcelRow key={p.code} a={a} p={p} mode="row" onOpen={() => setDetail(p.code)} onCompare={() => openCompare(p.code)} />)}</tbody>
            </table>
          </Card>
        )
      ) : <ParcelMap a={a} rows={rows} onOpen={setDetail} />}

      <Modal open={!!detail && !cmp} onClose={() => setDetail(null)} title={cur ? `Parcela ${cur.code} · ${cur.name}` : ""} desc={cur ? `${cur.uat} · bloc fizic ${cur.bloc}` : ""}>
        {cur && (() => { const u = usageOf(a, cur.code); const st = parcelStatus(a, cur); return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><StatusBadge status={st} />{cur.flagged && <StatusBadge tone="yellow" label="Marcată pentru verificare" />}</div>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div><div className="text-[11.5px] font-semibold" style={{ color: C.muted }}>Cultură</div>{cur.culture}</div>
              <div><div className="text-[11.5px] font-semibold" style={{ color: C.muted }}>Proprietar</div>{u?.owner ?? "—"}</div>
              <div><div className="text-[11.5px] font-semibold" style={{ color: C.muted }}>Document de utilizare</div>{u ? `${u.type} ${u.number}` : "—"}</div>
              <div><div className="text-[11.5px] font-semibold" style={{ color: C.muted }}>Valabil până la</div>{fmtDate(u?.end ?? null)}</div>
            </div>
            {hasDiff(cur) ? <DifferenceIndicator app={cur.areaApp} doc={cur.areaDoc} /> : <div className="rounded-xl p-3 text-[12.5px]" style={{ background: "#F6F4ED" }}>Suprafață ArendaPro: <b>{ha(cur.areaApp)}</b>{cur.areaDoc !== null ? <> · document: <b>{ha(cur.areaDoc)}</b></> : " · nu există suprafață documentată."}</div>}
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => openCompare(cur.code)} disabled={!edit}>Verifică suprafața</Btn>
              <Btn onClick={() => { setDetail(null); a.setSection("usage"); }}>Vezi documentele</Btn>
              <Btn onClick={() => { setDetail(null); a.setSection("interventions"); }}>Selectează intervențiile</Btn>
              <Btn disabled={!edit} onClick={() => a.updateParcel(cur.code, { flagged: !cur.flagged })}>{cur.flagged ? "Scoate marcajul" : "Marchează pentru verificare"}</Btn>
              <Btn v="danger" disabled={!edit} onClick={() => { a.updateParcel(cur.code, { excluded: !cur.excluded }); setDetail(null); }}>{cur.excluded ? "Include în dosar" : "Exclude din pregătirea dosarului"}</Btn>
            </div>
          </div>); })()}
      </Modal>

      <Modal open={!!cmp} onClose={() => setCmp(null)} title={cur ? `Verifică suprafața · ${cur.code}` : ""} desc="Alege tu valoarea pe care o păstrezi în pregătirea dosarului. ArendaPro nu o modifică automat.">
        {cur && (
          <div className="space-y-3">
            {hasDiff(cur) ? <DifferenceIndicator app={cur.areaApp} doc={cur.areaDoc} /> : <div className="rounded-xl p-3 text-[12.5px]" style={{ background: "#F6F4ED" }}>Suprafață ArendaPro: <b>{ha(cur.areaApp)}</b>. {cur.areaDoc === null ? "Nu există o suprafață documentată." : "Valorile coincid."}</div>}
            {([["app", `Folosește suprafața din ArendaPro (${ha(cur.areaApp)})`], ...(cur.areaDoc !== null ? [["doc", `Folosește suprafața din document (${ha(cur.areaDoc)})`]] : []), ["manual", "Introdu altă valoare"]] as [string, string][]).map(([v, t]) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 rounded-xl p-2.5 text-[13px]" style={{ border: `1px solid ${pick === v ? C.primary : C.line}` }}><input type="radio" checked={pick === v} onChange={() => setPick(v as "app")} />{t}</label>
            ))}
            {pick === "manual" && <Field label="Suprafață (ha)"><Input inputMode="decimal" value={manual} onChange={e => setManual(e.target.value)} placeholder="ex. 8,38" /></Field>}
            <div className="flex justify-end gap-2"><Btn onClick={() => setCmp(null)}>Anulează</Btn><Btn v="primary" disabled={!edit || (pick === "manual" && !manual)} onClick={apply}>Confirmă valoarea aleasă</Btn></div>
            {!edit && <p className="text-[12px]" style={{ color: C.muted }}>Rolul curent nu poate modifica suprafețele.</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ParcelMap({ a, rows, onOpen }: { a: Apia; rows: Parcel[]; onOpen: (c: string) => void }) {
  const col: Record<string, string> = { p_ok: "#A9CDB1", p_verificare: "#F1DC86", p_fara_doc: "#F4B987", p_exclusa: "#D8D6CC" };
  return (
    <Card>
      <div className="mb-3 flex flex-wrap gap-3 text-[11.5px]" style={{ color: C.muted }}>{Object.entries({ p_ok: "Date aparent complete", p_verificare: "Necesită verificare", p_fara_doc: "Document lipsă", p_exclusa: "Exclusă" }).map(([k, l]) => <span key={k} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: col[k] }} />{l}</span>)}</div>
      <svg viewBox="0 0 720 420" className="w-full rounded-xl" style={{ background: "#F3F1E6" }} role="img" aria-label="Schemă orientativă a parcelelor">
        {rows.map((p, i) => {
          const c = i % 6, r = Math.floor(i / 6); const x = 14 + c * 117, y = 14 + r * 100; const w = 108 - (i % 3) * 6, h = 90 - (i % 4) * 4;
          return (
            <g key={p.code} tabIndex={0} role="button" aria-label={`Parcela ${p.code}`} onClick={() => onOpen(p.code)} onKeyDown={e => e.key === "Enter" && onOpen(p.code)} style={{ cursor: "pointer" }}>
              <polygon points={`${x},${y + 6} ${x + w - 8},${y} ${x + w},${y + h - 10} ${x + 10},${y + h}`} fill={col[parcelStatus(a, p)]} stroke="#fff" strokeWidth="2" />
              <text x={x + 12} y={y + 28} fontSize="14" fontWeight="800" fill="#1E2A22">{p.code}</text>
              <text x={x + 12} y={y + 46} fontSize="10.5" fill="#44524A">{fmt(p.areaApp)} ha</text>
              <text x={x + 12} y={y + 60} fontSize="9.5" fill="#44524A">{p.culture.slice(0, 16)}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-[11.5px]" style={{ color: C.muted }}>Schemă orientativă. Nu reprezintă delimitarea reală a parcelelor. Pentru harta reală, folosește „Hartă Parcele”.</p>
    </Card>
  );
}
