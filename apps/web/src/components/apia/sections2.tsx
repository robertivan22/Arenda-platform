import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, FileText, Sparkles, Sprout, Wand2 } from "lucide-react";
import { C, Intervention, IV_CATS, SOURCE_LABEL, STATUS, TONES, USAGE_TYPES, UsageDoc, ha, fmt } from "./data";
import type { Apia } from "./useApia";
import type { SP } from "./sections1";
import {
  Btn, Card, ChecklistItem, csv, Disclaimer, DocumentUploader, download, EmptyState, Field, H, Input, Modal, ProgressBar, ReadOnlyBanner,
  SectionHeader, Select, StatusBadge, fmtDate, WarningCard, inputStyle, inputCls,
} from "./ui";
import { ROLE_LABEL } from "./data";

// ── Documente de utilizare ───────────────────────────────────────────────────
function Timeline({ u, today }: { u: UsageDoc; today: string }) {
  if (!u.start && !u.end) return <div className="text-[12px]" style={{ color: C.muted }}>Fără dată de expirare</div>;
  if (!u.end) return <div className="text-[12px]" style={{ color: C.muted }}>Valabil de la {fmtDate(u.start)} · fără dată de expirare</div>;
  const e = +new Date(u.end), r = +new Date(today), s = u.start ? +new Date(u.start) : r - 1000 * 3600 * 24 * 365;
  const pct = Math.max(0, Math.min(100, ((r - s) / (e - s)) * 100));
  const expired = r > e; const soon = !expired && e - r < 1000 * 3600 * 24 * 180;
  const color = expired ? "#D8412F" : soon ? "#D4A514" : "#4E8B62";
  return (
    <div>
      <div className="relative h-2 rounded-full" style={{ background: "#ECE9DF" }}>
        <div className="h-full rounded-full" style={{ width: `${expired ? 100 : pct}%`, background: color }} />
        {!expired && <span className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 bg-white" style={{ left: `calc(${pct}% - 7px)`, borderColor: color }} title={`Data de referință ${fmtDate(today)}`} />}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px]" style={{ color: C.muted }}><span>{fmtDate(u.start)}</span><span style={{ color: expired ? "#A5281B" : C.text, fontWeight: 600 }}>{expired ? `Expirat la ${fmtDate(u.end)}` : `Valabil până la ${fmtDate(u.end)}`}</span></div>
    </div>
  );
}

export function Usage({ a }: SP) {
  const edit = a.can("usage");
  const [flt, setFlt] = useState("");
  const list = a.usage.filter(u => !flt || u.status === flt);
  return (
    <div>
      {!edit && <ReadOnlyBanner role={ROLE_LABEL[a.role]} />}
      <SectionHeader title="Documente de utilizare" desc="Registrul documentelor care justifică folosirea terenurilor. Un document încărcat nu înseamnă că este acceptat de APIA." action={
        <Select className="!w-auto" value={flt} onChange={setFlt}><option value="">Toate statusurile</option>{["u_valabil", "u_curand", "u_expirat", "u_fisier", "u_incomplet", "u_verificare"].map(k => <option key={k} value={k}>{STATUS[k].label}</option>)}</Select>} />
      <div className="mb-4 flex flex-wrap gap-1.5">{USAGE_TYPES.map(t => <span key={t} className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: "#F1EFE6", color: C.muted }}>{t}</span>)}</div>
      <div className="space-y-3">
        {list.map(u => {
          const area = u.parcels.reduce((s, c) => s + (a.parcels.find(p => p.code === c)?.areaApp ?? 0), 0);
          const needsVerify = u.status === "u_curand" || u.status === "u_verificare";
          return (
            <Card key={u.id}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-[200px] flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{u.type}</div>
                  <div className="text-[15px] font-extrabold" style={H}>Nr. {u.number}</div>
                  <div className="text-[12.5px]" style={{ color: C.muted }}>{u.owner}</div>
                </div>
                <StatusBadge status={u.status} />
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-[1fr_1fr]">
                <div className="space-y-2 text-[12.5px]">
                  <div><span style={{ color: C.muted }}>Parcele asociate: </span>{u.parcels.map(c => <button key={c} onClick={() => { a.setFocusParcel(c); a.setSection("parcels"); }} className="mr-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-bold hover:underline" style={{ background: "#EDF3EC", color: C.primary }}>{c}</button>)}</div>
                  <div><span style={{ color: C.muted }}>Suprafață: </span><b>{ha(area)}</b></div>
                  <div><span style={{ color: C.muted }}>Fișier: </span>{u.file ? <><b>{u.file}</b> · <span style={{ color: C.muted }}>Document disponibil pentru verificare</span></> : <b style={{ color: "#A24A07" }}>Lipsește fișierul</b>}</div>
                </div>
                <Timeline u={u} today={a.today} />
              </div>
              {edit && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="min-w-[220px] flex-1"><DocumentUploader compact label={u.file ? "Încarcă o versiune nouă" : "Încarcă documentul"} onFile={(_n, _s, f) => void a.uploadUsageFile(u.id, f)} /></div>
                  {needsVerify && (() => { const w = a.warnings.find(x => !x.resolved && (x.id.startsWith("DOC_EXPIRING:") || x.id.startsWith("DOC_INCOMPLETE:")) && x.id.endsWith(`:${u.id}`)); return w ? <Btn onClick={() => a.resolve(w.id, "confirmat de utilizator")}>Am verificat documentul</Btn> : null; })()}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Culturi ──────────────────────────────────────────────────────────────────
const PALETTE = ["#1F4D36", "#6B8F71", "#C9A227", "#D97706", "#8AA7C7", "#A0856C", "#B9C6A8"];
export function Cultures({ a }: SP) {
  const [openC, setOpenC] = useState<string | null>(null);
  const groups = useMemo(() => {
    const m = new Map<string, typeof a.parcels>();
    a.parcels.filter(p => !p.excluded).forEach(p => m.set(p.culture, [...(m.get(p.culture) ?? []), p]));
    return [...m.entries()].map(([name, ps]) => {
      const codes = ps.map(p => p.code);
      const warns = a.open.filter(w => w.parcels?.some(c => codes.includes(c)) && w.sev !== "recomandare");
      const ivs = a.ivs.filter(i => i.selected && (i.cultures === null || i.cultures.includes(name)));
      return { name, ps, area: ps.reduce((s, p) => s + p.areaApp, 0), warns, ivs };
    }).sort((x, y) => y.area - x.area);
  }, [a.parcels, a.open, a.ivs]);
  const total = groups.reduce((s, g) => s + g.area, 0);
  return (
    <div>
      <SectionHeader title="Culturi" desc="Parcelele grupate după cultură. Nu schimbăm cultura unei parcele fără confirmarea ta." />
      <Card className="mb-4">
        <div className="mb-2 text-[12px] font-semibold" style={{ color: C.muted }}>Ponderea culturilor în suprafața totală ({ha(total)})</div>
        <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label="Ponderea culturilor">{groups.map((g, i) => <div key={g.name} title={`${g.name}: ${ha(g.area)}`} style={{ width: `${(g.area / total) * 100}%`, background: PALETTE[i % PALETTE.length] }} />)}</div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{groups.map((g, i) => <span key={g.name} className="flex items-center gap-1.5 text-[11.5px]" style={{ color: C.muted }}><span className="h-2.5 w-2.5 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />{g.name} · {Math.round((g.area / total) * 100)}%</span>)}</div>
      </Card>
      <Card pad={false} className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead><tr style={{ background: "#F7F5EE" }}>{["Cultură", "Parcele", "Suprafață", "Intervenții asociate", "Avertizări", "Verificare", ""].map(h => <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{h}</th>)}</tr></thead>
          <tbody>
            {groups.map(g => (
              <>
                <tr key={g.name} className="border-t" style={{ borderColor: C.lineSoft }}>
                  <td className="px-3 py-3 text-[13px] font-bold">{g.name}</td>
                  <td className="px-3 py-3 text-[13px]">{g.ps.length}</td>
                  <td className="px-3 py-3 text-[13px] font-semibold">{ha(g.area)}</td>
                  <td className="px-3 py-3 text-[12px]">{g.ivs.map(i => i.code).join(", ") || "—"}</td>
                  <td className="px-3 py-3 text-[12.5px]">{g.warns.length || "—"}</td>
                  <td className="px-3 py-3"><StatusBadge small status={g.warns.length ? "s_verificare" : "s_complet"} /></td>
                  <td className="px-3 py-3"><button onClick={() => setOpenC(openC === g.name ? null : g.name)} className="rounded-lg p-1 hover:bg-[#F3F1E8]" aria-label="Detalii">{openC === g.name ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button></td>
                </tr>
                {openC === g.name && <tr key={g.name + "x"} style={{ background: "#FBFAF5" }}><td colSpan={7} className="px-4 py-3"><div className="flex flex-wrap gap-2">{g.ps.map(p => <button key={p.code} onClick={() => { a.setFocusParcel(p.code); a.setSection("parcels"); }} className="rounded-lg px-2.5 py-1.5 text-[12px]" style={{ background: "#fff", border: `1px solid ${C.line}` }}><b>{p.code}</b> · {ha(p.areaApp)}</button>)}</div>
                  {g.warns.length > 0 && <ul className="mt-2 space-y-1 text-[12px]" style={{ color: C.muted }}>{g.warns.map(w => <li key={w.id}>• {w.title}</li>)}</ul>}</td></tr>}
              </>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Intervenții ──────────────────────────────────────────────────────────────
const parcelsFor = (a: Apia, iv: Intervention) => a.parcels.filter(p => !p.excluded && (iv.parcelIds?.length ? iv.parcelIds.includes(p.id) : true));

export function InterventionCard({ a, iv, open, onToggle, edit }: { a: Apia; iv: Intervention; open: boolean; onToggle: () => void; edit: boolean }) {
  const st = a.ivStatus(iv); const ps = parcelsFor(a, iv); const req = a.ivReq(iv);
  const rel = a.warnings.filter(w => iv.rel.includes(w.id) && !w.resolved);
  const nb = iv.notebook ? a.notebooks.find(n => n.id === iv.notebook) : null;
  return (
    <Card pad={false} style={{ borderColor: iv.selected ? "#CBE1D0" : C.line }}>
      <div className="flex flex-wrap items-start gap-3 p-4">
        <span className="rounded-lg px-2 py-1 text-[12px] font-extrabold" style={{ background: "#EDF3EC", color: C.primary, ...H }}>{iv.code}</span>
        <div className="min-w-[220px] flex-1">
          <div className="text-[14px] font-bold leading-snug" style={H}>{iv.name}</div>
          <div className="mt-0.5 text-[12px]" style={{ color: C.muted }}>{iv.cat} · {ps.length} parcele · {req.length} documente configurate{nb ? " · 1 caiet" : ""}{rel.length ? ` · ${rel.length} avertizări` : ""}</div>
        </div>
        <StatusBadge status={st} />
        <Btn size="sm" onClick={onToggle} icon={open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}>Vezi detalii</Btn>
      </div>
      {open && (
        <div className="space-y-4 border-t p-4" style={{ borderColor: C.lineSoft }}>
          <p className="text-[13px]" style={{ color: C.muted }}>{iv.desc}</p>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Informații și documente necesare</div>
              {req.map(d => <ChecklistItem key={d.label} ok={d.ok} label={d.label} />)}
              {nb && <div className="mt-2"><Btn size="sm" icon={<BookOpen size={13} />} onClick={() => { a.setOpenNb(nb.id); a.setSection("notebooks"); }}>Deschide caietul asociat</Btn></div>}
            </div>
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Parcele asociate ({ps.length})</div>
              <div className="flex max-h-[96px] flex-wrap gap-1.5 overflow-y-auto">{ps.length ? ps.map(p => <span key={p.code} className="rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold" style={{ background: "#F1EFE6" }}>{p.code}</span>) : <span className="text-[12px]" style={{ color: C.muted }}>Nicio parcelă asociată.</span>}</div>
              {iv.needsParcels && edit && (
                <div className="mt-2"><div className="mb-1 text-[11.5px] font-semibold" style={{ color: C.muted }}>Alege parcelele</div>
                  <div className="flex max-h-[96px] flex-wrap gap-1.5 overflow-y-auto">{a.parcels.filter(p => !p.excluded).map(p => { const on = !!iv.parcelIds?.includes(p.id); return <button key={p.id} onClick={() => a.setIvParcels(iv.code, on ? iv.parcelIds!.filter(x => x !== p.id) : [...(iv.parcelIds ?? []), p.id])} className="rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold" style={{ background: on ? C.primary : "#fff", color: on ? "#fff" : C.text, border: `1px solid ${on ? C.primary : C.line}` }}>{p.code}</button>; })}</div></div>
              )}
              <div className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Verificări ArendaPro</div>
              <ul className="space-y-1.5 text-[12.5px]">{iv.checks.map(c => <li key={c.text} className="flex items-start gap-2"><span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: c.kind === "matematic" ? "#EAF1FF" : "#F1ECFF", color: c.kind === "matematic" ? "#1E4FBF" : "#5B2FC2" }}>{c.kind === "matematic" ? "Matematică" : "Administrativă"}</span>{c.text}</li>)}</ul>
            </div>
          </div>
          {rel.length > 0 && <div className="space-y-2">{rel.map(w => <WarningCard key={w.id} w={w} compact onGo={() => a.setSection(w.section)} />)}</div>}
          <Field label="Observațiile tale"><textarea disabled={!edit} defaultValue={iv.note} onBlur={e => { if (e.target.value !== iv.note) a.setIvNote(iv.code, e.target.value); }} rows={2} className={inputCls} style={inputStyle} placeholder="Notează aici ce ai de verificat." /></Field>
          <Disclaimer>Verificarea ArendaPro este orientativă și nu înlocuiește evaluarea realizată de APIA.</Disclaimer>
          <div className="flex justify-end"><Btn v={iv.selected ? "secondary" : "primary"} disabled={!edit} onClick={() => a.toggleIv(iv.code)}>{iv.selected ? "Elimină din pregătire" : "Selectează pentru pregătire"}</Btn></div>
        </div>
      )}
    </Card>
  );
}

export function Interventions({ a }: SP) {
  const edit = a.can("interventions");
  const [cat, setCat] = useState<string>("");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [wiz, setWiz] = useState(false);
  const list = a.ivs.filter(i => !cat || i.cat === cat);
  const none = a.ivs.every(i => !i.selected);
  return (
    <div>
      {!edit && <ReadOnlyBanner role={ROLE_LABEL[a.role]} />}
      <SectionHeader title="Intervenții și scheme solicitate" desc="Selectează intervențiile pe care dorești să le pregătești și verifică informațiile necesare pentru fiecare." action={<Btn v="primary" disabled={!edit} icon={<Wand2 size={14} />} onClick={() => setWiz(true)}>Ajută-mă să identific intervențiile</Btn>} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {["", ...IV_CATS].map(c => <button key={c} onClick={() => setCat(c)} className="rounded-full px-3 py-1.5 text-[12px] font-semibold transition" style={{ background: cat === c ? C.primary : "#fff", color: cat === c ? "#fff" : C.text, border: `1px solid ${cat === c ? C.primary : C.line}` }}>{c || "Toate"}</button>)}
      </div>
      {none && <div className="mb-4"><EmptyState icon={<Sprout size={22} />} title="Nu ai selectat nicio intervenție" text="Adaugă intervențiile pe care dorești să le analizezi pentru campania curentă." action={<Btn v="primary" onClick={() => setWiz(true)}>Selectează intervenții</Btn>} /></div>}
      <div className="space-y-2.5">
        {list.length === 0 && <p className="text-[13px]" style={{ color: C.muted }}>Nu există intervenții în această categorie.</p>}
        {list.map(i => <InterventionCard key={i.code} a={a} iv={i} edit={edit} open={openCode === i.code} onToggle={() => setOpenCode(openCode === i.code ? null : i.code)} />)}
      </div>
      <p className="mt-3 text-[11.5px]" style={{ color: C.muted }}>Catalogul de intervenții este versionat{a.ivs[0]?.ruleVersion ? ` (${a.ivs[0].ruleVersion})` : ""}. Verifică ghidul oficial al campaniei.</p>
      <Wizard a={a} open={wiz} onClose={() => setWiz(false)} />
    </div>
  );
}

const STEPS = ["Tipul exploatației", "Suprafață și culturi", "Animale", "Practici și angajamente"];
function Wizard({ a, open, onClose }: { a: Apia; open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState("");
  const [area, setArea] = useState(() => a.parcels.filter(p => !p.excluded).reduce((s, p) => s + p.areaApp, 0).toFixed(2).replace(".", ","));
  const [cults, setCults] = useState<string[]>(() => [...new Set(a.parcels.map(p => p.culture).filter(Boolean))]);
  const [animals, setAnimals] = useState<string[]>([]);
  const [pr, setPr] = useState<string[]>([]);
  const tog = (arr: string[], v: string, set: (x: string[]) => void) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  const chips = (opts: string[], val: string[], set: (x: string[]) => void) => <div className="flex flex-wrap gap-2">{opts.map(o => <button key={o} onClick={() => tog(val, o, set)} className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold" style={{ background: val.includes(o) ? C.primary : "#fff", color: val.includes(o) ? "#fff" : C.text, border: `1px solid ${val.includes(o) ? C.primary : C.line}` }}>{o}</button>)}</div>;
  const ha_ = Number(area.replace(",", ".")) || 0;
  const sugg = useMemo(() => {
    const s: { code: string; why: string; check: string }[] = [{ code: "PS1-1", why: "Se analizează de regulă pentru orice exploatație cu teren agricol.", check: "Documentele de utilizare pentru toate parcelele." }];
    if (ha_ > 0 && ha_ <= 100) s.push({ code: "PS1-2", why: `Suprafața de ${fmt(ha_)} ha poate fi relevantă pentru sprijinul redistributiv.`, check: "Pragurile de suprafață și zona din ghidul campaniei." });
    if (pr.includes("Tânăr fermier")) s.push({ code: "PS2", why: "Ai indicat că ai statut de tânăr fermier.", check: "Vârsta și data instalării în agricultură." });
    if (cults.some(c => /Grâu/i.test(c))) s.push({ code: "ANT-1", why: "Ai culturi de grâu.", check: "Suprafața cultivată și documentele pentru sămânță." });
    if (cults.some(c => /Soia/i.test(c))) s.push({ code: "ANT-9", why: "Ai culturi de soia.", check: "Suprafața cultivată și documentele pentru sămânță." });
    if (cults.some(c => /Floarea/i.test(c))) s.push({ code: "ANT-10", why: "Ai culturi de floarea-soarelui.", check: "Suprafața cultivată." });
    if (cults.some(c => /Rapiț/i.test(c))) s.push({ code: "ANT-11", why: "Ai culturi de rapiță.", check: "Suprafața cultivată." });
    if (cults.some(c => /Pajiș/i.test(c))) s.push({ code: "ECO-M2", why: "Ai indicat terenuri cu pajiști.", check: "Tipul de utilizare al terenului." });
    if (cults.length) s.push({ code: "ECO-M1", why: "Ai culturi pe teren arabil.", check: "Rotația, culturile de acoperire și evidențele din caiet." });
    if (animals.includes("Bovine")) s.push({ code: "ANT-12", why: "Ai bovine în exploatație.", check: "Efectivul din BND și adeverința ANSVSA." });
    if (animals.includes("Ovine / caprine")) s.push({ code: "ANT-14", why: "Ai ovine sau caprine.", check: "Efectivul minim și perioada de deținere." });
    return s.filter(x => a.ivs.some(i => i.code === x.code));
  }, [ha_, pr, cults, animals]);
  const reset = () => { setStep(0); onClose(); };
  return (
    <Modal open={open} onClose={reset} wide title={step < 4 ? `Pasul ${step + 1} din 4 · ${STEPS[step]}` : "Intervenții care pot fi analizate"} desc={step < 4 ? "Răspunsurile te ajută să vezi ce merită analizat. Nu înseamnă că ești eligibil." : "Sunt doar sugestii pentru analiză. Decizia îți aparține."}>
      <div className="mb-4 flex gap-1.5">{STEPS.map((_, i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= Math.min(step, 3) ? C.primary : "#ECE9DF" }} />)}</div>
      {step === 0 && <Field label="Tipul exploatației"><Select value={type} onChange={setType}><option value="">Alege</option>{["Societate comercială", "Persoană fizică autorizată", "Întreprindere individuală", "Persoană fizică", "Cooperativă / asociație"].map(o => <option key={o}>{o}</option>)}</Select></Field>}
      {step === 1 && <div className="space-y-4"><Field label="Suprafața agricolă totală (ha)"><Input inputMode="decimal" value={area} onChange={e => setArea(e.target.value)} /></Field><div><div className="mb-1.5 text-[11.5px] font-semibold" style={{ color: C.muted }}>Culturi</div>{chips([...new Set(["Grâu de toamnă", "Porumb", "Floarea-soarelui", "Rapiță", "Soia", "Orz de toamnă", "Pajiști", ...cults])], cults, setCults)}</div></div>}
      {step === 2 && <div><div className="mb-1.5 text-[11.5px] font-semibold" style={{ color: C.muted }}>Ce animale ai? (poți lăsa gol)</div>{chips(["Bovine", "Ovine / caprine", "Porcine", "Păsări", "Albine"], animals, setAnimals)}</div>}
      {step === 3 && <div><div className="mb-1.5 text-[11.5px] font-semibold" style={{ color: C.muted }}>Practici și angajamente</div>{chips(["Tânăr fermier", "Rotația culturilor", "Culturi de acoperire", "Angajamente pe mai mulți ani"], pr, setPr)}</div>}
      {step === 4 && <div className="space-y-2.5">{sugg.map(s => { const iv = a.ivs.find(i => i.code === s.code)!; return (
        <div key={s.code} className="rounded-xl p-3.5" style={{ border: `1px solid ${C.line}` }}>
          <div className="flex flex-wrap items-center gap-2"><b style={{ color: C.primary }}>{s.code}</b><span className="flex-1 text-[13px] font-semibold">{iv.name}</span>{iv.selected ? <StatusBadge status="i_selectata" small /> : <Btn size="sm" v="primary" onClick={() => a.toggleIv(s.code)}>Adaugă pentru analiză</Btn>}</div>
          <p className="mt-1 text-[12.5px]"><b>De ce:</b> {s.why}</p><p className="text-[12.5px]" style={{ color: C.muted }}><b>De verificat:</b> {s.check}</p>
        </div>); })}</div>}
      <div className="mt-5 flex justify-between">
        <Btn disabled={step === 0} onClick={() => setStep(step - 1)}>Înapoi</Btn>
        {step < 4 ? <Btn v="primary" onClick={() => setStep(step + 1)}>{step === 3 ? "Vezi intervențiile" : "Continuă"}</Btn> : <Btn v="primary" onClick={reset}>Gata</Btn>}
      </div>
    </Modal>
  );
}

// ── Caiete ───────────────────────────────────────────────────────────────────
export function Notebooks({ a }: SP) {
  const edit = a.can("notebooks");
  const active = a.notebooks.filter(n => a.ivs.find(i => i.code === n.interv)?.selected);
  const nb = a.notebooks.find(n => n.id === a.openNb);
  const [add, setAdd] = useState(false);
  const [fp, setFp] = useState("");
  const [form, setForm] = useState({ date: a.today, parcel: "", activity: "Fertilizare", input: "", qty: "", note: "", doc: "" });
  const [histOpen, setHistOpen] = useState(false);

  if (!active.length) return <EmptyState icon={<BookOpen size={22} />} title="Nu ai selectat nicio intervenție" text="Caietele apar după ce adaugi intervențiile pe care dorești să le analizezi." action={<Btn v="primary" onClick={() => a.setSection("interventions")}>Selectează intervenții</Btn>} />;

  if (nb) {
    const rows = nb.entries.filter(e => !fp || e.parcel === fp);
    const parcelOpts = a.parcels.filter(p => !p.excluded);
    const pct = nb.target ? Math.min(100, Math.round((nb.entries.length / nb.target) * 100)) : nb.entries.length ? 100 : 0;
    const sugg = (nb.suggestions ?? []).filter(s => s.status !== "ACCEPTED" && s.status !== "EXCLUDED");
    return (
      <div>
        {!edit && <ReadOnlyBanner role={ROLE_LABEL[a.role]} />}
        <button onClick={() => a.setOpenNb(null)} className="mb-3 text-[12.5px] font-semibold" style={{ color: C.primary }}>← Toate caietele</button>
        <SectionHeader title={nb.name} desc={`Evidențe pentru ${nb.interv}, campania ${a.campaign}.`} action={<div className="flex flex-wrap gap-2">
          <Btn disabled={!edit} onClick={() => setAdd(true)} v="primary">Adaugă activitate</Btn>
          <Btn onClick={() => setHistOpen(true)}>Istoric modificări</Btn>
          <Btn onClick={() => download(`${nb.name}.csv`, csv([["Dată", "Parcelă", "Cultură", "Activitate", "Suprafață (ha)", "Produs/input", "Cantitate", "Document", "Înregistrat de", "Observații"], ...nb.entries.map(e => [fmtDate(e.date), e.parcel, e.culture, e.activity, e.area, e.input, e.qty, e.doc, e.by, e.note])]))}>Exportă</Btn></div>} />
        <Card className="mb-4"><div className="flex items-center gap-3"><div className="flex-1"><ProgressBar value={pct} /></div><span className="text-[13px] font-bold">{pct}%</span><StatusBadge status={a.nbStatus(nb)} /></div>
          <p className="mt-2 text-[12px]" style={{ color: C.muted }}>{nb.entries.length} din {nb.target} activități estimate înregistrate.</p>
          {!nb.confirmed && nb.entries.length < nb.target && <Btn size="sm" className="mt-2" disabled={!edit} onClick={() => a.confirmNotebook(nb.id)}>Confirm că le-am înregistrat pe toate</Btn>}</Card>
        {a.plannedSkipped > 0 && <p className="mb-3 rounded-lg p-2.5 text-[12px]" style={{ background: "#EAF1FF", color: "#1E4FBF" }}>{a.plannedSkipped} lucrări planificate (neïnalizate) nu sunt propuse în caiet. Doar lucrările finalizate pot fi sugerate.</p>}
        {sugg.length > 0 && (
          <Card className="mb-4">
            <div className="mb-2 text-[13px] font-bold" style={H}>Sugestii din datele ArendaPro ({sugg.length})</div>
            <p className="mb-3 text-[12px]" style={{ color: C.muted }}>Nu intră în caiet până nu le accepți. Decizia și verificarea îi aparțin.</p>
            <div className="space-y-2">{sugg.map(s => (
              <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl p-2.5 text-[12.5px]" style={{ border: `1px solid ${C.lineSoft}` }}>
                <div className="min-w-[220px] flex-1">
                  <b>{fmtDate(s.date)}</b> · {s.parcel || "fără parcelă"} · {s.activity}{s.input ? ` · ${s.input}` : ""}{s.qty ? ` · ${s.qty}` : ""}
                  <div className="text-[11px]" style={{ color: C.muted }}>{s.sourceType ? SOURCE_LABEL[s.sourceType] : ""}{s.status === "SOURCE_CHANGED" ? " · sursa s-a modificat după acceptare, verifică" : ""}</div>
                  {s.issues?.length ? <div className="text-[11px]" style={{ color: "#A24A07" }}>{s.issues.join(" · ")}</div> : null}
                </div>
                <Btn size="sm" v="primary" disabled={!edit} onClick={() => a.decideRow(nb.id, s, "ACCEPTED")}>Acceptă</Btn>
                <Btn size="sm" disabled={!edit} onClick={() => a.decideRow(nb.id, s, "NEEDS_REVIEW")}>De verificat</Btn>
                <Btn size="sm" disabled={!edit} onClick={() => a.decideRow(nb.id, s, "EXCLUDED", "exclus de utilizator")}>Exclude</Btn>
              </div>))}</div>
          </Card>
        )}
        <div className="mb-3 max-w-[220px]"><Select value={fp} onChange={setFp}><option value="">Toate parcelele</option>{[...new Set(nb.entries.map(e => e.parcel))].map(p => <option key={p}>{p}</option>)}</Select></div>
        <Card pad={false} className="overflow-x-auto"><table className="w-full min-w-[900px] text-left">
          <thead><tr style={{ background: "#F7F5EE" }}>{["Dată", "Parcelă", "Cultură", "Activitate", "Suprafață", "Produs / input", "Cantitate", "Document", "Înregistrat de", "Observații"].map(h => <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(e => <tr key={e.id} className="border-t text-[12.5px]" style={{ borderColor: C.lineSoft }}>
            <td className="px-3 py-2.5">{fmtDate(e.date)}</td><td className="px-3 py-2.5 font-bold">{e.parcel}</td><td className="px-3 py-2.5">{e.culture}</td><td className="px-3 py-2.5">{e.activity}</td><td className="px-3 py-2.5">{ha(e.area)}</td><td className="px-3 py-2.5">{e.input}</td><td className="px-3 py-2.5">{e.qty}</td>
            <td className="px-3 py-2.5">{e.doc ? <span className="inline-flex items-center gap-1"><FileText size={12} />{e.doc}</span> : <span style={{ color: "#A24A07" }}>Fără document</span>}</td><td className="px-3 py-2.5">{e.by}</td><td className="px-3 py-2.5" style={{ color: C.muted }}>{e.note || "—"}{e.issues?.length ? <div style={{ color: "#A24A07" }}>{e.issues.join(" · ")}</div> : null}</td></tr>)}</tbody></table></Card>
        <Modal open={add} onClose={() => setAdd(false)} title="Adaugă activitate" desc={`În ${nb.name}`}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dată"><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Parcelă"><Select value={form.parcel} onChange={v => setForm({ ...form, parcel: v })}><option value="">Alege</option>{parcelOpts.map(p => <option key={p.code} value={p.code}>{p.code} · {p.culture}</option>)}</Select></Field>
            <Field label="Activitate"><Select value={form.activity} onChange={v => setForm({ ...form, activity: v })}>{["Semănat", "Fertilizare", "Erbicidare", "Fungicidare", "Recoltat", "Lucrare sol"].map(o => <option key={o}>{o}</option>)}</Select></Field>
            <Field label="Produs sau input"><Input value={form.input} onChange={e => setForm({ ...form, input: e.target.value })} /></Field>
            <Field label="Cantitate"><Input value={form.qty} onChange={e => setForm({ ...form, qty: e.target.value })} placeholder="ex. 200 kg" /></Field>
            <Field label="Observații"><Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
          </div>
          <div className="mt-3"><DocumentUploader compact label={form.doc ? `Atașat: ${form.doc}` : "Atașează document justificativ"} onFile={n => setForm({ ...form, doc: n })} /></div>
          <div className="mt-4 flex justify-end gap-2"><Btn onClick={() => setAdd(false)}>Anulează</Btn><Btn v="primary" disabled={!form.parcel} onClick={() => { const p = a.parcels.find(x => x.code === form.parcel)!; a.addActivity(nb.id, { date: form.date, parcel: p.code, parcelId: p.id, culture: p.culture, activity: form.activity, area: p.areaApp, input: form.input, qty: form.qty, doc: form.doc, by: a.scope?.userEmail ?? "", note: form.note }); setAdd(false); setForm({ ...form, input: "", qty: "", note: "", doc: "" }); }}>Salvează</Btn></div>
        </Modal>
        <Modal open={histOpen} onClose={() => setHistOpen(false)} title="Istoric modificări"><ul className="space-y-2 text-[13px]">{nb.history.map(h => <li key={h} className="rounded-lg p-2.5" style={{ background: "#F6F4ED" }}>{h}</li>)}</ul></Modal>
      </div>
    );
  }
  return (
    <div>
      <SectionHeader title="Eco-scheme și caiete" desc="Evidențele asociate intervențiilor selectate." />
      <div className="grid gap-4 md:grid-cols-2">
        {active.map(n => {
          const iv = a.ivs.find(i => i.code === n.interv)!; const pct = n.target ? Math.min(100, Math.round((n.entries.length / n.target) * 100)) : n.entries.length ? 100 : 0;
          const last = [...n.entries].sort((x, y) => y.date.localeCompare(x.date))[0];
          return (
            <Card key={n.id}>
              <div className="flex items-start gap-2"><div className="flex-1"><div className="text-[15px] font-extrabold" style={H}>{n.name}</div><div className="text-[12px]" style={{ color: C.muted }}>{iv.name}</div></div><StatusBadge status={a.nbStatus(n)} small /></div>
              <div className="mt-3 flex items-center gap-2"><div className="flex-1"><ProgressBar value={pct} h={7} /></div><span className="text-[12px] font-bold">{pct}%</span></div>
              <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-[12.5px]"><dt style={{ color: C.muted }}>Campanie</dt><dd>{a.campaign}</dd><dt style={{ color: C.muted }}>Parcele asociate</dt><dd>{parcelsFor(a, iv).length}</dd><dt style={{ color: C.muted }}>Ultima înregistrare</dt><dd>{fmtDate(last?.date ?? null)}</dd><dt style={{ color: C.muted }}>Activități</dt><dd>{n.entries.length}</dd><dt style={{ color: C.muted }}>Documente atașate</dt><dd>{n.entries.filter(e => e.doc).length}</dd><dt style={{ color: C.muted }}>Avertizări</dt><dd>{a.open.filter(w => w.id.startsWith("NB_") && w.id.endsWith(`:${n.interv}`)).length}</dd></dl>
              <Btn className="mt-4" v="primary" onClick={() => a.setOpenNb(n.id)}>Deschide caietul</Btn>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
