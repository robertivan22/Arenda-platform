"use client";
import { useState } from "react";
import {
  ArrowRight, Download, Play, BookOpen, FileText, Calculator,
  Video, ExternalLink, Clock, Star, Search, ChevronRight,
} from "lucide-react";

interface ResursePageProps {
  onLogin: () => void;
  onBack: () => void;
}

// ─── Data ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "ghiduri",   label: "Ghiduri",    icon: BookOpen,    emoji: "📘" },
  { id: "sabloane",  label: "Șabloane",   icon: FileText,    emoji: "📄" },
  { id: "tutoriale", label: "Tutoriale",  icon: Video,       emoji: "🎬" },
  { id: "instrumente",label: "Instrumente", icon: Calculator, emoji: "🧮" },
];

interface Resource {
  id: string;
  title: string;
  desc: string;
  meta: string;
  badge?: string;
  badgeColor?: string;
  icon: string;
  featured?: boolean;
  new?: boolean;
  free: boolean;
}

const GHIDURI: Resource[] = [
  {
    id: "g1", icon: "📘", featured: true, free: true,
    title: "Ghid complet gestionare arendă 2026",
    desc: "De la semnarea primului contract până la distribuirea recoltei — tot procesul explicat pas cu pas, conform legislației actuale.",
    meta: "68 pagini · PDF · Actualizat Iul 2026",
    badge: "Cel mai descărcat", badgeColor: "#d97706",
  },
  {
    id: "g2", icon: "🚚", free: true,
    title: "Ghid e-Transport ANAF pentru fermieri",
    desc: "OUG 41/2022 explicată simplu: când ai nevoie de UIT, cum îl generezi, coduri CN pentru cereale și penalitățile de evitat.",
    meta: "34 pagini · PDF · Actualizat Iun 2026",
  },
  {
    id: "g3", icon: "🌿", free: true,
    title: "Checklist conformitate APIA 2026",
    desc: "Lista completă a documentelor, suprafețelor și condiționalităților necesare pentru declarația unică de suprafață în campania 2026.",
    meta: "12 pagini · PDF · Actualizat Mai 2026",
    badge: "Nou", badgeColor: "#16a34a",
  },
  {
    id: "g4", icon: "⚖️", free: false,
    title: "Drepturile fermierului arendaș: ghid juridic",
    desc: "Codul Civil, OG 16/1994 și jurisprudența recente — ce drepturi ai, când poți rezilia unilateral și cum recuperezi prejudiciile.",
    meta: "28 pagini · PDF · Actualizat Apr 2026",
  },
  {
    id: "g5", icon: "🔒", free: true,
    title: "GDPR și baza de date a arendatorilor",
    desc: "Cum stochezi legal CNP-urile, CUI-urile și datele bancare ale arendatorilor. Registrul de evidență și consimțămintele necesare.",
    meta: "18 pagini · PDF · Actualizat Mar 2026",
  },
  {
    id: "g6", icon: "🌾", free: true,
    title: "Manualul fermierului digital",
    desc: "Cum digitalizezi o exploatație agricolă de la zero: de la scanarea documentelor la harta GIS și automatizarea actelor.",
    meta: "52 pagini · PDF · Actualizat Feb 2026",
  },
];

const SABLOANE: Resource[] = [
  {
    id: "s1", icon: "📋", featured: true, free: true,
    title: "Model contract de arendă 2026 — complet",
    desc: "Contract redactat conform Codului Civil și OG 16/1994, cu toate clauzele obligatorii și clauzele recomandate incluse.",
    meta: "Word + PDF · 8 pagini · Versiunea 4.2",
    badge: "Cel mai folosit", badgeColor: "#d97706",
  },
  {
    id: "s2", icon: "📊", free: true,
    title: "Registru arendatori — Excel complet",
    desc: "Foaie de calcul structurată pentru evidența arendatorilor: CNP/CUI, suprafețe, sume, termene, status plăți.",
    meta: "Excel (.xlsx) · 3 foi · Actualizat 2026",
    badge: "Nou", badgeColor: "#16a34a",
  },
  {
    id: "s3", icon: "📨", free: true,
    title: "Notificare expirare contract de arendă",
    desc: "Scrisoare formală de notificare cu 90/60/30 zile înainte de expirarea contractului, conformă cu cerințele legale.",
    meta: "Word + PDF · 2 pagini",
  },
  {
    id: "s4", icon: "🔄", free: true,
    title: "Act adițional reînnoire contract",
    desc: "Prelungire contract de arendă cu modificarea condițiilor (preț, suprafață, durată) fără a reredacta tot contractul.",
    meta: "Word + PDF · 3 pagini",
  },
  {
    id: "s5", icon: "📦", free: false,
    title: "Proces-verbal predare-primire teren",
    desc: "Document bipartit pentru consemnarea stării terenului la predare, cu inventar agricol și observații de ambele părți.",
    meta: "Word + PDF · 4 pagini",
  },
  {
    id: "s6", icon: "💰", free: false,
    title: "Chitanță distribuire arendă în natură",
    desc: "Document fiscal pentru distribuirea arendei în cereale, cu calculul cantității pe baza prețurilor MADR și semnătura ambelor părți.",
    meta: "Word + PDF · 2 pagini",
  },
];

const TUTORIALE: Resource[] = [
  {
    id: "t1", icon: "🎬", featured: true, free: true,
    title: "Cum creezi primul contract în ArendaPro — 5 minute",
    desc: "De la importul datelor arendatorului până la generarea PDF-ului semnat electronic. Tutorial pas cu pas.",
    meta: "Video · 5:42 min · HD",
    badge: "Vizionat de 4.200+ fermieri", badgeColor: "#d97706",
  },
  {
    id: "t2", icon: "🗺️", free: true,
    title: "Harta parcelelor: import și configurare",
    desc: "Cum imporți parcelele din APIA, le delimitezi pe hartă și le atribuiești arendatorilor. Importul din shapefile și cadastru.",
    meta: "Video · 8:15 min · HD",
  },
  {
    id: "t3", icon: "🚛", free: true,
    title: "Generare UIT e-Transport din ArendaPro",
    desc: "Cum completezi declarația e-Transport direct din aplicație, cu datele vehiculului, mărfii și rutei pre-completate.",
    meta: "Video · 4:30 min · HD",
    badge: "Nou", badgeColor: "#16a34a",
  },
  {
    id: "t4", icon: "📊", free: true,
    title: "Distribuire arendă: calculul și exportul",
    desc: "Folosind prețurile MADR, cum calculezi cantitățile de cereale datorate fiecărui arendator și generezi documentele de distribuire.",
    meta: "Video · 6:20 min · HD",
  },
  {
    id: "t5", icon: "⚙️", free: false,
    title: "Configurare avansată și alerte automate",
    desc: "Cum setezi alerte pentru termene, plăți restante și reînnoiri contracte. Integrarea cu email și SMS.",
    meta: "Video · 12:05 min · HD",
  },
  {
    id: "t6", icon: "📥", free: true,
    title: "Import masiv de date din Excel",
    desc: "Cum migrezi un registru Excel cu sute de parcele și arendatori în ArendaPro fără pierderi de date și fără erori.",
    meta: "Video · 7:45 min · HD",
  },
];

const INSTRUMENTE: Resource[] = [
  {
    id: "i1", icon: "🌾", featured: true, free: true,
    title: "Calculator distribuire arendă în natură",
    desc: "Introduci suprafața, cultura, prețul MADR și cantitatea totală. Calculatorul distribuie automat fiecărui arendator.",
    meta: "Web app · Actualizat cu prețuri Iul 2026",
    badge: "Cel mai folosit", badgeColor: "#d97706",
  },
  {
    id: "i2", icon: "📐", free: true,
    title: "Convertor hectare ↔ ha/ari/stânjeni",
    desc: "Conversie rapidă între unități de suprafață agricolă — hectare, ari, stânjeni, acri — cu precizie de 4 zecimale.",
    meta: "Web app · Instant",
  },
  {
    id: "i3", icon: "💰", free: true,
    title: "Estimator preț arendă pe județ",
    desc: "Compari prețul tău de arendă cu media județului și media națională, pe baza datelor MADR 2026.",
    meta: "Web app · Date MADR Iul 2026",
    badge: "Nou", badgeColor: "#16a34a",
  },
  {
    id: "i4", icon: "🚚", free: true,
    title: "Verificator cod CN e-Transport",
    desc: "Caută rapid codul CN corect pentru orice marfă agricolă (cereale, semințe, furaje) conform nomenclaturii combinate UE.",
    meta: "Web app · Nomenclatură 2026",
  },
  {
    id: "i5", icon: "📅", free: true,
    title: "Calculator termene contract arendă",
    desc: "Introduci data semnării și durata contractului. Calculatorul afișează toate termenele-cheie: notificare, expirare, reînnoire.",
    meta: "Web app · Instant",
  },
  {
    id: "i6", icon: "📊", free: false,
    title: "Simulator randament și profitabilitate",
    desc: "Pe baza suprafeței, culturii, prețurilor MADR și costurilor de arendă, calculezi marja brută estimată pe sezon.",
    meta: "Web app · Necesită cont Pro",
  },
];

const ALL_RESOURCES: Record<string, Resource[]> = {
  ghiduri: GHIDURI,
  sabloane: SABLOANE,
  tutoriale: TUTORIALE,
  instrumente: INSTRUMENTE,
};

// ─── Resource card ─────────────────────────────────────────────────────────────

function ResourceCard({ res, tab, onLogin }: { res: Resource; tab: string; onLogin: () => void }) {
  const [hovered, setHovered] = useState(false);
  const isVideo = tab === "tutoriale";
  const isTool  = tab === "instrumente";

  const actionLabel = isVideo ? "Ver tutorialul" : isTool ? "Deschide" : "Descarcă gratuit";
  const actionIcon  = isVideo ? <Play size={14} /> : isTool ? <ExternalLink size={14} /> : <Download size={14} />;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: res.featured ? "linear-gradient(160deg,#1c1309 0%,#2e1c08 100%)" : "#ffffff",
        borderRadius: 20, padding: "26px",
        border: res.featured ? "1px solid rgba(217,119,6,.22)" : "1px solid rgba(28,16,8,.07)",
        boxShadow: hovered
          ? res.featured ? "0 16px 50px rgba(28,16,8,.35)" : "0 10px 34px rgba(28,16,8,.12)"
          : res.featured ? "0 6px 24px rgba(28,16,8,.2)" : "0 1px 3px rgba(28,16,8,.05)",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        transition: "all .25s",
        display: "flex", flexDirection: "column", gap: 14,
        position: "relative", overflow: "hidden",
        gridColumn: res.featured ? "span 2" : "span 1",
      }}
    >
      {res.featured && (
        <div style={{
          position: "absolute", top: 0, right: 0, width: 200, height: 200,
          background: "radial-gradient(circle at top right,rgba(217,119,6,.18) 0%,transparent 65%)",
          pointerEvents: "none",
        }} />
      )}

      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: res.featured ? "rgba(217,119,6,.18)" : "rgba(28,16,8,.05)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
        }}>{res.icon}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {res.badge && (
            <span style={{
              padding: "3px 10px", borderRadius: 100,
              background: `${res.badgeColor}18`, border: `1px solid ${res.badgeColor}35`,
              fontSize: 10, fontWeight: 800, color: res.badgeColor, letterSpacing: ".06em",
              textTransform: "uppercase",
            }}>{res.badge}</span>
          )}
          {res.new && (
            <span style={{
              padding: "3px 10px", borderRadius: 100,
              background: "rgba(22,163,74,.12)", border: "1px solid rgba(22,163,74,.25)",
              fontSize: 10, fontWeight: 800, color: "#16a34a", letterSpacing: ".06em",
              textTransform: "uppercase",
            }}>Nou</span>
          )}
          <span style={{
            padding: "3px 10px", borderRadius: 100,
            background: res.free
              ? "rgba(22,163,74,.12)" : "rgba(217,119,6,.12)",
            border: res.free
              ? "1px solid rgba(22,163,74,.25)" : "1px solid rgba(217,119,6,.25)",
            fontSize: 10, fontWeight: 800,
            color: res.free ? "#16a34a" : "#d97706",
            letterSpacing: ".06em", textTransform: "uppercase",
          }}>{res.free ? "Gratuit" : "Pro"}</span>
        </div>
      </div>

      {/* Title & desc */}
      <div style={{ flex: 1 }}>
        <h3 style={{
          fontSize: res.featured ? 18 : 15, fontWeight: 800,
          color: res.featured ? "#ffffff" : "#1c1008",
          letterSpacing: "-.02em", lineHeight: 1.35, marginBottom: 10,
        }}>{res.title}</h3>
        <p style={{
          fontSize: 13, lineHeight: 1.68, margin: 0,
          color: res.featured ? "rgba(255,245,235,.62)" : "#6b5d52",
        }}>{res.desc}</p>
      </div>

      {/* Meta + action */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: res.featured ? "rgba(255,245,235,.38)" : "#a8998e", fontWeight: 500 }}>
          {res.meta}
        </span>
        <button onClick={onLogin} style={{
          padding: "9px 18px", borderRadius: 10, flexShrink: 0,
          background: res.featured
            ? "linear-gradient(135deg,#f59e0b,#d97706)"
            : res.free ? "rgba(28,16,8,.05)" : "rgba(217,119,6,.08)",
          cursor: "pointer", fontSize: 13, fontWeight: 700,
          color: res.featured ? "#fff" : res.free ? "#1c1008" : "#d97706",
          boxShadow: res.featured ? "0 2px 10px rgba(217,119,6,.4)" : "none",
          border: res.featured ? "none" : res.free
            ? "1px solid rgba(28,16,8,.12)"
            : "1px solid rgba(217,119,6,.22)",
          display: "flex", alignItems: "center", gap: 6,
          transition: "all .2s",
        } as React.CSSProperties}>
          {actionIcon} {res.free ? actionLabel : "Activează Pro"}
        </button>
      </div>
    </div>
  );
}

// ─── Stats strip ───────────────────────────────────────────────────────────────

const RESOURCE_STATS = [
  { val: "48+", label: "Resurse gratuite" },
  { val: "12k+", label: "Descărcări lunare" },
  { val: "100%", label: "Actualizate 2026" },
  { val: "0 RON", label: "Fără cont necesar" },
];

// ─── Main ──────────────────────────────────────────────────────────────────────

export function ResursePage({ onLogin, onBack }: ResursePageProps) {
  const [activeTab, setActiveTab] = useState("ghiduri");
  const [search, setSearch] = useState("");

  const resources = ALL_RESOURCES[activeTab] || [];
  const filtered = resources.filter(r =>
    !search ||
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.desc.toLowerCase().includes(search.toLowerCase())
  );

  // Move featured to front
  const sorted = [...filtered].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

  return (
    <div style={{ background: "#f3efe8", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Compact nav ── */}
      <div style={{
        background: "rgba(255,255,255,.97)", backdropFilter: "blur(18px)",
        borderBottom: "1px solid rgba(28,16,8,.08)",
        boxShadow: "0 1px 16px rgba(28,16,8,.07)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px", height: 68, display: "flex", alignItems: "center", gap: 20 }}>
          <button onClick={onBack} style={{
            display: "flex", alignItems: "center", gap: 7,
            border: "none", background: "transparent", cursor: "pointer",
            fontSize: 14, fontWeight: 500, color: "#6b5d52",
            padding: "7px 12px", borderRadius: 9, transition: "background .2s",
          }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(28,16,8,.06)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Înapoi
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#f59e0b,#92400e)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 16 }}>🌾</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-.04em", color: "#1c1008" }}>ArendaPro</span>
            <span style={{ color: "rgba(28,16,8,.2)", fontSize: 16, marginLeft: 2 }}>/</span>
            <span style={{ fontSize: 14, color: "#6b5d52", fontWeight: 500 }}>Resurse</span>
          </div>
          <button onClick={onLogin} style={{
            padding: "9px 22px", borderRadius: 10, border: "none",
            background: "linear-gradient(135deg,#f59e0b,#d97706)",
            cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#fff",
            boxShadow: "0 2px 10px rgba(217,119,6,.4)",
            display: "flex", alignItems: "center", gap: 6,
          }}>Începe gratuit <ArrowRight size={14} /></button>
        </div>
      </div>

      {/* ── Hero ── */}
      <div style={{
        background: "linear-gradient(160deg,#1c1309 0%,#2e1c08 100%)",
        padding: "60px 28px 80px", textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 120%,rgba(217,119,6,.22) 0%,transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "4px 14px", borderRadius: 100,
            background: "rgba(217,119,6,.15)", border: "1px solid rgba(217,119,6,.3)",
            fontSize: 11, fontWeight: 700, color: "#fbbf24", letterSpacing: ".07em",
            textTransform: "uppercase", marginBottom: 18,
          }}>
            <Star size={11} fill="#fbbf24" color="#fbbf24" /> 48+ resurse gratuite
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, color: "#ffffff", letterSpacing: "-.05em", lineHeight: 1.1, marginBottom: 14 }}>
            Resurse pentru{" "}
            <span style={{ background: "linear-gradient(135deg,#fde68a,#f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              fermieri digitali
            </span>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,245,235,.6)", marginBottom: 40, lineHeight: 1.65, maxWidth: 520, margin: "0 auto 40px" }}>
            Ghiduri, șabloane de contracte, tutoriale video și instrumente de calcul — totul gratuit, totul actualizat pentru 2026.
          </p>

          {/* Stats */}
          <div style={{ display: "flex", justifyContent: "center", gap: 40, marginBottom: 40, flexWrap: "wrap" }}>
            {RESOURCE_STATS.map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#fbbf24", letterSpacing: "-.04em" }}>{s.val}</div>
                <div style={{ fontSize: 12, color: "rgba(255,245,235,.5)", marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: "relative", maxWidth: 480, margin: "0 auto" }}>
            <Search size={16} color="#a8998e" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Caută ghiduri, șabloane, tutoriale..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "13px 18px 13px 46px", boxSizing: "border-box",
                borderRadius: 13, border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.09)", backdropFilter: "blur(12px)",
                color: "#ffffff", fontSize: 14, outline: "none",
              }}
            />
          </div>
        </div>
        <div style={{ position: "absolute", bottom: -1, left: 0, right: 0 }}>
          <svg viewBox="0 0 1440 50" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ width: "100%", height: 50, display: "block" }}>
            <path d="M0,25 Q360,50 720,22 Q1080,-4 1440,25 L1440,50 L0,50 Z" fill="#f3efe8" />
          </svg>
        </div>
      </div>

      {/* ── Tab navigation ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 28px 0" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 36, flexWrap: "wrap" }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const count = ALL_RESOURCES[tab.id]?.length || 0;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearch(""); }} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 20px", borderRadius: 12, cursor: "pointer",
                border: active ? "1px solid rgba(217,119,6,.3)" : "1px solid rgba(28,16,8,.1)",
                background: active ? "rgba(217,119,6,.1)" : "#ffffff",
                fontSize: 14, fontWeight: active ? 700 : 500,
                color: active ? "#92400e" : "#6b5d52",
                boxShadow: active ? "0 2px 10px rgba(217,119,6,.12)" : "0 1px 3px rgba(28,16,8,.05)",
                transition: "all .2s",
              }}>
                <span style={{ fontSize: 16 }}>{tab.emoji}</span>
                {tab.label}
                <span style={{
                  padding: "1px 8px", borderRadius: 6,
                  background: active ? "rgba(217,119,6,.15)" : "rgba(28,16,8,.06)",
                  fontSize: 11, fontWeight: 700,
                  color: active ? "#d97706" : "#a8998e",
                }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Tab description */}
        <div style={{ marginBottom: 32 }}>
          {activeTab === "ghiduri" && (
            <p style={{ fontSize: 14, color: "#6b5d52", lineHeight: 1.65 }}>
              <strong style={{ color: "#1c1008" }}>Ghiduri PDF</strong> — documente complete, cu referințe legale, exemple practice și checklist-uri. Descarcă și citește offline.
            </p>
          )}
          {activeTab === "sabloane" && (
            <p style={{ fontSize: 14, color: "#6b5d52", lineHeight: 1.65 }}>
              <strong style={{ color: "#1c1008" }}>Șabloane editabile</strong> — contracte, registre și notificări în format Word și PDF, redactate de juriști specializați în drept agricol.
            </p>
          )}
          {activeTab === "tutoriale" && (
            <p style={{ fontSize: 14, color: "#6b5d52", lineHeight: 1.65 }}>
              <strong style={{ color: "#1c1008" }}>Tutoriale video</strong> — screencast-uri pas cu pas pentru fiecare funcționalitate din ArendaPro, cu subtitrare în română.
            </p>
          )}
          {activeTab === "instrumente" && (
            <p style={{ fontSize: 14, color: "#6b5d52", lineHeight: 1.65 }}>
              <strong style={{ color: "#1c1008" }}>Instrumente web</strong> — calculatoare și verificatoare interactive, fără instalare, actualizate cu datele oficiale MADR și ANAF.
            </p>
          )}
        </div>

        {/* Resource grid */}
        {sorted.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#a8998e", fontSize: 15 }}>
            Nicio resursă găsită pentru „{search}"
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 18,
            marginBottom: 80,
            gridAutoRows: "auto",
          }}>
            {sorted.map(r => (
              <ResourceCard key={r.id} res={r} tab={activeTab} onLogin={onLogin} />
            ))}
          </div>
        )}
      </div>

      {/* ── Pro banner ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px 80px" }}>
        <div style={{
          background: "linear-gradient(135deg,#1c1309 0%,#2e1c08 100%)",
          borderRadius: 22, padding: "36px 44px",
          display: "grid", gridTemplateColumns: "1fr auto",
          alignItems: "center", gap: 32,
          position: "relative", overflow: "hidden",
          boxShadow: "0 10px 40px rgba(28,16,8,.2)",
        }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 80% 50%,rgba(217,119,6,.2) 0%,transparent 60%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "rgba(217,119,6,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Star size={19} color="#fbbf24" fill="#fbbf24" />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#ffffff" }}>
                  Deblochează toate resursele cu ArendaPro Pro
                </div>
              </div>
            </div>
            <p style={{ fontSize: 14, color: "rgba(255,245,235,.58)", lineHeight: 1.65, maxWidth: 580 }}>
              Contracte avansate, simulatoare de profitabilitate, chitanțe de arendă în natură și tutoriale premium — disponibile în planul Pro de la 79 RON/lună.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flexShrink: 0, position: "relative", zIndex: 1 }}>
            <button onClick={onLogin} style={{
              padding: "13px 28px", borderRadius: 12, border: "none",
              background: "linear-gradient(135deg,#f59e0b,#d97706)",
              cursor: "pointer", fontSize: 14, fontWeight: 800, color: "#fff",
              boxShadow: "0 3px 14px rgba(217,119,6,.5)",
              display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
            }}>Activează Pro <ArrowRight size={14} /></button>
            <button onClick={onLogin} style={{
              padding: "11px 28px", borderRadius: 12,
              border: "1px solid rgba(255,255,255,.18)",
              background: "rgba(255,255,255,.07)",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              color: "rgba(255,255,255,.8)", whiteSpace: "nowrap",
            }}>14 zile gratuit</button>
          </div>
        </div>
      </div>

      {/* ── Quick links ── */}
      <div style={{ background: "#ffffff", padding: "64px 28px", borderTop: "1px solid rgba(28,16,8,.07)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: "#1c1008", letterSpacing: "-.04em", marginBottom: 28 }}>
            Explorează și alte secțiuni
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {[
              { emoji: "📖", title: "Blog ArendaPro", desc: "Articole practice despre contracte, APIA, e-Transport și legislație agricolă.", label: "Citește blogul" },
              { emoji: "💰", title: "Prețuri și planuri", desc: "Compară planurile Start, Pro și Business și alege cel potrivit pentru ferma ta.", label: "Vezi prețurile" },
              { emoji: "🎓", title: "Documentație API", desc: "Integrează ArendaPro în sistemele tale prin API REST documentat cu Swagger.", label: "Documentație" },
            ].map((link, i) => (
              <button key={i} onClick={onLogin} style={{
                background: "transparent", border: "1px solid rgba(28,16,8,.09)",
                borderRadius: 16, padding: "22px", cursor: "pointer",
                textAlign: "left", transition: "all .22s",
                display: "flex", flexDirection: "column", gap: 10,
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(28,16,8,.02)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 22px rgba(28,16,8,.08)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                }}
              >
                <div style={{ fontSize: 28 }}>{link.emoji}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#1c1008", letterSpacing: "-.02em" }}>{link.title}</div>
                <div style={{ fontSize: 13, color: "#6b5d52", lineHeight: 1.6 }}>{link.desc}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "#d97706" }}>
                  {link.label} <ChevronRight size={13} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
