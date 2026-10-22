"use client";
import { useState } from "react";
import { Search, ArrowRight, Clock, ChevronRight, Tag, TrendingUp, BookOpen, Rss } from "lucide-react";

interface BlogPageProps {
  onLogin: () => void;
  onBack: () => void;
}

// ─── Data ──────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "toate",       label: "Toate",        color: "#6b5d52" },
  { id: "contracte",   label: "Contracte",    color: "#d97706" },
  { id: "apia",        label: "APIA",         color: "#16a34a" },
  { id: "e-transport", label: "e-Transport",  color: "#dc2626" },
  { id: "juridic",     label: "Juridic",      color: "#7c3aed" },
  { id: "tehnologie",  label: "Tehnologie",   color: "#0284c7" },
  { id: "piata",       label: "Piață",        color: "#ea580c" },
];

const CAT_META: Record<string, { color: string; bg: string }> = {
  contracte:   { color: "#d97706", bg: "rgba(217,119,6,.1)" },
  apia:        { color: "#16a34a", bg: "rgba(22,163,74,.1)" },
  "e-transport":{ color: "#dc2626", bg: "rgba(220,38,38,.09)" },
  juridic:     { color: "#7c3aed", bg: "rgba(124,58,237,.09)" },
  tehnologie:  { color: "#0284c7", bg: "rgba(2,132,199,.09)" },
  piata:       { color: "#ea580c", bg: "rgba(234,88,12,.09)" },
};

const FEATURED = {
  id: "f1",
  category: "e-transport",
  title: "Ghid complet: e-Transport ANAF pentru utilaje agricole — tot ce trebuie să știi în 2026",
  excerpt: "De la primul UIT până la codurile CN pentru cereale și penalitățile pentru transport nedeclarat — ghidul definitiv pentru fermieri și arendași.",
  author: "Echipa ArendaPro",
  readTime: "14 min",
  date: "12 Iul 2026",
  tags: ["UIT", "ANAF", "OUG 41/2022"],
};

const ARTICLES = [
  {
    id: "1", category: "apia",
    title: "APIA 2026: Ce se schimbă în declarațiile de suprafață arendată",
    excerpt: "Modificările din campania 2026 privind suprafețele arendate, termenele și documentele necesare la depunerea cererii unice.",
    author: "Ana Ionescu", readTime: "8 min", date: "10 Iul 2026",
    tags: ["APIA", "Subvenții"],
  },
  {
    id: "2", category: "contracte",
    title: "Clauze obligatorii vs. clauze recomandate în contractul de arendă 2026",
    excerpt: "Codul Civil impune anumite clauze minime. Avocații recomandă altele. Iată diferența și de ce contează pentru protecția ta.",
    author: "Mihai Popescu", readTime: "10 min", date: "8 Iul 2026",
    tags: ["Contract", "Clauze", "Juridic"],
  },
  {
    id: "3", category: "tehnologie",
    title: "Cum digitalizezi un registru cu 200+ parcele și arendatori în 3 zile",
    excerpt: "Pașii practici pentru migrarea de la Excel sau hârtie la o platformă digitală — fără pierderi de date și fără haos.",
    author: "Echipa ArendaPro", readTime: "6 min", date: "5 Iul 2026",
    tags: ["Digitalizare", "Import", "Excel"],
  },
  {
    id: "4", category: "juridic",
    title: "Penalități ANAF 2026 pentru transport nedeclarat: ce riscați concret",
    excerpt: "Amenzi între 5.000 și 50.000 RON, confiscarea bunurilor și suspendarea codului de înregistrare. Cum eviți aceste sancțiuni.",
    author: "Cristina Aldea", readTime: "7 min", date: "3 Iul 2026",
    tags: ["ANAF", "Amenzi", "Conformitate"],
  },
  {
    id: "5", category: "piata",
    title: "Prețuri arendă 2026: tendințe și medii pe județ în România",
    excerpt: "Date actualizate de la MADR și fermieri: cât costă arenda pe hectar în Ilfov, Olt, Teleorman, Brăila și alte județe cheie.",
    author: "Radu Stancu", readTime: "9 min", date: "1 Iul 2026",
    tags: ["Prețuri", "MADR", "Analiză"],
  },
  {
    id: "6", category: "apia",
    title: "Inspecțiile APIA la fermă: ce verifică inspectorul și cum te pregătești",
    excerpt: "Lista completă a documentelor solicitate la control, greșelile frecvente care duc la reducerea subvențiilor și cum le eviți.",
    author: "Ana Ionescu", readTime: "11 min", date: "28 Iun 2026",
    tags: ["APIA", "Control", "Subvenții"],
  },
  {
    id: "7", category: "e-transport",
    title: "UIT vs. cod TARIC: ce confundă fermierii și cum se aplică corect",
    excerpt: "Codul TARIC identifică marfa la import/export vamal. Codul CN din e-Transport identifică marfa în transport intern. Nu sunt același lucru.",
    author: "Echipa ArendaPro", readTime: "5 min", date: "25 Iun 2026",
    tags: ["UIT", "TARIC", "CN"],
  },
  {
    id: "8", category: "contracte",
    title: "Cum calculezi și distribui arenda în natură (cereale) corect",
    excerpt: "Formula de conversie, prețurile de referință MADR, documentația necesară și cum eviți disputele cu arendatorii la distribuire.",
    author: "Mihai Popescu", readTime: "8 min", date: "22 Iun 2026",
    tags: ["Distribuire", "Cereale", "MADR"],
  },
  {
    id: "9", category: "tehnologie",
    title: "GDPR și baza de date a arendatorilor: ce obligații ai ca fermier",
    excerpt: "CNP-urile, CUI-urile și datele bancare ale arendatorilor sunt date personale. Cum le stochezi legal și ce consimțăminte trebuie obținute.",
    author: "Cristina Aldea", readTime: "7 min", date: "18 Iun 2026",
    tags: ["GDPR", "Date personale", "Conformitate"],
  },
];

const POPULAR = ARTICLES.slice(0, 4);

// ─── Components ────────────────────────────────────────────────────────────────

function CategoryBadge({ cat, size = "sm" }: { cat: string; size?: "sm" | "md" }) {
  const meta = CAT_META[cat] || { color: "#6b5d52", bg: "rgba(107,93,82,.09)" };
  const catLabel = CATEGORIES.find(c => c.id === cat)?.label || cat;
  return (
    <span style={{
      display: "inline-block",
      padding: size === "md" ? "4px 12px" : "3px 9px",
      borderRadius: 100,
      background: meta.bg,
      fontSize: size === "md" ? 12 : 10,
      fontWeight: 700, letterSpacing: ".07em",
      color: meta.color, textTransform: "uppercase",
    }}>{catLabel}</span>
  );
}

function ArticleCard({ article, featured = false }: { article: typeof ARTICLES[0]; featured?: boolean }) {
  const [hovered, setHovered] = useState(false);

  if (featured) {
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: "#ffffff", borderRadius: 22, padding: "36px 40px",
          border: "1px solid rgba(28,16,8,.07)",
          boxShadow: hovered ? "0 12px 40px rgba(28,16,8,.12)" : "0 1px 4px rgba(28,16,8,.06)",
          transition: "box-shadow .25s", cursor: "pointer",
          position: "relative", overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute", top: 0, right: 0, width: 280, height: 280,
          background: `radial-gradient(circle at top right,${CAT_META[article.category]?.bg || "rgba(217,119,6,.07)"} 0%,transparent 70%)`,
          pointerEvents: "none",
        }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <CategoryBadge cat={article.category} size="md" />
          <span style={{ fontSize: 10, fontWeight: 700, color: "#d97706", letterSpacing: ".07em", textTransform: "uppercase" }}>Articol recomandat</span>
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 900, color: "#1c1008", letterSpacing: "-.04em", lineHeight: 1.22, maxWidth: 680, marginBottom: 14 }}>
          {article.title}
        </h2>
        <p style={{ fontSize: 15, color: "#6b5d52", lineHeight: 1.7, maxWidth: 620, marginBottom: 26 }}>
          {article.excerpt}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 26 }}>
          {article.tags.map(tag => (
            <span key={tag} style={{
              padding: "3px 10px", borderRadius: 7,
              background: "rgba(28,16,8,.05)", border: "1px solid rgba(28,16,8,.08)",
              fontSize: 11, fontWeight: 600, color: "#6b5d52",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              <Tag size={9} /> {tag}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: "#a8998e" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Clock size={13} /> {article.readTime}</span>
            <span>{article.author}</span>
            <span>{article.date}</span>
          </div>
          <button style={{
            border: "none", background: "transparent", padding: 0, cursor: "pointer",
            fontSize: 14, fontWeight: 700, color: CAT_META[article.category]?.color || "#d97706",
            display: "flex", alignItems: "center", gap: 6,
          }}>Citește <ArrowRight size={14} /></button>
        </div>
      </div>
    );
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#ffffff", borderRadius: 18, padding: "24px",
        border: "1px solid rgba(28,16,8,.07)",
        boxShadow: hovered ? "0 8px 30px rgba(28,16,8,.11)" : "0 1px 3px rgba(28,16,8,.05)",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        transition: "all .22s", cursor: "pointer",
        display: "flex", flexDirection: "column", gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <CategoryBadge cat={article.category} />
        <ChevronRight size={14} color="#c8b9ae" />
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 800, color: "#1c1008", lineHeight: 1.35, letterSpacing: "-.02em", margin: 0 }}>
        {article.title}
      </h3>
      <p style={{ fontSize: 13, color: "#6b5d52", lineHeight: 1.65, margin: 0, flex: 1 }}>
        {article.excerpt}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {article.tags.slice(0, 2).map(tag => (
          <span key={tag} style={{
            padding: "2px 8px", borderRadius: 6,
            background: "rgba(28,16,8,.04)", border: "1px solid rgba(28,16,8,.07)",
            fontSize: 10, fontWeight: 600, color: "#a8998e",
          }}>{tag}</span>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4, borderTop: "1px solid rgba(28,16,8,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#a8998e" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} /> {article.readTime}</span>
          <span>{article.date}</span>
        </div>
        <button style={{
          border: "none", background: "transparent", padding: 0, cursor: "pointer",
          fontSize: 12, fontWeight: 700, color: CAT_META[article.category]?.color || "#d97706",
          display: "flex", alignItems: "center", gap: 3,
        }}>Citește <ChevronRight size={12} /></button>
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

export function BlogPage({ onLogin, onBack }: BlogPageProps) {
  const [activeCat, setActiveCat] = useState("toate");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PER_PAGE = 6;

  const filtered = ARTICLES.filter(a => {
    const matchCat = activeCat === "toate" || a.category === activeCat;
    const q = search.toLowerCase();
    const matchSearch = !q || a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q) || a.tags.some(t => t.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });

  const paginated = filtered.slice(0, page * PER_PAGE);
  const hasMore = paginated.length < filtered.length;

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
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#6b5d52", fontWeight: 500 }}>
              <BookOpen size={15} /> Blog
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 9,
              border: "1px solid rgba(28,16,8,.12)",
              background: "transparent", cursor: "pointer",
              fontSize: 13, fontWeight: 600, color: "#6b5d52",
            }}><Rss size={14} /> Abonare RSS</button>
            <button onClick={onLogin} style={{
              padding: "9px 22px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg,#f59e0b,#d97706)",
              cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#fff",
              boxShadow: "0 2px 10px rgba(217,119,6,.4)",
              display: "flex", alignItems: "center", gap: 6,
            }}>Începe gratuit <ArrowRight size={14} /></button>
          </div>
        </div>
      </div>

      {/* ── Hero / search bar ── */}
      <div style={{
        background: "linear-gradient(160deg,#1c1309 0%,#2e1c08 100%)",
        padding: "60px 28px 56px", textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 100%,rgba(217,119,6,.2) 0%,transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "4px 14px", borderRadius: 100,
            background: "rgba(217,119,6,.15)", border: "1px solid rgba(217,119,6,.3)",
            fontSize: 11, fontWeight: 700, color: "#fbbf24", letterSpacing: ".07em",
            textTransform: "uppercase", marginBottom: 18,
          }}>
            <TrendingUp size={12} /> Resurse gratuite pentru fermieri
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 900, color: "#ffffff", letterSpacing: "-.05em", lineHeight: 1.1, marginBottom: 14 }}>
            Blog{" "}
            <span style={{ background: "linear-gradient(135deg,#fde68a,#f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              ArendaPro
            </span>
          </h1>
          <p style={{ fontSize: 16, color: "rgba(255,245,235,.6)", marginBottom: 32, lineHeight: 1.65 }}>
            Ghiduri practice, noutăți legislative și sfaturi pentru fermierii din România.
          </p>
          <div style={{ position: "relative", maxWidth: 520, margin: "0 auto" }}>
            <Search size={16} color="#a8998e" style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Caută articole (APIA, e-Transport, contracte...)"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{
                width: "100%", padding: "14px 18px 14px 46px", boxSizing: "border-box",
                borderRadius: 14, border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.09)", backdropFilter: "blur(12px)",
                color: "#ffffff", fontSize: 15, outline: "none",
              }}
            />
          </div>
        </div>
        {/* Wave */}
        <div style={{ position: "absolute", bottom: -1, left: 0, right: 0 }}>
          <svg viewBox="0 0 1440 50" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ width: "100%", height: 50, display: "block" }}>
            <path d="M0,25 Q360,50 720,22 Q1080,-4 1440,25 L1440,50 L0,50 Z" fill="#f3efe8" />
          </svg>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 28px 96px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 40, alignItems: "start" }}>

          {/* Main column */}
          <div>
            {/* Category filters */}
            <div style={{ display: "flex", gap: 8, marginBottom: 32, flexWrap: "wrap" }}>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => { setActiveCat(cat.id); setPage(1); }} style={{
                  padding: "7px 16px", borderRadius: 100, cursor: "pointer",
                  border: activeCat === cat.id ? `1px solid ${cat.color}50` : "1px solid rgba(28,16,8,.11)",
                  background: activeCat === cat.id ? `${cat.color}12` : "#ffffff",
                  fontSize: 13, fontWeight: activeCat === cat.id ? 700 : 500,
                  color: activeCat === cat.id ? cat.color : "#6b5d52",
                  transition: "all .2s",
                }}>{cat.label}</button>
              ))}
            </div>

            {/* Featured article */}
            {(activeCat === "toate" || activeCat === "e-transport") && !search && (
              <div style={{ marginBottom: 24 }}>
                <ArticleCard article={FEATURED} featured />
              </div>
            )}

            {/* Article grid */}
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#a8998e", fontSize: 15 }}>
                Niciun articol găsit pentru „{search}"
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
                  {paginated.map(a => <ArticleCard key={a.id} article={a} />)}
                </div>

                {/* Load more */}
                {hasMore && (
                  <div style={{ textAlign: "center", marginTop: 32 }}>
                    <button onClick={() => setPage(p => p + 1)} style={{
                      padding: "12px 32px", borderRadius: 12,
                      border: "1.5px solid rgba(28,16,8,.14)",
                      background: "#ffffff", cursor: "pointer",
                      fontSize: 14, fontWeight: 700, color: "#1c1008",
                      boxShadow: "0 1px 4px rgba(28,16,8,.06)",
                      transition: "all .2s",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(28,16,8,.1)")}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(28,16,8,.06)")}
                    >
                      Încarcă mai multe ({filtered.length - paginated.length} rămase)
                    </button>
                  </div>
                )}

                {!hasMore && filtered.length > 0 && (
                  <p style={{ textAlign: "center", fontSize: 13, color: "#a8998e", marginTop: 32 }}>
                    Ai citit toate {filtered.length} articolele din această categorie.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Popular */}
            <div style={{ background: "#ffffff", borderRadius: 18, padding: "24px", border: "1px solid rgba(28,16,8,.07)", boxShadow: "0 1px 3px rgba(28,16,8,.05)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1c1008", marginBottom: 18, letterSpacing: "-.01em" }}>
                📈 Cele mai citite
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {POPULAR.map((a, i) => (
                  <div key={a.id} style={{
                    padding: "14px 0", cursor: "pointer",
                    borderBottom: i < POPULAR.length - 1 ? "1px solid rgba(28,16,8,.06)" : "none",
                    transition: "opacity .2s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = ".75")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                        background: i === 0 ? "rgba(217,119,6,.12)" : "rgba(28,16,8,.05)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 800,
                        color: i === 0 ? "#d97706" : "#a8998e",
                      }}>{i + 1}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1008", lineHeight: 1.35, marginBottom: 4 }}>{a.title}</div>
                        <div style={{ fontSize: 11, color: "#a8998e", display: "flex", gap: 8 }}>
                          <span>{a.readTime}</span>
                          <span>{a.date}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Categories breakdown */}
            <div style={{ background: "#ffffff", borderRadius: 18, padding: "24px", border: "1px solid rgba(28,16,8,.07)", boxShadow: "0 1px 3px rgba(28,16,8,.05)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "#1c1008", marginBottom: 18, letterSpacing: "-.01em" }}>
                🏷 Categorii
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {CATEGORIES.filter(c => c.id !== "toate").map(cat => {
                  const count = ARTICLES.filter(a => a.category === cat.id).length + (cat.id === "e-transport" ? 1 : 0);
                  return (
                    <button key={cat.id} onClick={() => { setActiveCat(cat.id); setPage(1); }} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 12px", borderRadius: 10, border: "none",
                      background: activeCat === cat.id ? `${cat.color}0e` : "transparent",
                      cursor: "pointer", transition: "background .2s",
                      width: "100%",
                    }}
                      onMouseEnter={e => { if (activeCat !== cat.id) (e.currentTarget.style.background = "rgba(28,16,8,.04)"); }}
                      onMouseLeave={e => { if (activeCat !== cat.id) (e.currentTarget.style.background = "transparent"); }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: activeCat === cat.id ? cat.color : "#3d2e22" }}>{cat.label}</span>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: activeCat === cat.id ? cat.color : "#a8998e",
                        background: activeCat === cat.id ? `${cat.color}15` : "rgba(28,16,8,.06)",
                        padding: "2px 8px", borderRadius: 6,
                      }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Newsletter */}
            <div style={{
              background: "linear-gradient(160deg,#1c1309,#2e1c08)",
              borderRadius: 18, padding: "24px",
              border: "1px solid rgba(217,119,6,.15)",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: "radial-gradient(circle at top right,rgba(217,119,6,.2) 0%,transparent 70%)", pointerEvents: "none" }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 22, marginBottom: 10 }}>📬</div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "#ffffff", marginBottom: 8 }}>
                  Noutăți agricole săptămânal
                </h3>
                <p style={{ fontSize: 13, color: "rgba(255,245,235,.55)", lineHeight: 1.65, marginBottom: 16 }}>
                  Modificări legislative, ghiduri noi și sfaturi practice — direct în inbox.
                </p>
                <input
                  type="email"
                  placeholder="email@ferma.ro"
                  style={{
                    width: "100%", padding: "10px 14px", boxSizing: "border-box",
                    borderRadius: 10, border: "1px solid rgba(255,255,255,.12)",
                    background: "rgba(255,255,255,.08)",
                    color: "#ffffff", fontSize: 13, outline: "none", marginBottom: 10,
                  }}
                />
                <button onClick={onLogin} style={{
                  width: "100%", padding: "11px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg,#f59e0b,#d97706)",
                  cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff",
                  boxShadow: "0 2px 10px rgba(217,119,6,.4)",
                }}>Abonare gratuită</button>
                <p style={{ fontSize: 11, color: "rgba(255,245,235,.35)", textAlign: "center", marginTop: 10 }}>
                  Fără spam. Dezabonare oricând.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom CTA ── */}
      <div style={{ background: "#ffffff", padding: "64px 28px", borderTop: "1px solid rgba(28,16,8,.07)" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🌾</div>
          <h2 style={{ fontSize: 30, fontWeight: 900, color: "#1c1008", letterSpacing: "-.04em", marginBottom: 12 }}>
            Pune în practică ce-ai citit
          </h2>
          <p style={{ fontSize: 15, color: "#6b5d52", lineHeight: 1.65, marginBottom: 28 }}>
            ArendaPro pune în practică toate ghidurile din blog — contracte, e-Transport, distribuire arendă — într-o singură platformă.
          </p>
          <button onClick={onLogin} style={{
            padding: "14px 34px", borderRadius: 13, border: "none",
            background: "linear-gradient(135deg,#f59e0b,#d97706)",
            cursor: "pointer", fontSize: 15, fontWeight: 800, color: "#fff",
            boxShadow: "0 4px 24px rgba(217,119,6,.45)",
            display: "inline-flex", alignItems: "center", gap: 8,
          }}>Începe gratuit 14 zile <ArrowRight size={15} /></button>
        </div>
      </div>
    </div>
  );
}
