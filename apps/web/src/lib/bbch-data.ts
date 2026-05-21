/**
 * BBCH Scale data for ArendaPro Registru Fitosanitar.
 * Sources: Ordinul MADR/MMAP/ANSVSA nr. 54/570/32/2023 + EU regulation.
 * Two crop categories: 'cereale' (Grâu, Orz, Ovăz, Secară) and 'porumb' (Zea mays).
 */

export type BBCHCultura = 'cereale' | 'porumb'

export interface BBCHStage {
  code: string
  cultura: BBCHCultura
  stagiu: number // principal stage 0–9
  descriere: string
}

// ─── Cereale (Grâu, Orz, Ovăz, Secară) ──────────────────────────────────────
export const BBCH_CEREALE: BBCHStage[] = [
  { code: '00', cultura: 'cereale', stagiu: 0, descriere: 'Semință uscată' },
  { code: '09', cultura: 'cereale', stagiu: 0, descriere: 'Răsărire: coleoptilul iese din sol' },
  { code: '10', cultura: 'cereale', stagiu: 1, descriere: 'Prima frunză prin coleoptil' },
  { code: '11', cultura: 'cereale', stagiu: 1, descriere: 'Prima frunză desfăcută' },
  { code: '12', cultura: 'cereale', stagiu: 1, descriere: '2 frunze desfăcute' },
  { code: '13', cultura: 'cereale', stagiu: 1, descriere: '3 frunze desfăcute' },
  { code: '21', cultura: 'cereale', stagiu: 2, descriere: 'Înfrățire: 1 fraer vizibil' },
  { code: '22', cultura: 'cereale', stagiu: 2, descriere: '2 frați vizibili' },
  { code: '23', cultura: 'cereale', stagiu: 2, descriere: '3 frați vizibili' },
  { code: '29', cultura: 'cereale', stagiu: 2, descriere: 'Înfrățire terminată' },
  { code: '30', cultura: 'cereale', stagiu: 3, descriere: 'Începutul alungirii internodului' },
  { code: '31', cultura: 'cereale', stagiu: 3, descriere: '1 internod vizibil' },
  { code: '32', cultura: 'cereale', stagiu: 3, descriere: '2 internoduri vizibile' },
  { code: '37', cultura: 'cereale', stagiu: 3, descriere: 'Frunza steag complet desfăcută' },
  { code: '39', cultura: 'cereale', stagiu: 3, descriere: 'Frunza steag complet desfăcută, ligula vizibilă' },
  { code: '41', cultura: 'cereale', stagiu: 4, descriere: 'Burduf timpuriu' },
  { code: '45', cultura: 'cereale', stagiu: 4, descriere: 'Burduf mijlociu' },
  { code: '49', cultura: 'cereale', stagiu: 4, descriere: 'Burduf complet' },
  { code: '51', cultura: 'cereale', stagiu: 5, descriere: 'Spicul/panicul 10% ieșit' },
  { code: '55', cultura: 'cereale', stagiu: 5, descriere: 'Spicul/panicul 50% ieșit' },
  { code: '59', cultura: 'cereale', stagiu: 5, descriere: 'Spicul/panicul complet ieșit' },
  { code: '61', cultura: 'cereale', stagiu: 6, descriere: 'Începutul înfloririi' },
  { code: '65', cultura: 'cereale', stagiu: 6, descriere: 'Înflorire deplină (50% antere vizibile)' },
  { code: '69', cultura: 'cereale', stagiu: 6, descriere: 'Înflorire terminată' },
  { code: '71', cultura: 'cereale', stagiu: 7, descriere: 'Bob apos' },
  { code: '73', cultura: 'cereale', stagiu: 7, descriere: 'Bob timpuriu lăptos' },
  { code: '75', cultura: 'cereale', stagiu: 7, descriere: 'Bob lăptos mediu' },
  { code: '77', cultura: 'cereale', stagiu: 7, descriere: 'Bob lăptos târziu' },
  { code: '83', cultura: 'cereale', stagiu: 8, descriere: 'Bob timpuriu ceros' },
  { code: '85', cultura: 'cereale', stagiu: 8, descriere: 'Bob ceros mediu' },
  { code: '87', cultura: 'cereale', stagiu: 8, descriere: 'Bob ceros dur' },
  { code: '89', cultura: 'cereale', stagiu: 8, descriere: 'Bob complet matur' },
  { code: '91', cultura: 'cereale', stagiu: 9, descriere: 'Dezvoltare tulpină completă' },
  { code: '92', cultura: 'cereale', stagiu: 9, descriere: 'Supracopt: boabele foarte dure' },
  { code: '97', cultura: 'cereale', stagiu: 9, descriere: 'Plantă moartă' },
  { code: '99', cultura: 'cereale', stagiu: 9, descriere: 'Produs recoltat' },
]

// ─── Porumb (Zea mays) ────────────────────────────────────────────────────────
export const BBCH_PORUMB: BBCHStage[] = [
  { code: '00', cultura: 'porumb', stagiu: 0, descriere: 'Semință uscată' },
  { code: '05', cultura: 'porumb', stagiu: 0, descriere: 'Germinare: radicela iese din sămânță' },
  { code: '09', cultura: 'porumb', stagiu: 0, descriere: 'Răsărire: coleoptilul iese din sol' },
  { code: '10', cultura: 'porumb', stagiu: 1, descriere: 'Prima frunză prin coleoptil' },
  { code: '11', cultura: 'porumb', stagiu: 1, descriere: 'Prima frunză desfăcută (3 cm)' },
  { code: '12', cultura: 'porumb', stagiu: 1, descriere: '2 frunze desfăcute' },
  { code: '13', cultura: 'porumb', stagiu: 1, descriere: '3 frunze desfăcute (V3)' },
  { code: '14', cultura: 'porumb', stagiu: 1, descriere: '4 frunze desfăcute (V4)' },
  { code: '15', cultura: 'porumb', stagiu: 1, descriere: '5 frunze desfăcute (V5)' },
  { code: '16', cultura: 'porumb', stagiu: 1, descriere: '6 frunze desfăcute (V6)' },
  { code: '17', cultura: 'porumb', stagiu: 1, descriere: '7 frunze' },
  { code: '18', cultura: 'porumb', stagiu: 1, descriere: '8 frunze' },
  { code: '19', cultura: 'porumb', stagiu: 1, descriere: '9+ frunze' },
  { code: '31', cultura: 'porumb', stagiu: 3, descriere: 'Începutul elongării tulpinii' },
  { code: '33', cultura: 'porumb', stagiu: 3, descriere: '3 internoduri' },
  { code: '35', cultura: 'porumb', stagiu: 3, descriere: '5 internoduri (V8-V10)' },
  { code: '37', cultura: 'porumb', stagiu: 3, descriere: 'Frunza steag vizibilă' },
  { code: '39', cultura: 'porumb', stagiu: 3, descriere: 'Frunza steag complet desfăcută' },
  { code: '51', cultura: 'porumb', stagiu: 5, descriere: 'Începutul apariției inflorescenței mascule' },
  { code: '55', cultura: 'porumb', stagiu: 5, descriere: 'Paniculul 50% ieșit' },
  { code: '59', cultura: 'porumb', stagiu: 5, descriere: 'Paniculul complet ieșit' },
  { code: '61', cultura: 'porumb', stagiu: 6, descriere: 'Mătasea vizibilă (VT-R1)' },
  { code: '65', cultura: 'porumb', stagiu: 6, descriere: 'Înflorire mijlocie' },
  { code: '69', cultura: 'porumb', stagiu: 6, descriere: 'Înflorire terminată (R2)' },
  { code: '71', cultura: 'porumb', stagiu: 7, descriere: 'Bob blistere (R2)' },
  { code: '73', cultura: 'porumb', stagiu: 7, descriere: 'Bob lăptos (R3)' },
  { code: '75', cultura: 'porumb', stagiu: 7, descriere: 'Bob lăptos mediu' },
  { code: '77', cultura: 'porumb', stagiu: 7, descriere: 'Bob lăptos târziu (R4 - pastă)' },
  { code: '83', cultura: 'porumb', stagiu: 8, descriere: 'Bob ceros timpuriu (R4)' },
  { code: '85', cultura: 'porumb', stagiu: 8, descriere: 'Bob ceros (R5 - dinte)' },
  { code: '87', cultura: 'porumb', stagiu: 8, descriere: 'Bob ceros dur (R5)' },
  { code: '89', cultura: 'porumb', stagiu: 8, descriere: 'Maturitate fiziologică (R6 - linie neagră)' },
  { code: '92', cultura: 'porumb', stagiu: 9, descriere: 'Supracopt' },
  { code: '99', cultura: 'porumb', stagiu: 9, descriere: 'Produs recoltat' },
]

// ─── Visual metadata ──────────────────────────────────────────────────────────
export const STAGE_COLORS: Record<number, { bg: string; hex: string; text: string }> = {
  0: { bg: 'bg-gray-200',   hex: '#d1d5db', text: 'text-gray-700' },
  1: { bg: 'bg-green-100',  hex: '#bbf7d0', text: 'text-green-900' },
  2: { bg: 'bg-green-300',  hex: '#86efac', text: 'text-green-900' },
  3: { bg: 'bg-green-500',  hex: '#22c55e', text: 'text-white' },
  4: { bg: 'bg-teal-400',   hex: '#2dd4bf', text: 'text-white' },
  5: { bg: 'bg-blue-400',   hex: '#60a5fa', text: 'text-white' },
  6: { bg: 'bg-yellow-400', hex: '#facc15', text: 'text-yellow-900' },
  7: { bg: 'bg-orange-400', hex: '#fb923c', text: 'text-white' },
  8: { bg: 'bg-amber-500',  hex: '#f59e0b', text: 'text-white' },
  9: { bg: 'bg-stone-600',  hex: '#78716c', text: 'text-white' },
}

export const STAGE_LABELS: Record<number, string> = {
  0: 'Germinare',
  1: 'Frunze',
  2: 'Înfrățire',
  3: 'Elongare',
  4: 'Burduf',
  5: 'Spic/Panicul',
  6: 'Înflorire',
  7: 'Bob',
  8: 'Maturare',
  9: 'Senescență',
}

// ─── Crop options ─────────────────────────────────────────────────────────────
export const CULTURA_OPTIONS = [
  'Grâu', 'Orz', 'Ovăz', 'Secară', 'Porumb',
  'Floarea-soarelui', 'Rapiță', 'Sfeclă de zahăr', 'Soia', 'Altele',
] as const

export type CulturaOption = (typeof CULTURA_OPTIONS)[number]

export const CULTURA_TO_BBCH: Record<string, BBCHCultura> = {
  'Grâu': 'cereale', 'Orz': 'cereale', 'Ovăz': 'cereale', 'Secară': 'cereale',
  'Porumb': 'porumb',
  'Floarea-soarelui': 'cereale', 'Rapiță': 'cereale',
  'Sfeclă de zahăr': 'cereale', 'Soia': 'cereale', 'Altele': 'cereale',
}

export function getBBCHForCultura(cultura: string): BBCHStage[] {
  return CULTURA_TO_BBCH[cultura] === 'porumb' ? BBCH_PORUMB : BBCH_CEREALE
}

// ─── Romanian counties ────────────────────────────────────────────────────────
export const JUDETE_ROMANIA = [
  'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani',
  'Brăila', 'Brașov', 'București', 'Buzău', 'Călărași', 'Caraș-Severin',
  'Cluj', 'Constanța', 'Covasna', 'Dâmbovița', 'Dolj', 'Galați', 'Giurgiu',
  'Gorj', 'Harghita', 'Hunedoara', 'Ialomița', 'Iași', 'Ilfov', 'Maramureș',
  'Mehedinți', 'Mureș', 'Neamț', 'Olt', 'Prahova', 'Sălaj', 'Satu Mare',
  'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vaslui', 'Vâlcea', 'Vrancea',
] as const

export type TipAgent = 'boala' | 'daunator' | 'buruiana' | 'mixt'
export type UnitateDoza = 'l/ha' | 'kg/ha' | 'g/ha' | 'ml/ha'
export type UnitateCantitate = 'litri' | 'kg'

// ─── DB row type (mirrors registru_fitosanitar table) ─────────────────────────
export interface RegistruFitosanitar {
  id: string
  user_id: string
  numar_inregistrare: number
  created_at: string
  updated_at: string
  data_tratament: string
  cultura: string
  parcela_id?: string | null
  locul_terenului: string
  nr_parcela?: string | null
  judet?: string | null
  bbch_code: string
  bbch_descriere: string
  tip_agent: TipAgent
  agent_daunare: string
  denumire_produs: string
  substanta_activa?: string | null
  nr_omologare?: string | null
  doza_omologata_min?: number | null
  doza_omologata_max?: number | null
  doza_folosita: number
  unitate_doza: UnitateDoza
  suprafata_tratata: number
  cantitate_utilizata: number
  unitate_cantitate: UnitateCantitate
  nume_prenume_responsabil: string
  semnatura_url?: string | null
  data_incepere_recoltare?: string | null
  phi_zile?: number | null
  numar_document?: string | null
  data_document?: string | null
  conditii_meteo?: string | null
  echipament_utilizat?: string | null
  observatii?: string | null
  is_deleted: boolean
  deleted_at?: string | null
}

export type FitosanitarFormData = Omit<
  RegistruFitosanitar,
  'id' | 'user_id' | 'numar_inregistrare' | 'created_at' | 'updated_at' | 'is_deleted' | 'deleted_at'
>

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function formatDateRO(iso: string | null | undefined): string {
  if (!iso) return '-'
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export const TIP_AGENT_LABELS: Record<TipAgent, string> = {
  boala: 'Boală',
  daunator: 'Dăunător',
  buruiana: 'Buruiană',
  mixt: 'Mixt',
}
