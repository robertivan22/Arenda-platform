import { ReactNode, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, Camera, Check, CheckCircle2, Circle, Download, FileText, Info, Minus,
  RefreshCw, Send, Upload, X, FileSpreadsheet, FileArchive, ChevronRight,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./primitives";
import { Skeleton } from "./primitives";
import { C, STATUS, TONES, Tone, HubDoc, Warning, SEV_META, SECTION_TITLES, USAGE_TYPES, ha, fmt, Activity2, SectionKey } from "./data";
import type { Apia, SecStatus } from "./useApia";

export const H = { fontFamily: "'Manrope','Inter',sans-serif", letterSpacing: "-0.02em" } as const;

// ── Primitives ───────────────────────────────────────────────────────────────
export function Card({ children, className = "", pad = true, style }: { children: ReactNode; className?: string; pad?: boolean; style?: React.CSSProperties }) {
  return <div className={`rounded-2xl ${pad ? "p-5" : ""} ${className}`} style={{ background: C.card, border: `1px solid ${C.line}`, boxShadow: "0 1px 2px rgba(30,42,34,.04)", ...style }}>{children}</div>;
}

export function StatusBadge({ status, tone, label, small }: { status?: string; tone?: Tone; label?: string; small?: boolean }) {
  const m = status ? STATUS[status] : null;
  const t = TONES[m?.tone ?? tone ?? "gray"];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${small ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11.5px]"}`} style={{ background: t.bg, color: t.fg, border: `1px solid ${t.bd}` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} />{m?.label ?? label}
    </span>
  );
}

type BtnV = "primary" | "secondary" | "ghost" | "danger";
export function Btn({ children, v = "secondary", onClick, disabled, icon, className = "", size = "md", type = "button", title }: { children?: ReactNode; v?: BtnV; onClick?: () => void; disabled?: boolean; icon?: ReactNode; className?: string; size?: "sm" | "md"; type?: "button" | "submit"; title?: string }) {
  const st: Record<BtnV, React.CSSProperties> = {
    primary: { background: C.primary, color: "#fff", border: `1px solid ${C.primary}` },
    secondary: { background: "#fff", color: C.text, border: `1px solid ${C.line}` },
    ghost: { background: "transparent", color: C.primary, border: "1px solid transparent" },
    danger: { background: "#fff", color: "#A5281B", border: "1px solid #F5C6C0" },
  };
  return (
    <button type={type} title={title} disabled={disabled} onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${size === "sm" ? "px-2.5 py-1.5 text-[12px]" : "px-3.5 py-2 text-[13px]"} ${className}`}
      style={{ ...st[v], outlineColor: C.primary }}>
      {icon}{children}
    </button>
  );
}

export const inputCls = "w-full rounded-xl px-3 py-2 text-[13px] outline-none transition focus:ring-2 disabled:opacity-60 disabled:bg-[#F6F4ED]";
export const inputStyle: React.CSSProperties = { background: "#fff", border: `1px solid ${C.line}`, color: C.text };
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block"><span className="mb-1 block text-[11.5px] font-semibold" style={{ color: C.muted }}>{label}</span>{children}{hint && <span className="mt-1 block text-[11px]" style={{ color: C.muted }}>{hint}</span>}</label>;
}
export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...p} className={inputCls + " " + (p.className ?? "")} style={inputStyle} />; }
export function Select({ value, onChange, children, disabled, className = "" }: { value: string; onChange: (v: string) => void; children: ReactNode; disabled?: boolean; className?: string }) {
  return <select value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className={inputCls + " " + className} style={inputStyle}>{children}</select>;
}

export function Modal({ open, onClose, title, desc, children, wide }: { open: boolean; onClose: () => void; title: string; desc?: string; children: ReactNode; wide?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className={`max-h-[88vh] overflow-y-auto rounded-2xl border p-0 ${wide ? "sm:max-w-[760px]" : "sm:max-w-[520px]"}`} style={{ background: "#fff", borderColor: C.line }}>
        <DialogHeader className="px-6 pt-6 text-left">
          <DialogTitle style={{ ...H, color: C.text, fontSize: 18 }}>{title}</DialogTitle>
          {desc ? <DialogDescription className="text-[13px]" style={{ color: C.muted }}>{desc}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        </DialogHeader>
        <div className="px-6 pb-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function SectionHeader({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[20px] font-extrabold" style={{ ...H, color: C.text }}>{title}</h2>
        {desc && <p className="mt-1 max-w-[620px] text-[13px] leading-relaxed" style={{ color: C.muted }}>{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function ReadOnlyBanner({ role }: { role: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[12.5px]" style={{ background: "#F1F0EA", color: C.muted, border: `1px solid ${C.line}` }}>
      <Info size={14} /> <span><b style={{ color: C.text }}>Mod doar citire.</b> Rolul „{role}” poate vedea această secțiune, dar nu o poate modifica.</span>
    </div>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <p className="flex gap-2 text-[11.5px] leading-relaxed" style={{ color: C.muted }}><Info size={13} className="mt-0.5 shrink-0" />{children}</p>;
}
export const DemoTag = () => <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: "#F1F0EA", color: C.muted }}>Date demonstrative</span>;

// ── Status icon ──────────────────────────────────────────────────────────────
export function SecIcon({ s }: { s: SecStatus }) {
  if (s === "s_complet") return <CheckCircle2 size={16} style={{ color: "#4E8B62" }} aria-label="Complet" />;
  if (s === "s_incomplet") return <span className="inline-flex h-4 w-4 items-center justify-center"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#E8791A" }} aria-label="Incomplet" /></span>;
  if (s === "s_verificare") return <AlertTriangle size={15} style={{ color: "#D4A514" }} aria-label="Necesită verificare" />;
  if (s === "s_na") return <Minus size={16} style={{ color: "#9AA39D" }} aria-label="Nu se aplică" />;
  return <Circle size={15} style={{ color: "#B9BFB9" }} aria-label="Neînceput" />;
}

export function SectionNavigationItem({ icon, title, status, issues, active, onClick }: { icon: ReactNode; title: string; status?: SecStatus; issues?: number; active: boolean; onClick: () => void }) {
  const m = status ? STATUS[status] : null;
  return (
    <button onClick={onClick} aria-current={active ? "page" : undefined}
      className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-[#F3F1E8]"
      style={{ background: active ? "#EDF3EC" : undefined, boxShadow: active ? `inset 3px 0 0 ${C.primary}` : undefined }}>
      <span style={{ color: active ? C.primary : C.muted }}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold" style={{ color: active ? C.primary : C.text }}>{title}</span>
        {m && <span className="block truncate text-[11px]" style={{ color: C.muted }}>{status === "s_incomplet" || status === "s_verificare" ? (issues ? `${issues} ${issues === 1 ? "element" : "elemente"} · ` : "") + m.label : m.label}</span>}
      </span>
      {status && <SecIcon s={status} />}
    </button>
  );
}

// ── Progres ──────────────────────────────────────────────────────────────────
export function ProgressBar({ value, h = 10, tone = C.primary }: { value: number; h?: number; tone?: string }) {
  return <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="w-full overflow-hidden rounded-full" style={{ height: h, background: "#ECE9DF" }}><div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: tone }} /></div>;
}

export function ProgressCard({ a, compact }: { a: Apia; compact?: boolean }) {
  const crit = a.count("critic");
  const next = a.nextTarget;
  if (compact) {
    return (
      <Card pad={false} className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <div className="flex min-w-[180px] flex-1 items-center gap-3">
          <span className="text-[20px] font-extrabold" style={{ ...H, color: C.primary }}>{a.percent}%</span>
          <div className="flex-1"><ProgressBar value={a.percent} h={7} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]" style={{ color: C.muted }}>
          <span><b style={{ color: C.text }}>{a.docsMissing}</b> documente lipsă</span>
          <span><b style={{ color: C.text }}>{a.needsCheck}</b> de verificat</span>
          <span><b style={{ color: C.text }}>{a.secComplete}</b>/{a.applicableCount} secțiuni complete</span>
        </div>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden" style={{ background: "linear-gradient(135deg,#FFFFFF 0%,#F6F9F4 100%)" }}>
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Pregătirea dosarului</div>
          <div className="mt-2 flex items-end gap-3">
            <span className="text-[44px] font-extrabold leading-none" style={{ ...H, color: C.primary }}>{a.percent}%</span>
            <span className="pb-1.5 text-[14px] font-semibold" style={{ color: C.text }}>Dosar completat în proporție de {a.percent}%</span>
          </div>
          <div className="mt-4"><ProgressBar value={a.percent} /></div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              [a.secComplete, "secțiuni complete", "#2A6240"],
              [a.secIncomplete, "secțiuni de lucrat", "#A24A07"],
              [a.docsMissing, a.docsMissing === 1 ? "document lipsă" : "documente lipsă", crit ? "#A5281B" : "#2A6240"],
              [a.needsCheck, "de verificat", "#7A5B00"],
            ].map(([n, l, c]) => (
              <div key={String(l)}><div className="text-[22px] font-extrabold" style={{ ...H, color: c as string }}>{n}</div><div className="text-[11.5px]" style={{ color: C.muted }}>{l}</div></div>
            ))}
          </div>
          <p className="mt-3 text-[12.5px]" style={{ color: C.muted }}>{a.secComplete} din {a.applicableCount} secțiuni sunt complete · {a.docsMissing} documente lipsesc · {a.needsCheck} informații necesită verificare</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "#fff", border: `1px solid ${C.line}` }}>
          <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>Următoarea acțiune recomandată</div>
          <p className="mt-2 text-[14px] font-semibold leading-snug" style={{ color: C.text }}>{next ? next.title : "Nu mai sunt elemente deschise. Poți trece la verificarea finală."}</p>
          {next && <p className="mt-1 text-[12.5px]" style={{ color: C.muted }}>{next.desc}</p>}
          <Btn v="primary" className="mt-4" onClick={() => a.setSection(a.lastSection === "overview" ? "usage" : a.lastSection)} icon={<ArrowRight size={14} />}>Continuă de unde ai rămas</Btn>
        </div>
      </div>
    </Card>
  );
}

export function SummaryCard({ label, value, sub, icon, attention, onClick }: { label: string; value: string; sub?: string; icon: ReactNode; attention?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl p-4 text-left transition hover:-translate-y-0.5" style={{ background: attention ? "#FFF6EA" : C.card, border: `1px solid ${attention ? "#F6D3A9" : C.line}`, boxShadow: "0 1px 2px rgba(30,42,34,.04)" }}>
      <div className="flex items-center justify-between"><span className="text-[11.5px] font-semibold" style={{ color: attention ? "#A24A07" : C.muted }}>{label}</span><span style={{ color: attention ? "#E8791A" : C.primary }}>{icon}</span></div>
      <div className="mt-2 text-[22px] font-extrabold leading-tight" style={{ ...H, color: C.text }}>{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px]" style={{ color: C.muted }}>{sub}</div>}
    </button>
  );
}

// ── Checklist / Warning ──────────────────────────────────────────────────────
export function ChecklistItem({ ok, label, hint, action }: { ok: boolean; label: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full" style={{ background: ok ? "#E8F2EA" : "#FFF1E0", border: `1px solid ${ok ? "#CBE1D0" : "#F6D3A9"}` }}>
        {ok ? <Check size={11} style={{ color: "#2A6240" }} strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#E8791A" }} />}
      </span>
      <div className="min-w-0 flex-1"><div className="text-[13px] font-medium" style={{ color: C.text }}>{label} <span className="text-[11px] font-semibold" style={{ color: ok ? "#2A6240" : "#A24A07" }}>· {ok ? "Disponibil" : "Lipsește"}</span></div>{hint && <div className="text-[11.5px]" style={{ color: C.muted }}>{hint}</div>}</div>
      {action}
    </div>
  );
}

export function WarningCard({ w, onGo, onMark, compact, canAct = true }: { w: Warning; onGo: () => void; onMark?: () => void; compact?: boolean; canAct?: boolean }) {
  const m = SEV_META[w.sev]; const t = TONES[m.tone];
  return (
    <div className={`rounded-xl ${compact ? "p-3" : "p-3.5"}`} style={{ background: w.resolved ? "#F8F7F2" : t.bg + "88", border: `1px solid ${w.resolved ? C.line : t.bd}`, opacity: w.resolved ? 0.7 : 1 }}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0" style={{ color: t.dot }}>{w.resolved ? <CheckCircle2 size={15} /> : w.sev === "critic" ? <AlertTriangle size={15} /> : w.sev === "verificare" ? <AlertTriangle size={15} /> : <Info size={15} />}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge small tone={w.resolved ? "green" : m.tone} label={w.resolved ? "Rezolvat" : m.label} />
            <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "#fff", color: C.muted, border: `1px solid ${C.lineSoft}` }}>{w.kind === "matematic" ? "Verificare matematică" : "Verificare administrativă"}</span>
          </div>
          <div className={`mt-1.5 font-semibold ${w.resolved ? "line-through" : ""}`} style={{ color: C.text, fontSize: compact ? 12.5 : 13.5 }}>{w.title}</div>
          {!compact && <div className="mt-0.5 text-[12.5px]" style={{ color: C.muted }}>{w.desc}</div>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px]" style={{ color: C.muted }}>{SECTION_TITLES[w.section]}</span>
            {!w.resolved && <><span className="flex-1" /><Btn size="sm" onClick={onGo} v="primary" icon={<ChevronRight size={12} />}>Rezolvă</Btn>
              {onMark && canAct && w.sev !== "critic" && <Btn size="sm" onClick={onMark}>Am verificat</Btn>}</>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Încărcare ────────────────────────────────────────────────────────────────
export function DocumentUploader({ onFile, label = "Încarcă document", hint = "PDF, JPG, PNG sau WebP · până la 15 MB", disabled, compact }: { onFile: (name: string, size: number, file: File) => void; label?: string; hint?: string; disabled?: boolean; compact?: boolean }) {
  const ref = useRef<HTMLInputElement>(null); const cam = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const take = (f?: File | null) => { if (f && !disabled) onFile(f.name, f.size, f); };
  return (
    <div onDragOver={e => { e.preventDefault(); if (!disabled) setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files?.[0]); }}
      className={`rounded-2xl text-center transition ${compact ? "px-4 py-3" : "px-5 py-6"}`}
      style={{ border: `1.5px dashed ${drag ? C.primary : "#CFCBBC"}`, background: drag ? "#EDF3EC" : "#FCFBF7", opacity: disabled ? 0.55 : 1 }}>
      <div className={`flex ${compact ? "flex-row items-center justify-center gap-3" : "flex-col items-center gap-1.5"}`}>
        <Upload size={compact ? 16 : 22} style={{ color: C.primary }} />
        <div><div className="text-[13px] font-semibold" style={{ color: C.text }}>{label}</div>{!compact && <div className="text-[11.5px]" style={{ color: C.muted }}>Trage fișierul aici sau alege-l de pe dispozitiv. {hint}</div>}</div>
        <div className="mt-1 flex flex-wrap justify-center gap-2" style={{ marginTop: compact ? 0 : 8 }}>
          <Btn size="sm" disabled={disabled} onClick={() => ref.current?.click()}>Alege fișier</Btn>
          <Btn size="sm" disabled={disabled} onClick={() => cam.current?.click()} icon={<Camera size={13} />} className="sm:hidden">Fotografiază</Btn>
        </div>
      </div>
      <input ref={ref} type="file" accept=".pdf,image/*" hidden onChange={e => { take(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={e => { take(e.target.files?.[0]); e.target.value = ""; }} />
    </div>
  );
}

export const fmtDate = (s: string | null) => (s ? s.split("-").reverse().join(".") : "—");

export function DocumentRow({ d, onOpen }: { d: HubDoc; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex w-full flex-wrap items-center gap-3 rounded-xl px-3.5 py-3 text-left transition hover:bg-[#F6F4ED]" style={{ border: `1px solid ${C.lineSoft}`, background: "#fff" }}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: d.file ? "#EDF3EC" : "#FFF1E0", color: d.file ? C.primary : "#A24A07" }}><FileText size={16} /></span>
      <span className="min-w-[160px] flex-1">
        <span className="block text-[13px] font-semibold" style={{ color: C.text }}>{d.name}{d.version > 1 && <span className="ml-1.5 text-[11px] font-medium" style={{ color: C.muted }}>v{d.version}</span>}</span>
        <span className="block text-[11.5px]" style={{ color: C.muted }}>
          {d.cat}{d.parcel && ` · ${d.parcel}`}{d.interv && ` · ${d.interv}`}{d.owner && ` · ${d.owner}`}{d.expiry && ` · valabil până la ${fmtDate(d.expiry)}`}
        </span>
      </span>
      <StatusBadge status={d.status} small />
    </button>
  );
}

// ── Diferențe ────────────────────────────────────────────────────────────────
export function DifferenceIndicator({ app, doc, compact }: { app: number; doc: number | null; compact?: boolean }) {
  if (doc === null) return <span className="text-[12px] font-semibold" style={{ color: "#A24A07" }}>Nu există suprafață documentată</span>;
  const diff = Math.round((doc - app) * 100) / 100;
  if (diff === 0) return <span className="text-[12px]" style={{ color: "#2A6240" }}>Valorile coincid</span>;
  const s = `${diff > 0 ? "+" : "−"}${fmt(Math.abs(diff))} ha`;
  if (compact) return <span className="inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-bold" style={{ background: "#FFF1E0", color: "#A24A07" }}>{s}</span>;
  return (
    <div className="rounded-xl p-3" style={{ background: "#FFF6EA", border: "1px solid #F6D3A9" }}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><div className="text-[10.5px] font-semibold uppercase" style={{ color: C.muted }}>ArendaPro</div><div className="text-[15px] font-extrabold" style={{ ...H, color: C.text }}>{ha(app)}</div></div>
        <div><div className="text-[10.5px] font-semibold uppercase" style={{ color: C.muted }}>Document</div><div className="text-[15px] font-extrabold" style={{ ...H, color: C.text }}>{ha(doc)}</div></div>
        <div><div className="text-[10.5px] font-semibold uppercase" style={{ color: "#A24A07" }}>Diferență</div><div className="text-[15px] font-extrabold" style={{ ...H, color: "#A24A07" }}>{s}</div></div>
      </div>
      <p className="mt-2 text-[12px]" style={{ color: "#A24A07" }}>Valorile diferă și necesită verificare. Nu alegem noi valoarea corectă.</p>
    </div>
  );
}

// ── Diverse ──────────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center py-12 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "#EDF3EC", color: C.primary }}>{icon}</span>
      <h3 className="text-[16px] font-extrabold" style={{ ...H, color: C.text }}>{title}</h3>
      <p className="mt-1 max-w-[380px] text-[13px]" style={{ color: C.muted }}>{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

export function ErrorState({ onRetry, text = "Datele dosarului nu au putut fi încărcate." }: { onRetry: () => void; text?: string }) {
  return (
    <Card className="flex flex-col items-center py-10 text-center" style={{ borderColor: "#F5C6C0" }}>
      <AlertTriangle size={26} style={{ color: "#D8412F" }} />
      <p className="mt-2 text-[14px] font-semibold" style={{ color: C.text }}>{text}</p>
      <Btn className="mt-3" onClick={onRetry} icon={<RefreshCw size={13} />}>Reîncearcă</Btn>
    </Card>
  );
}

export function SkeletonBlock({ rows = 4 }: { rows?: number }) {
  return <Card className="space-y-3">{Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}</Card>;
}

export function ActivityTimeline({ items }: { items: Activity2[] }) {
  return (
    <ol className="relative space-y-4 pl-5">
      <span className="absolute bottom-1 left-[5px] top-1 w-px" style={{ background: C.line }} />
      {items.map(i => (
        <li key={i.id} className="relative">
          <span className="absolute -left-5 top-1 h-2.5 w-2.5 rounded-full" style={{ background: "#fff", border: `2px solid ${C.primary}` }} />
          <div className="text-[13px]" style={{ color: C.text }}>{i.text}</div>
          <div className="text-[11.5px]" style={{ color: C.muted }}>{i.time} · {i.who}</div>
        </li>
      ))}
    </ol>
  );
}

export function VerificationSummary({ rows, onGo }: { rows: { key: SectionKey | "semnare"; label: string; status: SecStatus; issues: string[]; recs: string[] }[]; onGo: (k: SectionKey) => void }) {
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <Card key={r.label} pad={false} className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <SecIcon s={r.status} />
            <div className="min-w-[160px] flex-1"><div className="text-[13.5px] font-semibold" style={{ color: C.text }}>{r.label}</div>
              {r.issues.length === 0 && r.recs.length === 0 && <div className="text-[12px]" style={{ color: C.muted }}>Nu au fost găsite probleme.</div>}</div>
            <StatusBadge status={r.status} small />
            {r.key !== "semnare" && r.status !== "s_complet" && r.status !== "s_na" && <Btn size="sm" onClick={() => onGo(r.key as SectionKey)} icon={<ChevronRight size={12} />}>Remediază</Btn>}
          </div>
          {(r.issues.length > 0 || r.recs.length > 0) && (
            <ul className="mt-2 space-y-1 pl-7 text-[12.5px]">
              {r.issues.map(t => <li key={t} style={{ color: C.text }}>• {t}</li>)}
              {r.recs.map(t => <li key={t} style={{ color: C.muted }}>◦ Recomandare: {t}</li>)}
            </ul>
          )}
        </Card>
      ))}
    </div>
  );
}

export function ExportCard({ title, desc, formats, onExport, disabled }: { title: string; desc: string; formats: "CSV"[]; onExport: (f: string) => void; disabled?: boolean }) {
  const ic = { CSV: <FileSpreadsheet size={13} /> };
  return (
    <Card className="flex flex-col gap-3">
      <div><div className="text-[14px] font-bold" style={{ ...H, color: C.text }}>{title}</div><div className="mt-0.5 text-[12.5px]" style={{ color: C.muted }}>{desc}</div></div>
      <div className="mt-auto flex flex-wrap gap-2">{formats.map(f => <Btn key={f} size="sm" disabled={disabled} onClick={() => onExport(f)} icon={ic[f]}>{f}</Btn>)}</div>
    </Card>
  );
}

export function SubmissionConfirmation({ open, onClose, onConfirm, number, date }: { open: boolean; onClose: () => void; onConfirm: () => void; number: string; date: string }) {
  return (
    <Modal open={open} onClose={onClose} title="Înregistrezi depunerea dosarului?" desc="Confirmă că Cererea de plată a fost transmisă prin canalul oficial APIA. ArendaPro va salva data, numărul cererii și documentele asociate.">
      <div className="mb-4 rounded-xl p-3 text-[12.5px]" style={{ background: "#F6F4ED", color: C.text }}>Cererea nr. <b>{number || "—"}</b> · depusă la <b>{fmtDate(date)}</b></div>
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>Anulează</Btn><Btn v="primary" onClick={onConfirm} icon={<Send size={13} />}>Confirmă depunerea</Btn></div>
    </Modal>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { v: T; label: string }[] }) {
  return (
    <div role="tablist" className="inline-flex rounded-xl p-1" style={{ background: "#F1EFE6" }}>
      {items.map(i => <button key={i.v} role="tab" aria-selected={value === i.v} onClick={() => onChange(i.v)} className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition" style={{ background: value === i.v ? "#fff" : "transparent", color: value === i.v ? C.primary : C.muted, boxShadow: value === i.v ? "0 1px 2px rgba(0,0,0,.08)" : undefined }}>{i.label}</button>)}
    </div>
  );
}

export function download(name: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + content], { type: mime });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export const csv = (rows: (string | number)[][]) => rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
export { Download, X, USAGE_TYPES };
