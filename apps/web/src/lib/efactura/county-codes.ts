/**
 * Maps Romanian county names (and common abbreviations) to ISO 3166-2:RO codes.
 * The DB stores county names in various forms — normalised lookup covers all cases.
 */

const MAP: Record<string, string> = {
  // Full names
  alba: 'RO-AB',
  arad: 'RO-AR',
  arges: 'RO-AG',
  bacau: 'RO-BC',
  bihor: 'RO-BH',
  'bistrita-nasaud': 'RO-BN',
  botosani: 'RO-BT',
  braila: 'RO-BR',
  brasov: 'RO-BV',
  buzau: 'RO-BZ',
  'caras-severin': 'RO-CS',
  calarasi: 'RO-CL',
  cluj: 'RO-CJ',
  constanta: 'RO-CT',
  covasna: 'RO-CV',
  dambovita: 'RO-DB',
  dolj: 'RO-DJ',
  galati: 'RO-GL',
  giurgiu: 'RO-GR',
  gorj: 'RO-GJ',
  harghita: 'RO-HR',
  hunedoara: 'RO-HD',
  ialomita: 'RO-IL',
  iasi: 'RO-IS',
  ilfov: 'RO-IF',
  maramures: 'RO-MM',
  mehedinti: 'RO-MH',
  mures: 'RO-MS',
  neamt: 'RO-NT',
  olt: 'RO-OT',
  prahova: 'RO-PH',
  salaj: 'RO-SJ',
  'satu mare': 'RO-SM',
  sibiu: 'RO-SB',
  suceava: 'RO-SV',
  teleorman: 'RO-TR',
  timis: 'RO-TM',
  tulcea: 'RO-TL',
  valcea: 'RO-VL',
  vaslui: 'RO-VS',
  vrancea: 'RO-VN',
  bucuresti: 'RO-B',
  'municipiul bucuresti': 'RO-B',
  'municipiu bucuresti': 'RO-B',

  // 2-letter abbreviations stored in older records
  ab: 'RO-AB',
  ar: 'RO-AR',
  ag: 'RO-AG',
  bc: 'RO-BC',
  bh: 'RO-BH',
  bn: 'RO-BN',
  bt: 'RO-BT',
  br: 'RO-BR',
  bv: 'RO-BV',
  bz: 'RO-BZ',
  cs: 'RO-CS',
  cl: 'RO-CL',
  cj: 'RO-CJ',
  ct: 'RO-CT',
  cv: 'RO-CV',
  db: 'RO-DB',
  dj: 'RO-DJ',
  gl: 'RO-GL',
  gr: 'RO-GR',
  gj: 'RO-GJ',
  hr: 'RO-HR',
  hd: 'RO-HD',
  il: 'RO-IL',
  is: 'RO-IS',
  if: 'RO-IF',
  mm: 'RO-MM',
  mh: 'RO-MH',
  ms: 'RO-MS',
  nt: 'RO-NT',
  ot: 'RO-OT',
  ph: 'RO-PH',
  sj: 'RO-SJ',
  sm: 'RO-SM',
  sb: 'RO-SB',
  sv: 'RO-SV',
  tr: 'RO-TR',
  tm: 'RO-TM',
  tl: 'RO-TL',
  vl: 'RO-VL',
  vs: 'RO-VS',
  vn: 'RO-VN',
  b: 'RO-B',
  if_ilfov: 'RO-IF',
}

/**
 * Converts a county string (name or abbreviation) to ISO 3166-2 format.
 * Returns the original value if not found (XML still valid, just less precise).
 */
export function countyToIso3166(county: string | null | undefined): string {
  if (!county) return 'RO-B'
  // Normalise: lowercase, strip diacritics, trim
  const key = county
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')

  return MAP[key] ?? `RO-${county.toUpperCase().slice(0, 2)}`
}
