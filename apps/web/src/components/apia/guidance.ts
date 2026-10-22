import type { SectionKey } from "./data";

// Conținut versionat în cod (fără CMS în aplicație). Actualizările se fac prin modificarea acestui fișier și incrementarea GUIDANCE_VERSION.
export const GUIDANCE_VERSION = "2026.1";
export const GUIDANCE_UPDATED = "2026-10-22";
export const GUIDANCE_CAMPAIGNS = [2026];

export type ContentType = "OFFICIAL_INFORMATION" | "ARENDAPRO_GUIDANCE" | "RECOMMENDATION" | "WARNING_EXPLANATION" | "FIELD_HELP" | "PROCESS_STEP" | "EXPORT_GUIDANCE" | "POST_SUBMISSION_GUIDANCE";
export const CONTENT_META: Record<ContentType, { label: string; bg: string; fg: string }> = {
  OFFICIAL_INFORMATION: { label: "Sursă oficială", bg: "#E8F0FA", fg: "#1E4FBF" },
  ARENDAPRO_GUIDANCE: { label: "Ghidaj ArendaPro", bg: "#EDF3EC", fg: "#2A6240" },
  RECOMMENDATION: { label: "Recomandare de organizare", bg: "#FFF6EA", fg: "#A24A07" },
  WARNING_EXPLANATION: { label: "Explicația avertizării", bg: "#FDECEA", fg: "#A5281B" },
  FIELD_HELP: { label: "Ajutor câmp", bg: "#F1ECFF", fg: "#5B2FC2" },
  PROCESS_STEP: { label: "Pas de proces", bg: "#EDF3EC", fg: "#2A6240" },
  EXPORT_GUIDANCE: { label: "Ghidaj export", bg: "#EDF3EC", fg: "#2A6240" },
  POST_SUBMISSION_GUIDANCE: { label: "După depunere", bg: "#EDF3EC", fg: "#2A6240" },
};

export type SourceStatus = "ACTIVE" | "REPLACED" | "ARCHIVED" | "NEEDS_REVIEW" | "LINK_UNAVAILABLE";
export const SOURCE_STATUS_LABEL: Record<SourceStatus, string> = { ACTIVE: "Activ", REPLACED: "Înlocuit", ARCHIVED: "Arhivat", NEEDS_REVIEW: "Necesită revizuire", LINK_UNAVAILABLE: "Link indisponibil" };
export interface OfficialSource { id: string; title: string; category: string; organisation: string; url: string; campaignYear: number; status: SourceStatus; lastReviewedAt: string | null; version: string | null; replacedBy?: string; notes: string }

// URL-urile exacte ale documentelor trebuie configurate după verificarea portalului; până atunci trimit la portalul oficial.
const PORTAL = "https://www.apia.org.ro";
const src = (id: string, title: string, category: string): OfficialSource => ({ id, title, category, organisation: "APIA", url: PORTAL, campaignYear: 2026, status: "NEEDS_REVIEW", lastReviewedAt: null, version: null, notes: "Adresa exactă a documentului nu este încă configurată; caută documentul pe portalul APIA." });
export const OFFICIAL_SOURCES: OfficialSource[] = [
  src("src-cerere", "Formularul Cererii de plată", "Formularul Cererii de plată"),
  src("src-instr", "Instrucțiuni de completare", "Instrucțiuni de completare"),
  src("src-agi", "Ghid AGI Online", "Ghid AGI Online"),
  src("src-lpis", "Ghid LPIS", "Ghid LPIS"),
  src("src-pd", "Ghid plăți directe", "Ghid plăți directe"),
  src("src-eco", "Ghid eco-scheme și caiete", "Ghid eco-scheme"),
  src("src-zoo", "Ghid sector zootehnic", "Ghid sector zootehnic"),
  src("src-cond", "Condiționalitate", "Condiționalitate"),
  src("src-mod", "Formulare de modificare (M1–M4)", "Formulare de modificare"),
];

export interface GuideItem { id: string; type: ContentType; title: string; text: string; sectionKey?: SectionKey | "export-flow"; keywords?: string; sourceIds?: string[] }

const A = "ARENDAPRO_GUIDANCE" as const;
export const GUIDE: GuideItem[] = [
  { id: "g-overview", type: A, sectionKey: "overview", title: "Prezentare generală", text: "Vezi nivelul de completare, secțiunile incomplete și verificările deschise. Nivelul de completare nu înseamnă eligibilitate și nu reprezintă o evaluare APIA.", keywords: "nivel completare progres" },
  { id: "g-applicant", type: A, sectionKey: "applicant", title: "Date solicitant", text: "Datele sunt preluate din profilul fermei și al companiei. Modificările făcute aici se salvează pentru dosarul curent; profilul se modifică separat din Setări.", keywords: "solicitant cui cnp reprezentare", sourceIds: ["src-instr"] },
  { id: "g-bank", type: A, sectionKey: "bank", title: "Cont bancar", text: "IBAN-ul și banca provin din Setări companie și nu se modifică din această pagină. Încarcă documentul care confirmă contul, dacă este cerut.", keywords: "iban banca document bancar" },
  { id: "g-parcels", type: A, sectionKey: "parcels", title: "Parcele pregătite", text: "Compară suprafața din ArendaPro, suprafața documentată și suprafața pregătită pentru campanie. ArendaPro nu modifică automat suprafețele.", keywords: "suprafață diferită parcelă bloc fizic lpis", sourceIds: ["src-lpis"] },
  { id: "g-usage", type: A, sectionKey: "usage", title: "Documente de utilizare", text: "Verifică existența, asocierea cu parcelele și valabilitatea documentelor la momentul relevant pentru campanie. Un document încărcat nu înseamnă că este acceptat de APIA.", keywords: "documente teren contract arenda expirat", sourceIds: ["src-instr"] },
  { id: "g-cultures", type: A, sectionKey: "cultures", title: "Culturi", text: "Confirmă cultura declarată pentru fiecare parcelă în campania curentă. Culturile sunt preluate din lucrările și planificările existente.", keywords: "cultura culturi" },
  { id: "g-interventions", type: A, sectionKey: "interventions", title: "Intervenții pentru analiză", text: "Selectarea unei intervenții o adaugă pentru analiză. Nu reprezintă confirmarea eligibilității și nu o solicită automat în Cererea oficială. Verifică condițiile în ghidul oficial.", keywords: "PD-01 PD-04 intervenție eco-schemă", sourceIds: ["src-pd", "src-eco"] },
  { id: "g-notebooks", type: A, sectionKey: "notebooks", title: "Eco-scheme și caiete", text: "Numai aplicările confirmate ca realizate sunt propuse pentru evidențe; cele planificate rămân separate. Statusuri: Propus, Acceptat, Necesită verificare, Exclus, Sursa modificată.", keywords: "caiet plan de fertilizare aplicări activități evidențe", sourceIds: ["src-eco"] },
  { id: "g-zoo", type: A, sectionKey: "zoo", title: "Sector zootehnic", text: "Completează datele dacă ai animale. Verificarea efectivelor în BND o confirmi tu; ArendaPro nu o poate efectua. Poți marca secțiunea „Nu se aplică”.", keywords: "bnd animale efective zootehnie", sourceIds: ["src-zoo"] },
  { id: "g-documents", type: A, sectionKey: "documents", title: "Documente justificative", text: "Centralizează documentele pe categorii. „Ignoră avertizările” marchează avertizările despre documente lipsă ca revizuite de tine; nu consideră documentele valide.", keywords: "documente lipsă justificative" },
  { id: "g-verification", type: A, sectionKey: "verification", title: "Verificare informații", text: "Rulează verificările ArendaPro (matematice și administrative). Sunt orientative și nu înlocuiesc evaluarea APIA.", keywords: "verificare avertizare" },
  { id: "g-export", type: "EXPORT_GUIDANCE", sectionKey: "export", title: "Export și înregistrare depunere", text: "Fișierele generate de ArendaPro sunt centralizatoare și documente de lucru; nu sunt prezentate drept formate oficiale de import în AGI Online. Cererea se completează, se semnează și se depune prin canalul oficial APIA, apoi înregistrezi aici dovada.", keywords: "export depunere pdf excel zip json agi", sourceIds: ["src-agi", "src-cerere"] },
  { id: "g-mod", type: "POST_SUBMISSION_GUIDANCE", sectionKey: "modifications", title: "Modificări după depunere", text: "Compară datele curente cu snapshot-ul depunerii și pregătește modificările (M1–M4). Transmiterea oficială se face separat. Condițiile și termenele se verifică în sursa oficială.", keywords: "m1 m2 m3 m4 modificare snapshot", sourceIds: ["src-mod"] },
];

export const STEPS: { title: string; section: SectionKey | null }[] = [
  { title: "Selectează campania", section: "overview" }, { title: "Verifică datele solicitantului", section: "applicant" }, { title: "Verifică datele bancare", section: "bank" },
  { title: "Corelează parcelele", section: "parcels" }, { title: "Verifică documentele de utilizare a terenurilor", section: "usage" }, { title: "Confirmă culturile campaniei", section: "cultures" },
  { title: "Analizează intervențiile", section: "interventions" }, { title: "Verifică eco-schemele și caietele", section: "notebooks" }, { title: "Revizuiește datele din Planul de fertilizare", section: "notebooks" },
  { title: "Revizuiește activitățile agricole", section: "notebooks" }, { title: "Completează sectorul zootehnic, dacă se aplică", section: "zoo" }, { title: "Încarcă documentele justificative", section: "documents" },
  { title: "Reconciliază diferențele", section: "parcels" }, { title: "Realizează verificarea finală", section: "verification" }, { title: "Pregătește pachetul pentru depunere", section: "export" },
  { title: "Completează și depune Cererea prin canalul oficial APIA", section: null }, { title: "Înregistrează dovada depunerii în ArendaPro", section: "export" }, { title: "Urmărește modificările ulterioare", section: "modifications" },
];

export const FAQ: { q: string; a: string; type: ContentType }[] = [
  { q: "Ce este Pregătire dosar APIA?", a: "Un modul care centralizează și verifică informațiile necesare Cererii de plată. Nu depune cererea.", type: "ARENDAPRO_GUIDANCE" },
  { q: "ArendaPro depune Cererea în locul meu?", a: "Nu. Completarea, semnarea și depunerea se fac prin canalele oficiale APIA. ArendaPro înregistrează doar dovada depunerii.", type: "ARENDAPRO_GUIDANCE" },
  { q: "Ce date sunt preluate automat?", a: "Parcele, contracte, culturi, lucrări și aplicări din ArendaPro. Fiecare secțiune indică sursa datelor.", type: "ARENDAPRO_GUIDANCE" },
  { q: "Ce fac dacă suprafețele diferă?", a: "Verifică documentul și parcela, apoi confirmă suprafața pregătită. ArendaPro nu modifică automat suprafața parcelei.", type: "ARENDAPRO_GUIDANCE" },
  { q: "Aplicările planificate sunt incluse?", a: "Nu. Numai aplicările confirmate ca realizate sunt propuse pentru evidențe.", type: "ARENDAPRO_GUIDANCE" },
  { q: "Ce înseamnă „Nu se aplică”?", a: "Secțiunea nu este relevantă pentru situația ta și nu intră în calculul completării.", type: "ARENDAPRO_GUIDANCE" },
  { q: "Ce este o intervenție selectată pentru analiză?", a: "O intervenție adăugată pentru verificare în ArendaPro. Nu înseamnă eligibilitate și nu o solicită automat.", type: "ARENDAPRO_GUIDANCE" },
  { q: "Ce reprezintă nivelul de completare?", a: "Procentul de informații pregătite în ArendaPro. Nu este o evaluare a eligibilității.", type: "ARENDAPRO_GUIDANCE" },
  { q: "Pot importa fișierele direct în AGI Online?", a: "Nu există o specificație oficială configurată de import; exporturile sunt documente de lucru.", type: "EXPORT_GUIDANCE" },
  { q: "Ce se întâmplă dacă modific o parcelă după depunere?", a: "Datele curente se pot modifica, iar snapshot-ul depunerii rămâne neschimbat; diferențele sunt afișate pentru pregătirea unei modificări.", type: "POST_SUBMISSION_GUIDANCE" },
  { q: "Unde găsesc documentele oficiale?", a: "În zona „Documente oficiale” din Ghidaj APIA, cu link către sursa oficială.", type: "ARENDAPRO_GUIDANCE" },
];

export const GLOSSARY: { term: string; def: string; official: boolean }[] = [
  { term: "APIA", def: "Agenția de Plăți și Intervenție pentru Agricultură.", official: true },
  { term: "AGI Online", def: "Aplicația oficială APIA în care se completează Cererea.", official: true },
  { term: "LPIS", def: "Sistemul de identificare a parcelelor agricole.", official: true },
  { term: "BND", def: "Baza Națională de Date privind efectivele de animale.", official: true },
  { term: "Caiet", def: "Evidență de activități agricole pregătită în ArendaPro pentru o intervenție.", official: false },
  { term: "Snapshot", def: "Copie înghețată a datelor dosarului la momentul înregistrării depunerii.", official: false },
  { term: "Suprafață documentată", def: "Suprafața din documentul de utilizare a terenului.", official: false },
  { term: "Suprafață pregătită", def: "Suprafața pe care o confirmi pentru campanie în ArendaPro; nu modifică parcela.", official: false },
  { term: "Intervenție selectată pentru analiză", def: "Intervenție adăugată pentru verificare; nu reprezintă eligibilitate.", official: false },
];

export interface SearchHit { kind: "guide" | "faq" | "glossary" | "source"; title: string; text: string; section?: SectionKey; type: ContentType }

export function hasGuidance(year: number) { return GUIDANCE_CAMPAIGNS.includes(year); }
export function guideFor(section: SectionKey, year: number): GuideItem[] { return hasGuidance(year) ? GUIDE.filter(g => g.sectionKey === section) : []; }
export function sourcesFor(ids: string[] | undefined, year: number): OfficialSource[] { return (ids ?? []).map(i => OFFICIAL_SOURCES.find(s => s.id === i)).filter((s): s is OfficialSource => !!s && s.campaignYear === year); }

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export function searchGuidance(query: string, year: number): SearchHit[] {
  const q = norm(query.trim()); if (!q || !hasGuidance(year)) return [];
  const m = (...p: (string | undefined)[]) => norm(p.filter(Boolean).join(" ")).includes(q);
  const out: SearchHit[] = [];
  for (const g of GUIDE) if (m(g.title, g.text, g.keywords)) out.push({ kind: "guide", title: g.title, text: g.text, section: g.sectionKey as SectionKey, type: g.type });
  for (const f of FAQ) if (m(f.q, f.a)) out.push({ kind: "faq", title: f.q, text: f.a, type: f.type });
  for (const t of GLOSSARY) if (m(t.term, t.def)) out.push({ kind: "glossary", title: t.term, text: t.def, type: t.official ? "OFFICIAL_INFORMATION" : "ARENDAPRO_GUIDANCE" });
  for (const s of OFFICIAL_SOURCES) if (m(s.title, s.category)) out.push({ kind: "source", title: s.title, text: s.category, type: "OFFICIAL_INFORMATION" });
  return out;
}

// Acceptă doar linkuri https către domenii oficiale.
export function isSafeOfficialUrl(u: string) { try { const x = new URL(u); return x.protocol === "https:" && /(^|\.)apia\.org\.ro$/.test(x.hostname); } catch { return false; } }

export const GUIDANCE_BANNER = "Informațiile din această secțiune au rol de ghidaj. Verifică întotdeauna formularul, instrucțiunile și materialele oficiale aferente campaniei curente. Completarea și depunerea oficială se realizează prin canalele puse la dispoziție de APIA.";
export const NO_GUIDANCE = "Ghidajul specific acestei campanii nu este încă configurat. Consultă sursele oficiale disponibile și verifică informațiile înainte de continuare.";
