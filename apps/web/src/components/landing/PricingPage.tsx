"use client";
import { useState } from "react";
import { Check, X, ArrowRight, ChevronDown, ChevronUp, Zap, Shield, Users, Star } from "lucide-react";

interface PricingPageProps {
  onLogin: () => void;
  onBack: () => void;
}

// ─── Data ──────────────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "start",
    name: "Start",
    badge: null,
    desc: "Perfect pentru a începe digitalizarea fermei tale.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    cta: "Începe gratuit",
    ctaVariant: "outline" as const,
    color: "#6b5d52",
    features: [
      { label: "Până la 10 parcele",           included: true },
      { label: "Până la 5 arendatori",          included: true },
      { label: "3 contracte active",            included: true },
      { label: "Hartă interactivă de bază",     included: true },
      { label: "Export PDF (3/lună)",           included: true },
      { label: "Contracte generate automat",    included: false },
      { label: "e-Transport ANAF",              included: false },
      { label: "Distribuire arendă",            included: false },
      { label: "Alerte inteligente",            included: false },
      { label: "Multi-utilizator",              included: false },
      { label: "API access",                    included: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Cel mai popular",
    desc: "Pentru exploatații agricole active cu nevoi complete.",
    monthlyPrice: 99,
    yearlyPrice: 79,
    cta: "Începe 14 zile gratuit",
    ctaVariant: "primary" as const,
    color: "#d97706",
    features: [
      { label: "Parcele nelimitate",             included: true },
      { label: "Arendatori nelimitați",          included: true },
      { label: "Contracte nelimitate",           included: true },
      { label: "Hartă satelitară avansată",      included: true },
      { label: "Export PDF nelimitat",           included: true },
      { label: "Contracte generate automat",     included: true },
      { label: "e-Transport ANAF",               included: true },
      { label: "Distribuire arendă",             included: true },
      { label: "Alerte inteligente",             included: true },
      { label: "Multi-utilizator",               included: false },
      { label: "API access",                     included: false },
    ],
  },
  {
    id: "business",
    name: "Business",
    badge: null,
    desc: "Pentru cooperative și exploatații cu echipe mari.",
    monthlyPrice: 249,
    yearlyPrice: 199,
    cta: "Contactează-ne",
    ctaVariant: "outline" as const,
    color: "#7c3aed",
    features: [
      { label: "Parcele nelimitate",             included: true },
      { label: "Arendatori nelimitați",          included: true },
      { label: "Contracte nelimitate",           included: true },
      { label: "Hartă satelitară avansată",      included: true },
      { label: "Export PDF nelimitat",           included: true },
      { label: "Contracte generate automat",     included: true },
      { label: "e-Transport ANAF",               included: true },
      { label: "Distribuire arendă",             included: true },
      { label: "Alerte inteligente",             included: true },
      { label: "Până la 10 utilizatori",         included: true },
      { label: "API access + Integrări",         included: true },
    ],
  },
];

const COMPARISON_ROWS = [
  { section: "Parcele & Arendatori", items: [
    { label: "Parcele",         start: "10",          pro: "Nelimitat",  business: "Nelimitat" },
    { label: "Arendatori",      start: "5",           pro: "Nelimitat",  business: "Nelimitat" },
    { label: "Contracte active",start: "3",           pro: "Nelimitat",  business: "Nelimitat" },
  ]},
  { section: "Funcționalități", items: [
    { label: "Hartă interactivă",      start: "Bază",     pro: "Satelit HD", business: "Satelit HD + GIS" },
    { label: "Contracte automate",     start: false,      pro: true,         business: true },
    { label: "e-Transport ANAF",       start: false,      pro: true,         business: true },
    { label: "Distribuire arendă",     start: false,      pro: true,         business: true },
    { label: "Alerte inteligente",     start: false,      pro: true,         business: true },
    { label: "Export PDF",             start: "3/lună",   pro: "Nelimitat",  business: "Nelimitat" },
  ]},
  { section: "Echipă & Acces", items: [
    { label: "Utilizatori",        start: "1",         pro: "1",          business: "Până la 10" },
    { label: "API access",         start: false,       pro: false,        business: true },
    { label: "Integrare contab.",  start: false,       pro: false,        business: true },
  ]},
  { section: "Suport", items: [
    { label: "Documentație",       start: true,        pro: true,         business: true },
    { label: "Email suport",       start: false,       pro: true,         business: true },
    { label: "Suport prioritar",   start: false,       pro: false,        business: true },
    { label: "Manager dedicat",    start: false,       pro: false,        business: true },
    { label: "SLA garantat",       start: false,       pro: "99.5%",      business: "99.9%" },
  ]},
];

const FAQS = [
  {
    q: "Pot schimba planul oricând?",
    a: "Da, poți face upgrade sau downgrade oricând. La upgrade, plătești diferența pro-rata. La downgrade, creditul rămas se aplică la perioadele viitoare.",
  },
  {
    q: "Există perioadă de probă?",
    a: "Planul Pro vine cu 14 zile de probă complet gratuit, fără card bancar necesar. Dacă nu ești mulțumit, nu plătești nimic.",
  },
  {
    q: "Cum funcționează facturarea?",
    a: "Facturarea este lunară sau anuală (cu 20% reducere). Facturile sunt emise automat în RON cu TVA inclus, conforme cu legislația română.",
  },
  {
    q: "Datele mele sunt în siguranță?",
    a: "Datele sunt stocate pe servere certificate ISO 27001, în centre de date din UE. Respectăm GDPR și nu partajăm datele cu terți. Backup automat zilnic.",
  },
  {
    q: "Există contract minim de abonare?",
    a: "Nu. Planul lunar se poate anula oricând înainte de următoarea dată de facturare. Planul anual se poate anula, cu rambursare pro-rata pentru lunile rămase.",
  },
  {
    q: "Pot folosi ArendaPro pe telefon?",
    a: "Da. ArendaPro funcționează complet responsive pe orice dispozitiv — telefon, tabletă sau desktop. Aplicație nativă iOS/Android în curând.",
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function CellVal({ val }: { val: string | boolean }) {
  if (val === true)  return <Check size={17} color="#16a34a" strokeWidth={2.5} />;
  if (val === false) return <X    size={15} color="#c8b9ae" strokeWidth={2} />;
  return <span style={{ fontSize: 13, color: "#3d2e22", fontWeight: 500 }}>{val}</span>;
}

// ─── Components ────────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: "#ffffff", borderRadius: 16,
      border: "1px solid rgba(28,16,8,.07)",
      overflow: "hidden", transition: "box-shadow .2s",
      boxShadow: open ? "0 4px 20px rgba(28,16,8,.09)" : "0 1px 3px rgba(28,16,8,.05)",
    }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 24px", border: "none", background: "transparent",
        cursor: "pointer", textAlign: "left", gap: 16,
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#1c1008", letterSpacing: "-.015em" }}>{q}</span>
        <span style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: open ? "rgba(217,119,6,.12)" : "rgba(28,16,8,.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background .2s",
        }}>
          {open
            ? <ChevronUp  size={15} color={open ? "#d97706" : "#6b5d52"} />
            : <ChevronDown size={15} color="#6b5d52" />
          }
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 24px 22px", fontSize: 14, color: "#6b5d52", lineHeight: 1.72 }}>
          {a}
        </div>
      )}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export function PricingPage({ onLogin, onBack }: PricingPageProps) {
  const [annual, setAnnual] = useState(false);

  const PLAN_COLORS = { start: "#6b5d52", pro: "#d97706", business: "#7c3aed" } as Record<string, string>;

  return (
    <div style={{ background: "#f3efe8", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ── Nav strip ── */}
      <div style={{
        background: "rgba(255,255,255,.97)", backdropFilter: "blur(18px)",
        borderBottom: "1px solid rgba(28,16,8,.08)",
        boxShadow: "0 1px 16px rgba(28,16,8,.07)",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px", height: 68, display: "flex", alignItems: "center", gap: 24 }}>
          <button onClick={onBack} style={{
            display: "flex", alignItems: "center", gap: 8,
            border: "none", background: "transparent", cursor: "pointer",
            fontSize: 14, fontWeight: 500, color: "#6b5d52",
            padding: "7px 12px", borderRadius: 9,
            transition: "all .2s",
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
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "linear-gradient(135deg,#f59e0b,#92400e)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 17 }}>🌾</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-.04em", color: "#1c1008" }}>ArendaPro</span>
            <span style={{ color: "rgba(28,16,8,.2)", fontSize: 16, marginLeft: 2 }}>/</span>
            <span style={{ fontSize: 14, color: "#6b5d52", fontWeight: 500 }}>Prețuri</span>
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
      <div style={{ padding: "72px 28px 0", textAlign: "center" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "5px 16px", borderRadius: 100,
          background: "rgba(217,119,6,.1)", border: "1px solid rgba(217,119,6,.22)",
          fontSize: 11, fontWeight: 700, color: "#92400e", letterSpacing: ".08em",
          textTransform: "uppercase", marginBottom: 20,
        }}>
          <Zap size={12} /> Prețuri transparente, fără surprize
        </div>

        <h1 style={{ fontSize: 48, fontWeight: 900, color: "#1c1008", letterSpacing: "-.05em", lineHeight: 1.1, marginBottom: 16 }}>
          Planul potrivit pentru{" "}
          <span style={{
            background: "linear-gradient(135deg,#f59e0b,#d97706)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>ferma ta</span>
        </h1>
        <p style={{ fontSize: 17, color: "#6b5d52", lineHeight: 1.65, maxWidth: 500, margin: "0 auto 40px" }}>
          Începe gratuit, fără card bancar. Fă upgrade când ești pregătit.
        </p>

        {/* Billing toggle */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, marginBottom: 64 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: !annual ? "#1c1008" : "#a8998e" }}>Lunar</span>
          <button onClick={() => setAnnual(v => !v)} style={{
            width: 52, height: 28, borderRadius: 100, border: "none", cursor: "pointer",
            background: annual ? "linear-gradient(135deg,#f59e0b,#d97706)" : "rgba(28,16,8,.12)",
            position: "relative", transition: "background .25s",
            boxShadow: annual ? "0 2px 8px rgba(217,119,6,.4)" : "none",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", background: "#ffffff",
              position: "absolute", top: 3, transition: "left .25s",
              left: annual ? 27 : 3,
              boxShadow: "0 1px 4px rgba(0,0,0,.2)",
            }} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 500, color: annual ? "#1c1008" : "#a8998e", display: "flex", alignItems: "center", gap: 6 }}>
            Anual
            <span style={{
              padding: "2px 9px", borderRadius: 100,
              background: "rgba(22,163,74,.12)", border: "1px solid rgba(22,163,74,.22)",
              fontSize: 11, fontWeight: 700, color: "#16a34a",
            }}>-20%</span>
          </span>
        </div>
      </div>

      {/* ── Plan cards ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px 80px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, alignItems: "start" }}>
          {PLANS.map(plan => {
            const isPro = plan.id === "pro";
            const price = annual ? plan.yearlyPrice : plan.monthlyPrice;
            return (
              <div key={plan.id} style={{
                background: isPro ? "linear-gradient(160deg,#1c1309 0%,#2e1c08 100%)" : "#ffffff",
                borderRadius: 24,
                border: isPro ? "1px solid rgba(217,119,6,.3)" : "1px solid rgba(28,16,8,.08)",
                boxShadow: isPro
                  ? "0 20px 60px rgba(28,16,8,.35), 0 0 0 1px rgba(217,119,6,.12)"
                  : "0 1px 3px rgba(28,16,8,.06)",
                padding: "32px",
                position: "relative",
                overflow: "hidden",
                transform: isPro ? "scale(1.04)" : "scale(1)",
                zIndex: isPro ? 2 : 1,
              }}>
                {isPro && (
                  <div style={{
                    position: "absolute", top: 0, right: 0, width: 200, height: 200,
                    background: "radial-gradient(circle at top right,rgba(217,119,6,.2) 0%,transparent 65%)",
                    pointerEvents: "none",
                  }} />
                )}

                {/* Badge */}
                {plan.badge && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "4px 12px", borderRadius: 100, marginBottom: 20,
                    background: "rgba(217,119,6,.18)", border: "1px solid rgba(217,119,6,.35)",
                  }}>
                    <Star size={11} color="#fbbf24" fill="#fbbf24" />
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#fbbf24", letterSpacing: ".06em" }}>
                      {plan.badge.toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Plan name */}
                <div style={{ fontSize: 13, fontWeight: 700, color: isPro ? "rgba(255,245,235,.55)" : "#a8998e", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6 }}>
                  {plan.name}
                </div>
                <p style={{ fontSize: 13, color: isPro ? "rgba(255,245,235,.55)" : "#6b5d52", marginBottom: 28, lineHeight: 1.6 }}>
                  {plan.desc}
                </p>

                {/* Price */}
                <div style={{ marginBottom: 32 }}>
                  {price === 0 ? (
                    <div>
                      <span style={{ fontSize: 46, fontWeight: 900, letterSpacing: "-.05em", color: isPro ? "#ffffff" : "#1c1008" }}>
                        Gratuit
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: isPro ? "rgba(255,245,235,.55)" : "#6b5d52", marginBottom: 4 }}>RON</span>
                      <span style={{ fontSize: 50, fontWeight: 900, letterSpacing: "-.05em", color: isPro ? "#ffffff" : "#1c1008", lineHeight: 1 }}>
                        {price}
                      </span>
                      <span style={{ fontSize: 14, color: isPro ? "rgba(255,245,235,.45)" : "#a8998e", fontWeight: 500 }}>/lună</span>
                    </div>
                  )}
                  {annual && price > 0 && (
                    <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600, marginTop: 5 }}>
                      Economisești {(plan.monthlyPrice - plan.yearlyPrice) * 12} RON/an
                    </div>
                  )}
                  {!annual && price === 0 && (
                    <div style={{ fontSize: 12, color: isPro ? "rgba(255,245,235,.38)" : "#a8998e", marginTop: 4 }}>
                      Pentru totdeauna
                    </div>
                  )}
                  {!annual && price > 0 && (
                    <div style={{ fontSize: 12, color: isPro ? "rgba(255,245,235,.38)" : "#a8998e", marginTop: 4 }}>
                      + TVA · facturare lunară
                    </div>
                  )}
                </div>

                {/* CTA */}
                <button onClick={onLogin} style={{
                  width: "100%", padding: "13px 0", borderRadius: 12, cursor: "pointer",
                  fontSize: 14, fontWeight: 800, transition: "all .25s",
                  border: isPro ? "none" : `1.5px solid ${plan.id === "business" ? "#7c3aed40" : "rgba(28,16,8,.15)"}`,
                  background: isPro
                    ? "linear-gradient(135deg,#f59e0b,#d97706)"
                    : plan.id === "business" ? "rgba(124,58,237,.07)" : "rgba(28,16,8,.04)",
                  color: isPro ? "#ffffff" : plan.id === "business" ? "#7c3aed" : "#1c1008",
                  boxShadow: isPro ? "0 4px 20px rgba(217,119,6,.5)" : "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}>
                  {plan.cta} <ArrowRight size={14} />
                </button>

                {/* Divider */}
                <div style={{ borderTop: `1px solid ${isPro ? "rgba(255,255,255,.08)" : "rgba(28,16,8,.07)"}`, margin: "28px 0" }} />

                {/* Features */}
                <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                  {plan.features.map((f, fi) => (
                    <div key={fi} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: f.included
                          ? isPro ? "rgba(217,119,6,.22)" : "rgba(22,163,74,.1)"
                          : "rgba(28,16,8,.04)",
                      }}>
                        {f.included
                          ? <Check size={12} color={isPro ? "#fbbf24" : "#16a34a"} strokeWidth={2.5} />
                          : <X size={11} color="#c8b9ae" strokeWidth={2} />
                        }
                      </div>
                      <span style={{
                        fontSize: 13, fontWeight: 500,
                        color: f.included
                          ? isPro ? "rgba(255,245,235,.85)" : "#3d2e22"
                          : isPro ? "rgba(255,245,235,.3)" : "#c8b9ae",
                      }}>{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise callout */}
        <div style={{
          marginTop: 28,
          background: "#ffffff",
          borderRadius: 18, padding: "24px 32px",
          border: "1px solid rgba(28,16,8,.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
          boxShadow: "0 1px 3px rgba(28,16,8,.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(28,16,8,.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={20} color="#6b5d52" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#1c1008", marginBottom: 3 }}>
                Cooperativă sau companie mare?
              </div>
              <div style={{ fontSize: 13, color: "#6b5d52" }}>
                Oferim prețuri personalizate pentru exploatații cu peste 10.000 ha sau cooperative agricole.
              </div>
            </div>
          </div>
          <button onClick={onLogin} style={{
            padding: "11px 24px", borderRadius: 11, flexShrink: 0,
            border: "1.5px solid rgba(28,16,8,.15)",
            background: "transparent", cursor: "pointer",
            fontSize: 14, fontWeight: 700, color: "#1c1008",
            whiteSpace: "nowrap",
          }}>Contactează vânzări</button>
        </div>
      </div>

      {/* ── Comparison table ── */}
      <div style={{ background: "#ffffff", padding: "80px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <h2 style={{ fontSize: 34, fontWeight: 900, color: "#1c1008", letterSpacing: "-.04em", marginBottom: 12 }}>
              Comparație completă
            </h2>
            <p style={{ fontSize: 15, color: "#6b5d52" }}>Toate funcționalitățile, plan cu plan.</p>
          </div>

          <div style={{ borderRadius: 20, border: "1px solid rgba(28,16,8,.08)", overflow: "hidden" }}>
            {/* Header row */}
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr",
              background: "#f3efe8",
              borderBottom: "1px solid rgba(28,16,8,.08)",
            }}>
              <div style={{ padding: "18px 24px" }} />
              {["Start", "Pro", "Business"].map((name, i) => (
                <div key={name} style={{
                  padding: "18px 24px", textAlign: "center",
                  borderLeft: "1px solid rgba(28,16,8,.08)",
                  background: i === 1 ? "rgba(217,119,6,.06)" : "transparent",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: i === 1 ? "#d97706" : "#1c1008", letterSpacing: ".02em" }}>{name}</div>
                  {i === 1 && <div style={{ fontSize: 10, color: "#d97706", fontWeight: 700, marginTop: 2 }}>★ POPULAR</div>}
                </div>
              ))}
            </div>

            {COMPARISON_ROWS.map((section, si) => (
              <div key={si}>
                {/* Section header */}
                <div style={{
                  padding: "12px 24px",
                  background: "rgba(28,16,8,.03)",
                  borderBottom: "1px solid rgba(28,16,8,.06)",
                  borderTop: si > 0 ? "1px solid rgba(28,16,8,.06)" : "none",
                }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: "#a8998e", textTransform: "uppercase", letterSpacing: ".1em" }}>{section.section}</span>
                </div>

                {section.items.map((row, ri) => (
                  <div key={ri} style={{
                    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr",
                    borderBottom: ri < section.items.length - 1 ? "1px solid rgba(28,16,8,.05)" : "none",
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "rgba(28,16,8,.02)"}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
                  >
                    <div style={{ padding: "14px 24px", fontSize: 14, color: "#3d2e22", fontWeight: 500 }}>{row.label}</div>
                    {[row.start, row.pro, row.business].map((val, vi) => (
                      <div key={vi} style={{
                        padding: "14px 24px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        borderLeft: "1px solid rgba(28,16,8,.06)",
                        background: vi === 1 ? "rgba(217,119,6,.03)" : "transparent",
                      }}>
                        <CellVal val={val} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Trust badges ── */}
      <div style={{ background: "#f3efe8", padding: "64px 0" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 28px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#a8998e", fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 32 }}>
            De încredere pentru fermieri din toată România
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
            {[
              { icon: Shield, label: "GDPR Conform",       sub: "Date stocate în UE" },
              { icon: Zap,    label: "99.9% Uptime",       sub: "SLA garantat" },
              { icon: Shield, label: "ISO 27001",          sub: "Securitate certificată" },
              { icon: Users,  label: "2,400+ Fermieri",    sub: "Ne folosesc zilnic" },
            ].map((b, i) => {
              const Icon = b.icon;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: "#ffffff",
                    border: "1px solid rgba(28,16,8,.08)",
                    boxShadow: "0 1px 4px rgba(28,16,8,.05)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon size={20} color="#d97706" />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1008" }}>{b.label}</div>
                  <div style={{ fontSize: 12, color: "#a8998e" }}>{b.sub}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div style={{ background: "#ffffff", padding: "80px 0" }}>
        <div style={{ maxWidth: 740, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 style={{ fontSize: 34, fontWeight: 900, color: "#1c1008", letterSpacing: "-.04em", marginBottom: 12 }}>
              Întrebări frecvente
            </h2>
            <p style={{ fontSize: 15, color: "#6b5d52" }}>
              Nu găsești răspunsul? <button onClick={onLogin} style={{ border: "none", background: "transparent", color: "#d97706", fontWeight: 700, cursor: "pointer", fontSize: 15, padding: 0 }}>Scrie-ne</button>
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FAQS.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Final CTA ── */}
      <div style={{ background: "linear-gradient(155deg,#1c1309 0%,#2e1c08 100%)", padding: "80px 28px", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 80%,rgba(217,119,6,.2) 0%,transparent 65%)",
          pointerEvents: "none",
        }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 42, marginBottom: 18 }}>🌾</div>
          <h2 style={{ fontSize: 40, fontWeight: 900, color: "#ffffff", letterSpacing: "-.05em", lineHeight: 1.15, marginBottom: 16 }}>
            Gata să digitalizezi<br />ferma ta?
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,245,235,.6)", lineHeight: 1.65, maxWidth: 440, margin: "0 auto 36px" }}>
            14 zile gratuit, fără card bancar. Configurare în 5 minute.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onLogin} style={{
              padding: "15px 34px", borderRadius: 13, border: "none",
              background: "linear-gradient(135deg,#f59e0b,#d97706)",
              cursor: "pointer", fontSize: 15, fontWeight: 800, color: "#fff",
              boxShadow: "0 4px 28px rgba(217,119,6,.55), inset 0 1px 0 rgba(255,255,255,.15)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              Începe gratuit <ArrowRight size={16} />
            </button>
            <button onClick={onLogin} style={{
              padding: "15px 34px", borderRadius: 13,
              border: "1px solid rgba(255,255,255,.2)",
              background: "rgba(255,255,255,.07)",
              cursor: "pointer", fontSize: 15, fontWeight: 500,
              color: "rgba(255,255,255,.88)",
            }}>
              Intră în cont
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
