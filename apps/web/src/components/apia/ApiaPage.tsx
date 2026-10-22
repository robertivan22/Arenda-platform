"use client";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, ClipboardCheck, FolderOpen, Layers, MapPin, Eye, Play, PanelRightOpen, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./primitives";
import { C, ROLE_LABEL, SECTION_ORDER, SECTION_TITLES, SectionKey, access } from "./data";
import { useApia } from "./useApia";
import type { BP } from "./sections1";
import { Applicant, Bank, Overview, Parcels } from "./sections1";
import { Cultures, Interventions, Notebooks, Usage } from "./sections2";
import { Documents, ExportPage, Modifications, Verification, Zoo } from "./sections3";
import {
  Btn, Card, Disclaimer, EmptyState, ErrorState, H, ProgressBar, ProgressCard, SectionNavigationItem, SecIcon, SkeletonBlock, StatusBadge, WarningCard, Select,
} from "./ui";
import { SECTION_ICONS } from "./icons";
import { Guidance, GuidanceDrawer, GuideButton } from "./GuidanceUI";

const SECTIONS: Record<SectionKey, (p: { a: ReturnType<typeof useApia>; bp: BP }) => React.ReactElement> = {
  overview: Overview, applicant: Applicant, bank: Bank, parcels: Parcels, usage: Usage, cultures: Cultures, interventions: Interventions,
  notebooks: Notebooks, zoo: Zoo, documents: Documents, verification: Verification, export: ExportPage, modifications: Modifications, guidance: Guidance,
};

const STEP_KEYS: SectionKey[] = ["applicant", "bank", "parcels", "usage", "cultures", "interventions", "notebooks", "zoo", "documents", "verification"];

export function ApiaPage() {
  const a = useApia();
  const ref = useRef<HTMLDivElement>(null);
  const [bp, setBp] = useState<BP>("desktop");
  const loading = a.loading;
  const error = a.error;
  const [panel, setPanel] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => { const w = e.contentRect.width; setBp(w >= 1180 ? "desktop" : w >= 760 ? "tablet" : "mobile"); });
    ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => { ref.current?.scrollTo({ top: 0 }); setNavOpen(false); }, [a.section, a.campaign]);

  const hasDossier = a.hasDossier;
  const acc = access(a.role, a.section);
  const Current = SECTIONS[a.section];
  const reload = () => { void a.reload(); };

  const nav = (
    <nav aria-label="Secțiunile dosarului" className="space-y-0.5">
      {SECTION_ORDER.map(k => {
        const info = a.sectionInfo(k); const none = access(a.role, k) === "none";
        const Ic = SECTION_ICONS[k];
        return (
          <div key={k} style={{ opacity: none ? 0.5 : 1 }}>
            <SectionNavigationItem icon={<Ic size={16} />} title={SECTION_TITLES[k]} status={k === "overview" || none ? undefined : info.status} issues={info.issues} active={a.section === k} onClick={() => { a.setSection(k); setNavOpen(false); }} />
          </div>
        );
      })}
      <div className="my-1.5 border-t" style={{ borderColor: C.lineSoft }} />
      <SectionNavigationItem icon={<SECTION_ICONS.guidance size={16} />} title="Ghidaj APIA" active={a.section === "guidance"} onClick={() => { a.setSection("guidance"); setNavOpen(false); }} />
    </nav>
  );

  const checks = (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><h3 className="text-[15px] font-extrabold" style={H}>Verificări</h3><span className="text-[12px] font-semibold" style={{ color: C.muted }}>{a.open.length} deschise</span></div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {([["Critice", a.count("critic"), "#FDECEA", "#A5281B"], ["De verificat", a.count("verificare"), "#FFF8D9", "#7A5B00"], ["Recomandări", a.count("recomandare"), "#E8F0FA", "#2D5F9A"]] as const).map(([l, n, bg, fg]) => (
          <div key={l} className="rounded-xl px-1 py-2" style={{ background: bg, color: fg }}><div className="text-[18px] font-extrabold" style={H}>{n}</div><div className="text-[10.5px] font-semibold">{l}</div></div>
        ))}
      </div>
      {a.open.length === 0 && <p className="rounded-xl p-3 text-[12.5px]" style={{ background: "#E8F2EA", color: "#2A6240" }}>Nu mai sunt verificări deschise.</p>}
      {a.open.map(w => <WarningCard key={w.id} w={w} compact canAct={a.role !== "colaborator"} onGo={() => { a.setSection(w.section); if (w.parcels?.[0]) a.setFocusParcel(w.parcels[0]); setPanel(false); }} onMark={() => a.resolve(w.id, "marcat de utilizator")} />)}
    </div>
  );

  return (
    <div ref={ref} className="h-full overflow-y-auto overflow-x-hidden" style={{ background: C.bg, color: C.text, fontFamily: "'Inter',sans-serif", WebkitTextSizeAdjust: "100%" }}>
      {/* Pe mobil: câmpuri de 16px (fără zoom iOS) și ținte tactile de minimum 40px. */}
      {bp === "mobile" && <style>{`.apia-m input,.apia-m select,.apia-m textarea{font-size:16px!important}.apia-m button,.apia-m [role=tab]{min-height:40px}`}</style>}
      <div className={`mx-auto max-w-[1560px] px-3 pb-24 pt-4 sm:px-4 md:px-6 ${bp === "mobile" ? "apia-m" : ""}`}>
        {/* Header */}
        <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-[22px] font-extrabold leading-tight sm:text-[26px]" style={H}>Pregătire dosar APIA</h1></div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={a.dossierStatus} />
              <span className="text-[12.5px]" style={{ color: C.muted }}>Campania {a.campaign}{a.farmName ? ` · ${a.farmName}` : ""} · Acces: {ROLE_LABEL[a.role]}</span>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="w-full sm:w-[140px]"><Select value={a.campaign} onChange={a.setCampaign}>{a.years.map(c => <option key={c} value={c}>Campania {c}</option>)}</Select></div>
            <Btn onClick={() => a.setSection("guidance")} icon={<SECTION_ICONS.guidance size={14} />}>Ghidaj APIA</Btn>
            {bp !== "desktop" && <Btn onClick={() => setPanel(true)} icon={<Eye size={14} />}>Vezi verificările{a.open.length ? ` (${a.open.length})` : ""}</Btn>}
            {hasDossier && <Btn v="primary" onClick={() => a.setSection(a.lastSection)} icon={<Play size={14} />}>Continuă pregătirea</Btn>}
          </div>
        </header>
        <div className="mb-5"><Disclaimer>ArendaPro te ajută să centralizezi și să verifici informațiile necesare. Completarea și depunerea oficială se realizează prin canalele puse la dispoziție de APIA.</Disclaimer></div>

        {!hasDossier && loading ? <SkeletonBlock rows={6} /> : !hasDossier && error ? <ErrorState onRetry={reload} text={`Datele nu au putut fi încărcate: ${error}`} /> : !hasDossier ? (
          <EmptyState icon={<FolderOpen size={24} />} title={`Nu există încă un dosar pentru campania ${a.campaign}`} text="Creează dosarul și pregătește-l pas cu pas, pornind de la datele existente în ArendaPro." action={<Btn v="primary" disabled={!a.canSubmit} onClick={() => void a.createDossier()}>Creează dosarul</Btn>} />
        ) : (
          <div className="grid gap-5" style={{ gridTemplateColumns: bp === "desktop" ? "240px minmax(0,1fr) 320px" : bp === "tablet" ? "220px minmax(0,1fr)" : "minmax(0,1fr)" }}>
            {bp !== "mobile" && <aside className="sticky top-3 self-start"><Card pad={false} className="p-2">{nav}</Card></aside>}
            <main className="min-w-0">
              {bp === "mobile" && (
                <div className="relative z-10 mb-4">
                  <button onClick={() => setNavOpen(o => !o)} className="flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-left text-[13.5px] font-bold" style={{ border: `1px solid ${C.line}` }} aria-expanded={navOpen}>
                    <span className="flex-1">{SECTION_TITLES[a.section]}</span><span className="text-[11.5px] font-semibold" style={{ color: C.muted }}>{SECTION_ORDER.indexOf(a.section) + 1}/{SECTION_ORDER.length}</span><ChevronDown size={16} />
                  </button>
                  {navOpen && <div className="absolute inset-x-0 top-full mt-1 max-h-[60vh] overflow-y-auto rounded-2xl bg-white p-2 shadow-xl" style={{ border: `1px solid ${C.line}` }}>{nav}</div>}
                </div>
              )}
              {a.section !== "overview" && !loading && !error && acc !== "none" && <div className="mb-4"><ProgressCard a={a} compact /></div>}
              {a.section !== "guidance" && <GuideButton onClick={() => setGuideOpen(true)} />}
              {loading ? <SkeletonBlock rows={6} /> : error ? <ErrorState onRetry={reload} /> : acc === "none" ? (
                <EmptyState icon={<Layers size={22} />} title="Nu ai acces la această secțiune" text={`Rolul „${ROLE_LABEL[a.role]}” nu include această secțiune. Contactează administratorul fermei.`} action={<Btn onClick={() => a.setSection("overview")}>Înapoi la prezentare</Btn>} />
              ) : <Current a={a} bp={bp} />}
              {STEP_KEYS.includes(a.section) && !loading && !error && acc !== "none" && (() => {
                const i = SECTION_ORDER.indexOf(a.section); const prev = SECTION_ORDER[i - 1]; const next = SECTION_ORDER[i + 1]; const isSk = a.skipped.has(a.section);
                return (
                  <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: C.lineSoft }}>
                    {isSk && <span className="mr-auto rounded-full px-2.5 py-1 text-[11.5px] font-bold" style={{ background: "#F1EFE6", color: C.muted }}>Omis pentru moment</span>}
                    <Btn disabled={!prev} onClick={() => prev && a.setSection(prev)}>Înapoi</Btn>
                    {isSk
                      ? <Btn disabled={a.role === "vizualizare"} onClick={() => void a.resumeSection(a.section)}>Reia pasul</Btn>
                      : <button disabled={a.role === "vizualizare"} onClick={() => { void a.skipSection(a.section); if (next) a.setSection(next); }} className="rounded-lg px-3 py-2 text-[12.5px] font-semibold disabled:opacity-50" style={{ color: C.muted }}>Omite pentru moment</button>}
                    <Btn v="primary" disabled={!next} onClick={() => next && a.setSection(next)}>Continuă</Btn>
                  </div>
                );
              })()}
            </main>
            {bp === "desktop" && <aside className="sticky top-3 max-h-[calc(100vh-2rem)] self-start overflow-y-auto"><Card>{checks}</Card></aside>}
          </div>
        )}
      </div>

      {hasDossier && bp !== "desktop" && (
        <div className="sticky bottom-0 z-20 border-t bg-white/95 px-4 py-2.5 backdrop-blur" style={{ borderColor: C.line, paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto flex max-w-[1560px] items-center gap-3">
            <div className="min-w-0 flex-1"><div className="mb-1 flex justify-between text-[11.5px] font-bold"><span>Pregătirea dosarului</span><span>{a.percent}%</span></div><ProgressBar value={a.percent} h={6} /></div>
            <Btn size="sm" onClick={() => setPanel(true)} icon={<Bell size={13} />}>{a.open.length}</Btn>
            <Btn size="sm" v="primary" onClick={a.goFirstIssue}>Rezolvă următorul</Btn>
          </div>
        </div>
      )}

      <GuidanceDrawer a={a} open={guideOpen} onOpenChange={setGuideOpen} />
      <Sheet open={panel} onOpenChange={setPanel}>
        <SheetContent side="right" className="w-[92vw] max-w-[400px] overflow-y-auto p-4" style={{ background: C.bg }}>
          <SheetHeader className="p-0"><SheetTitle className="sr-only">Verificări</SheetTitle></SheetHeader>
          {checks}
        </SheetContent>
      </Sheet>

      {a.toast && <div role="status" className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-xl" style={{ background: C.primary }}>{a.toast}</div>}
    </div>
  );
}
