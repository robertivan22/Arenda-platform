export type Tone = "gray" | "blue" | "orange" | "yellow" | "green" | "darkgreen" | "purple" | "red" | "sage";

export const C = {
  bg: "#FAF8F2", card: "#FFFFFF", line: "#E7E3D8", lineSoft: "#EFECE3",
  text: "#1E2A22", muted: "#64726A", primary: "#1F4D36", primaryHover: "#173C2A",
  sageBg: "#E8F2EA", sage: "#2F6B45",
};

export const TONES: Record<Tone, { bg: string; fg: string; bd: string; dot: string }> = {
  gray:      { bg: "#F1F0EA", fg: "#5B655F", bd: "#E1DED3", dot: "#9AA39D" },
  blue:      { bg: "#EAF1FF", fg: "#1E4FBF", bd: "#CFE0FF", dot: "#3B72E0" },
  orange:    { bg: "#FFF1E0", fg: "#A24A07", bd: "#F6D3A9", dot: "#E8791A" },
  yellow:    { bg: "#FFF8D9", fg: "#7A5B00", bd: "#F1E3A0", dot: "#D4A514" },
  green:     { bg: "#E8F2EA", fg: "#2A6240", bd: "#CBE1D0", dot: "#4E8B62" },
  darkgreen: { bg: "#14402B", fg: "#FFFFFF", bd: "#14402B", dot: "#8FD1A6" },
  purple:    { bg: "#F1ECFF", fg: "#5B2FC2", bd: "#DDD0FA", dot: "#7C4DDB" },
  red:       { bg: "#FDECEA", fg: "#A5281B", bd: "#F5C6C0", dot: "#D8412F" },
  sage:      { bg: "#EDF3EC", fg: "#44654C", bd: "#D5E2D4", dot: "#6B8F71" },
};

export const STATUS: Record<string, { label: string; tone: Tone }> = {
  // dosar
  d_neinceput: { label: "Neînceput", tone: "gray" },
  d_pregatire: { label: "În pregătire", tone: "blue" },
  d_documente: { label: "Lipsesc informații", tone: "orange" },
  d_verificare: { label: "Necesită verificare", tone: "yellow" },
  d_pregatit: { label: "Pregătit pentru revizuire finală", tone: "green" },
  d_depus: { label: "Depunere înregistrată", tone: "darkgreen" },
  d_control: { label: "În control, confirmat de utilizator", tone: "purple" },
  d_modificare: { label: "Necesită modificare", tone: "orange" },
  d_retras: { label: "Retragere parțială înregistrată", tone: "red" },
  // secțiuni
  s_complet: { label: "Complet", tone: "green" },
  s_incomplet: { label: "Incomplet", tone: "orange" },
  s_verificare: { label: "Necesită verificare", tone: "yellow" },
  s_na: { label: "Nu se aplică", tone: "gray" },
  s_neinceput: { label: "Neînceput", tone: "gray" },
  // documente
  doc_disponibil: { label: "Disponibil", tone: "green" },
  doc_lipsa: { label: "Lipsă", tone: "red" },
  doc_expirat: { label: "Expirat", tone: "red" },
  doc_aproape: { label: "Aproape de expirare", tone: "yellow" },
  doc_verificare: { label: "Necesită verificare", tone: "yellow" },
  doc_inlocuit: { label: "Înlocuit cu o versiune nouă", tone: "gray" },
  // documente de utilizare
  u_valabil: { label: "Valabil", tone: "green" },
  u_curand: { label: "Expiră în curând", tone: "yellow" },
  u_expirat: { label: "Expirat", tone: "red" },
  u_fisier: { label: "Fișier lipsă", tone: "orange" },
  u_incomplet: { label: "Date incomplete", tone: "orange" },
  u_verificare: { label: "Necesită verificare", tone: "yellow" },
  // parcele
  p_ok: { label: "Date aparent complete", tone: "green" },
  p_verificare: { label: "Necesită verificare", tone: "yellow" },
  p_fara_doc: { label: "Document lipsă", tone: "orange" },
  p_exclusa: { label: "Exclusă din pregătire", tone: "gray" },
  // intervenții
  i_neselectata: { label: "Neselectată", tone: "gray" },
  i_selectata: { label: "Selectată pentru analiză", tone: "blue" },
  i_incompleta: { label: "Informații incomplete", tone: "orange" },
  i_verificare: { label: "Necesită verificare", tone: "yellow" },
  i_pregatita: { label: "Pregătită pentru revizuire", tone: "green" },
  i_na: { label: "Nu se aplică", tone: "gray" },
  // caiete
  n_neinceput: { label: "Neînceput", tone: "gray" },
  n_lucru: { label: "În lucru", tone: "blue" },
  n_complet: { label: "Complet", tone: "green" },
  n_verificare: { label: "Necesită verificare", tone: "yellow" },
  // modificări
  m_draft: { label: "Draft", tone: "gray" },
  m_pregatita: { label: "Pregătită", tone: "blue" },
  m_transmisa: { label: "Transmitere înregistrată", tone: "green" },
  m_anulata: { label: "Anulată", tone: "red" },
};

export type SectionKey = "overview" | "applicant" | "bank" | "parcels" | "usage" | "cultures" | "interventions" | "notebooks" | "zoo" | "documents" | "verification" | "export" | "modifications";

export const SECTION_TITLES: Record<SectionKey, string> = {
  overview: "Prezentare generală", applicant: "Date solicitant", bank: "Cont bancar", parcels: "Parcele pregătite",
  usage: "Documente de utilizare", cultures: "Culturi", interventions: "Intervenții pentru analiză", notebooks: "Eco-scheme și caiete",
  zoo: "Sector zootehnic", documents: "Documente justificative", verification: "Verificare informații",
  export: "Export și înregistrare depunere", modifications: "Pregătire modificări după depunere",
};
export const SECTION_ORDER = Object.keys(SECTION_TITLES) as SectionKey[];

// Rolurile ArendaPro (farm_members.role) mapate pe nivelurile de acces ale modulului.
export type Role = "admin" | "contabil" | "colaborator" | "vizualizare";
export const ROLE_LABEL: Record<Role, string> = { admin: "Administrator", contabil: "Contabil", colaborator: "Colaborator", vizualizare: "Vizualizare" };
type Acc = "edit" | "view" | "none";
const ACCESS: Record<Role, Record<SectionKey, Acc>> = {
  admin: Object.fromEntries(SECTION_ORDER.map(k => [k, "edit"])) as Record<SectionKey, Acc>,
  contabil: { overview: "view", applicant: "view", bank: "edit", parcels: "view", usage: "view", cultures: "view", interventions: "view", notebooks: "view", zoo: "view", documents: "edit", verification: "view", export: "edit", modifications: "view" },
  colaborator: { overview: "view", applicant: "none", bank: "none", parcels: "none", usage: "edit", cultures: "none", interventions: "none", notebooks: "edit", zoo: "none", documents: "edit", verification: "none", export: "none", modifications: "none" },
  vizualizare: Object.fromEntries(SECTION_ORDER.map(k => [k, "view"])) as Record<SectionKey, Acc>,
};
export const access = (r: Role, s: SectionKey): Acc => ACCESS[r][s];

// ── Parcele ──────────────────────────────────────────────────────────────────
export interface Parcel {
  id: string; code: string; bloc: string; name: string; uat: string; culture: string;
  areaApp: number; areaDoc: number | null; declared: number | null;
  excluded: boolean; flagged: boolean; verified: boolean; interventions: string[];
  contractId: string | null; note: string;
}

export const fmt = (n: number, d = 2) => n.toLocaleString("ro-RO", { minimumFractionDigits: d, maximumFractionDigits: d });
export const ha = (n: number) => `${fmt(n)} ha`;

// ── Documente de utilizare ───────────────────────────────────────────────────
export const USAGE_TYPES = ["Contract de arendă", "Contract de concesiune", "Contract de închiriere", "Contract de comodat", "Document de proprietate", "Adeverință din Registrul agricol", "Alt document"];
export type UStatus = "u_valabil" | "u_curand" | "u_expirat" | "u_fisier" | "u_incomplet" | "u_verificare";
export interface UsageDoc {
  id: string; type: string; number: string; owner: string; parcels: string[];
  start: string | null; end: string | null; file: string | null; status: UStatus; hubId: string;
  contractId?: string; filePath?: string | null;
}

// ── Avertizări ───────────────────────────────────────────────────────────────
export type Sev = "critic" | "verificare" | "recomandare";
export interface Warning {
  id: string; sev: Sev; kind: "matematic" | "administrativ"; title: string; desc: string;
  section: SectionKey; parcels?: string[]; resolved: boolean; zooOnly?: boolean; code?: string; ruleVersion?: string;
}
export const SEV_META: Record<Sev, { label: string; tone: Tone; hint: string }> = {
  critic: { label: "Critice", tone: "red", hint: "Informația este necesară pentru pregătirea dosarului și lipsește sau este invalidă." },
  verificare: { label: "Necesită verificare", tone: "yellow", hint: "Există o diferență, un document apropiat de expirare sau o informație neconfirmată." },
  recomandare: { label: "Recomandări", tone: "blue", hint: "Acțiuni utile, care nu sunt obligații legale." },
};

// ── Documente justificative ──────────────────────────────────────────────────
export const DOC_CATS = ["Identificare","Bancă","Terenuri","Contracte","Registru agricol","Culturi","Intervenții PD","Eco-scheme","Zootehnie","Alte documente"] as const;
export type DocStatus = "doc_disponibil" | "doc_lipsa" | "doc_expirat" | "doc_aproape" | "doc_verificare" | "doc_inlocuit";
export interface HubDoc {
  id: string; name: string; cat: string; status: DocStatus; file: string | null; version: number;
  expiry: string | null; note: string; parcel: string; interv: string; owner: string; usageId: string;
  archived: boolean; date: string; section: SectionKey;
  source?: "contract" | "dosar" | "cerut"; storagePath?: string | null;
}

// ── Intervenții ──────────────────────────────────────────────────────────────
export const IV_CATS = ["Plăți directe","Eco-scheme","Sprijin cuplat vegetal","Sprijin cuplat zootehnic","Ajutoare tranzitorii","Intervenții de dezvoltare rurală"] as const;
export interface Intervention {
  code: string; name: string; cat: typeof IV_CATS[number]; desc: string;
  cultures: string[] | null; reqDocs: { label: string; ok: boolean }[]; notebook?: string; rel: string[];
  checks: { kind: "matematic" | "administrativ"; text: string }[]; selected: boolean; note: string;
  ruleVersion?: string; configNote?: string; parcelIds?: string[]; needsParcels?: boolean;
}

// ── Caiete ───────────────────────────────────────────────────────────────────
export type Inclusion = "SUGGESTED" | "ACCEPTED" | "NEEDS_REVIEW" | "EXCLUDED" | "SOURCE_CHANGED";
export type SourceType = "WORK_ORDER_INPUT" | "FITOSANITAR" | "MANUAL";
export interface Activity {
  id: string; date: string; parcel: string; culture: string; activity: string; area: number; input: string; qty: string; doc: string; by: string; note: string;
  parcelId?: string | null; qtyNum?: number | null; unit?: string; sourceType?: SourceType; sourceId?: string | null;
  sourceVersion?: string | null; status?: Inclusion; dbId?: string | null; issues?: string[]; interv?: string;
}
export interface Notebook { id: string; interv: string; name: string; target: number; confirmed: boolean; entries: Activity[]; history: string[]; suggestions?: Activity[] }

export const SOURCE_LABEL: Record<SourceType, string> = {
  WORK_ORDER_INPUT: "Preluat din Lucrări și activități",
  FITOSANITAR: "Preluat din Registrul fitosanitar",
  MANUAL: "Introdus manual în dosar",
};

export const MOD_TYPES = [
  ["M1", "Schimbarea declarației de suprafață"], ["M1.1", "Schimbarea declarației privind sectorul zootehnic"],
  ["M1.2", "Schimbarea declarației privind apa pentru irigații"], ["M1.3", "Schimbarea declarației privind produsele de protecție a plantelor sau echipamentele asociate"],
  ["M1.4", "Schimbarea declarației privind terenurile amenajate cu terase"], ["M1.5", "Schimbarea declarației privind studiile agrochimice"],
  ["M2", "Completarea Cererii de plată"], ["M3", "Retragerea parțială a declarației de suprafață"],
  ["M4", "Schimbarea adresei, coordonatelor bancare sau numelui societății fără modificarea CUI"],
] as const;
export interface Modification { id: string; code: string; started: string; reason: string; parcels: string[]; changed: string; docs: string[]; status: "m_draft" | "m_pregatita" | "m_transmisa" | "m_anulata"; sentOn: string; proof: string }

export interface Activity2 { id: string; text: string; time: string; who: string }
