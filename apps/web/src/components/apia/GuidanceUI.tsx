"use client";
import { useState } from "react";
import { BookOpen, ExternalLink, Info } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./primitives";
import { C, SECTION_TITLES, SectionKey } from "./data";
import { Btn, Card, Disclaimer, H, SectionHeader } from "./ui";
import type { Apia } from "./useApia";
import {
  CONTENT_META, FAQ, GLOSSARY, GUIDANCE_BANNER, GUIDANCE_UPDATED, GUIDANCE_VERSION, NO_GUIDANCE, OFFICIAL_SOURCES, SOURCE_STATUS_LABEL, STEPS,
  GuideItem, guideFor, hasGuidance, isSafeOfficialUrl, searchGuidance, sourcesFor, ContentType, OfficialSource,
} from "./guidance";

function TypeBadge({ type }: { type: ContentType }) {
  const m = CONTENT_META[type];
  return <span className="rounded px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: m.bg, color: m.fg }}>{m.label}</span>;
}

function SourceLink({ s }: { s: OfficialSource }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px]" style={{ background: "#F5F8FF", border: "1px solid #D5E2F7" }}>
      <span className="rounded px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: "#E8F0FA", color: "#1E4FBF" }}>Document oficial extern</span>
      <span className="min-w-[140px] flex-1 font-semibold">{s.title}</span>
      <span className="text-[11px]" style={{ color: C.muted }}>{SOURCE_STATUS_LABEL[s.status]}</span>
      {isSafeOfficialUrl(s.url) && <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold" style={{ color: "#464feb", textDecoration: "none" }}>Deschide sursa oficială <ExternalLink size={12} /></a>}
    </div>
  );
}

function ItemCard({ g, year }: { g: GuideItem; year: number }) {
  const srcs = sourcesFor(g.sourceIds, year);
  return (
    <div className="space-y-2 rounded-xl bg-white p-3.5" style={{ border: `1px solid ${C.line}` }}>
      <div className="flex flex-wrap items-center gap-2"><TypeBadge type={g.type} /><span className="text-[11px]" style={{ color: C.muted }}>Campania {year} · v{GUIDANCE_VERSION}</span></div>
      <div className="text-[14px] font-bold" style={H}>{g.title}</div>
      <p className="text-[13px] leading-relaxed" style={{ color: C.muted }}>{g.text}</p>
      {srcs.map(s => <SourceLink key={s.id} s={s} />)}
    </div>
  );
}

// Buton fix în colțul din dreapta sus al fiecărei pagini a dosarului.
export function GuideButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="mb-3 flex justify-end">
      <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold hover:bg-white" style={{ color: "#464feb", border: "1px solid #D9DCFA", background: "#F6F7FF" }}>
        <Info size={14} /> Vezi ghidajul pentru această secțiune
      </button>
    </div>
  );
}

// Drawer: nu demontează pagina curentă, deci datele din formular se păstrează.
export function GuidanceDrawer({ a, open, onOpenChange }: { a: Apia; open: boolean; onOpenChange: (o: boolean) => void }) {
  const year = Number(a.campaign); const sec = a.section;
  const items = guideFor(sec, year);
  const warns = a.warnings.filter(w => w.section === sec && !w.resolved).slice(0, 5);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[92vw] max-w-[440px] overflow-y-auto p-4" style={{ background: C.bg }}>
        <SheetHeader className="p-0"><SheetTitle className="text-[16px]" style={H}>Ghidaj: {SECTION_TITLES[sec]}</SheetTitle></SheetHeader>
        <div className="mt-3 space-y-3">
          {!hasGuidance(year) || items.length === 0 ? <p className="rounded-xl p-3 text-[13px]" style={{ background: "#FFF6EA", color: "#A24A07" }}>{NO_GUIDANCE}</p> : items.map(g => <ItemCard key={g.id} g={g} year={year} />)}
          {warns.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2"><TypeBadge type="WARNING_EXPLANATION" /><span className="text-[12px] font-semibold">Avertizări deschise în această secțiune</span></div>
              {warns.map(w => <div key={w.id} className="rounded-lg bg-white p-2.5 text-[12.5px]" style={{ border: `1px solid ${C.line}` }}><b>{w.title}</b>{w.desc ? <div style={{ color: C.muted }}>{w.desc}</div> : null}</div>)}
            </div>
          )}
          <Disclaimer>{GUIDANCE_BANNER}</Disclaimer>
          <div className="flex flex-wrap gap-2">
            <Btn v="primary" onClick={() => onOpenChange(false)}>Am înțeles</Btn>
            <Btn onClick={() => { onOpenChange(false); a.setSection("guidance"); }} icon={<BookOpen size={13} />}>Deschide pagina Ghidaj APIA</Btn>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type Tab = "pasi" | "documente" | "faq" | "glosar" | "export" | "dupa";
const TABS: [Tab, string][] = [["pasi", "Ghid pas cu pas"], ["documente", "Documente oficiale"], ["export", "Export și depunere"], ["dupa", "După depunere"], ["faq", "Întrebări frecvente"], ["glosar", "Glosar"]];

export function Guidance({ a }: { a: Apia; bp?: string }) {
  const year = Number(a.campaign);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("pasi");
  const hits = searchGuidance(q, year);
  const ok = hasGuidance(year);
  const status = ok ? (OFFICIAL_SOURCES.some(s => s.status === "NEEDS_REVIEW") ? "NECESITĂ REVIZUIRE" : "ACTUAL") : "INCOMPLET";
  const guide = (t: ContentType) => (g: GuideItem) => g.type === t;
  return (
    <div>
      <SectionHeader title="Ghidaj APIA" desc="Consultă pașii, documentele și explicațiile necesare pentru pregătirea Cererii de plată." />
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]" style={{ color: C.muted }}>
        <span>Campania {year}</span><span>Actualizat: {GUIDANCE_UPDATED}</span><span>Versiune: {GUIDANCE_VERSION}</span>
        <span>Surse oficiale configurate: {OFFICIAL_SOURCES.filter(s => s.campaignYear === year).length}</span><span className="font-bold">Status: {status}</span>
      </div>
      <div className="mb-4"><Disclaimer>{GUIDANCE_BANNER}</Disclaimer></div>
      {!ok && <p className="mb-4 rounded-xl p-3 text-[13px]" style={{ background: "#FFF6EA", color: "#A24A07" }}>{NO_GUIDANCE}</p>}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Caută în ghidaj (ex.: PD-04, BND, documente teren)" aria-label="Caută în ghidaj" className="mb-4 w-full rounded-xl bg-white px-3 py-2.5 text-[13.5px]" style={{ border: `1px solid ${C.line}` }} />
      {q.trim() ? (
        <div className="space-y-2">
          {hits.length === 0 && <p className="text-[13px]" style={{ color: C.muted }}>Niciun rezultat.</p>}
          {hits.map((h, i) => (
            <div key={i} className="rounded-xl bg-white p-3" style={{ border: `1px solid ${C.line}` }}>
              <div className="mb-1 flex flex-wrap items-center gap-2"><TypeBadge type={h.type} /><span className="text-[11px]" style={{ color: C.muted }}>{h.kind} · Campania {year}</span></div>
              <div className="text-[13.5px] font-bold">{h.title}</div><p className="text-[12.5px]" style={{ color: C.muted }}>{h.text}</p>
              {h.section && <div className="mt-2"><Btn size="sm" onClick={() => a.setSection(h.section!)}>Deschide secțiunea</Btn></div>}
            </div>
          ))}
        </div>
      ) : ok && (
        <>
          <div className="mb-4 flex flex-wrap gap-1.5" role="tablist">
            {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ background: tab === k ? C.primary : "#fff", color: tab === k ? "#fff" : C.text, border: `1px solid ${tab === k ? C.primary : C.line}` }}>{l}</button>)}
          </div>
          {tab === "pasi" && (
            <ol className="space-y-2">
              {STEPS.map((s, i) => (
                <li key={i}><Card><div className="flex flex-wrap items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: "#EDF3EC", color: C.primary }}>{i + 1}</span>
                  <span className="min-w-[200px] flex-1 text-[13.5px] font-semibold">{s.title}</span>
                  {s.section ? <Btn size="sm" onClick={() => a.setSection(s.section!)}>Deschide secțiunea</Btn> : <span className="text-[11.5px]" style={{ color: C.muted }}>În afara ArendaPro</span>}</div></Card></li>
              ))}
            </ol>
          )}
          {tab === "documente" && <div className="space-y-2">{OFFICIAL_SOURCES.filter(s => s.campaignYear === year).map(s => <div key={s.id}><SourceLink s={s} /><div className="px-1 pt-1 text-[11.5px]" style={{ color: C.muted }}>{s.notes}</div></div>)}</div>}
          {tab === "export" && (
            <div className="space-y-3">
              <h3 className="text-[15px] font-extrabold" style={H}>Cum pregătesc pachetul pentru depunere?</h3>
              {guideFor("export", year).map(g => <ItemCard key={g.id} g={g} year={year} />)}
              <Disclaimer>Aceste exporturi nu sunt prezentate drept formate oficiale de import în AGI Online, în lipsa unei specificații oficiale configurate.</Disclaimer>
              <h3 className="text-[15px] font-extrabold" style={H}>Ce se întâmplă în afara ArendaPro?</h3>
              <p className="text-[13px]" style={{ color: C.muted }}>Completarea Cererii prin canalul oficial, verificarea, semnarea, transmiterea oficială și păstrarea confirmării se fac în sistemul APIA. Apoi introduci numărul și dovada depunerii în ArendaPro. Pentru instrucțiuni tehnice consultă ghidul oficial.</p>
              {sourcesFor(["src-agi", "src-cerere"], year).map(s => <SourceLink key={s.id} s={s} />)}
            </div>
          )}
          {tab === "dupa" && <div className="space-y-2">{guideFor("modifications", year).filter(guide("POST_SUBMISSION_GUIDANCE")).map(g => <ItemCard key={g.id} g={g} year={year} />)}</div>}
          {tab === "faq" && <div className="space-y-2">{FAQ.map(f => <details key={f.q} className="rounded-xl bg-white p-3" style={{ border: `1px solid ${C.line}` }}><summary className="cursor-pointer text-[13.5px] font-semibold">{f.q}</summary><p className="mt-2 text-[13px]" style={{ color: C.muted }}>{f.a}</p><div className="mt-1"><TypeBadge type={f.type} /></div></details>)}</div>}
          {tab === "glosar" && <div className="grid gap-2 md:grid-cols-2">{GLOSSARY.map(t => <div key={t.term} className="rounded-xl bg-white p-3" style={{ border: `1px solid ${C.line}` }}><div className="text-[13.5px] font-bold">{t.term}</div><p className="text-[12.5px]" style={{ color: C.muted }}>{t.def}</p><div className="mt-1 text-[11px] font-semibold" style={{ color: t.official ? "#1E4FBF" : "#2A6240" }}>{t.official ? "Termen oficial (verifică sursa)" : "Definiție utilizată în ArendaPro"}</div></div>)}</div>}
        </>
      )}
    </div>
  );
}

export type { SectionKey };
