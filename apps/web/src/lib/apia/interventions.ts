/**
 * APIA Intervention catalog + Document requirements rules engine.
 *
 * Rules are intervention-specific (per Romanian CAP SP 2023–2027).
 * Structure: each intervention code maps to an array of required documents.
 * Special keys: '_ALL' applies to every dossier, '_PARCEL' applies per parcel.
 *
 * Source: APIA Ghid Solicitant 2026 + manualele AGI Online + formularistica APIA.
 */

import type { DocumentRequirement } from './types'

// ─── Document requirement rules per intervention code ────────────────────────

const DOC_RULES: Record<string, DocumentRequirement[]> = {
  // ── Required for ALL dossiers ─────────────────────────────────────────────
  _ALL: [
    {
      type: 'CI_BENEFICIAR',
      label: 'Carte de identitate / Pașaport beneficiar',
      mandatory: true,
      notes: 'Valabil la data depunerii cererii',
    },
    {
      type: 'INREGISTRARE_REGISTRU_AGRICOL',
      label: 'Dovadă înregistrare în registrul agricol',
      mandatory: true,
      notes: 'Emisă de primăria din UAT-ul unde se află exploatația principală',
    },
    {
      type: 'CERTIFICAT_INREGISTRARE',
      label: 'Certificat de înregistrare firmă / CUI (pentru persoane juridice)',
      mandatory: false,
      notes: 'Obligatoriu doar pentru PJ / PFA / IF',
    },
  ],

  // ── Required per-parcel (land-use right) ─────────────────────────────────
  _PARCEL: [
    {
      type: 'DOVADA_UTILIZARE_TEREN',
      label: 'Dovada dreptului de utilizare a terenului',
      mandatory: true,
      notes: 'Trebuie să fie valabil la data depunerii cererii de plată',
    },
  ],

  // ── BISS / PS1-1 (direct decoupled payment) ───────────────────────────────
  'PS1-1': [
    {
      type: 'DECLARATIE_SUPRAFETE',
      label: 'Declarație de suprafețe completată în AGI Online',
      mandatory: true,
    },
  ],

  // ── PS2 – Tineri fermieri ─────────────────────────────────────────────────
  'PS2': [
    {
      type: 'DOVADA_VARSTA',
      label: 'Dovadă vârstă sub 41 ani (CI)',
      mandatory: true,
    },
    {
      type: 'DOVADA_INREGISTRARE_INITIALA',
      label: 'Dovadă dată înregistrare exploatație (sub 5 ani)',
      mandatory: true,
      notes: 'Certificat ONRC sau dovadă primară înregistrare',
    },
  ],

  // ── ANT-1: Grâu / Triticale ───────────────────────────────────────────────
  'ANT-1': [
    {
      type: 'FACTURA_SEMINTE_CEREALE',
      label: 'Factură/bon achiziție semințe grâu/triticale',
      mandatory: false,
      notes: 'Recomandat ca dovadă a producției; poate fi solicitat la control',
    },
  ],

  // ── ANT-3: Proteaginoase ──────────────────────────────────────────────────
  'ANT-3': [
    {
      type: 'CONTRACT_VALORIFICARE_PROTEAGINOASE',
      label: 'Contract valorificare proteaginoase (dacă există)',
      mandatory: false,
    },
  ],

  // ── ANT-5: Sfeclă de zahăr ────────────────────────────────────────────────
  'ANT-5': [
    {
      type: 'CONTRACT_PRELUCRARE_SFECLA',
      label: 'Contract cu fabrica de zahăr / procesator sfeclă',
      mandatory: true,
      notes: 'Obligatoriu — condiție de eligibilitate ANT-5',
    },
  ],

  // ── ANT-9: Soia ───────────────────────────────────────────────────────────
  'ANT-9': [
    {
      type: 'CONTRACT_VALORIFICARE_SOIA',
      label: 'Contract valorificare soia (cu procesator)',
      mandatory: true,
      notes: 'Condiție de eligibilitate ANT-9',
    },
  ],

  // ── ANT-12: Bovine de carne ───────────────────────────────────────────────
  'ANT-12': [
    {
      type: 'COD_EXPLOATATIE_ANSVSA',
      label: 'Cod exploatație ANSVSA – bovine carne',
      mandatory: true,
    },
    {
      type: 'DECLARATIE_ZOOTEHNICA_APIA',
      label: 'Declarație zotehnică APIA (completată înainte de AGI Online)',
      mandatory: true,
      notes: 'Declarația se completează ÎNAINTE de AGI Online',
    },
    {
      type: 'BND_CONFIRMARE',
      label: 'Confirmare date actualizate în BND (Baza Națională de Date)',
      mandatory: true,
    },
    {
      type: 'PASAPOARTE_BOVINE',
      label: 'Pașapoarte/documente identificare bovine',
      mandatory: false,
      notes: 'Pot fi solicitate la control administrativ',
    },
  ],

  // ── ANT-13: Bovine de lapte ───────────────────────────────────────────────
  'ANT-13': [
    {
      type: 'COD_EXPLOATATIE_ANSVSA',
      label: 'Cod exploatație ANSVSA – bovine lapte',
      mandatory: true,
    },
    {
      type: 'DECLARATIE_ZOOTEHNICA_APIA',
      label: 'Declarație zotehnică APIA – lapte',
      mandatory: true,
    },
    {
      type: 'BND_CONFIRMARE',
      label: 'Confirmare date actualizate în BND',
      mandatory: true,
    },
    {
      type: 'CONTRACT_COLECTARE_LAPTE',
      label: 'Contract colectare lapte sau dovadă livrare',
      mandatory: false,
    },
  ],

  // ── ANT-14: Ovine-caprine ─────────────────────────────────────────────────
  'ANT-14': [
    {
      type: 'COD_EXPLOATATIE_ANSVSA',
      label: 'Cod exploatație ANSVSA – ovine/caprine',
      mandatory: true,
    },
    {
      type: 'DECLARATIE_ZOOTEHNICA_APIA',
      label: 'Declarație zotehnică APIA – ovine/caprine',
      mandatory: true,
    },
    {
      type: 'BND_CONFIRMARE',
      label: 'Confirmare date actualizate în BND',
      mandatory: true,
    },
    {
      type: 'CARNET_EXPLOATATIE',
      label: 'Carnet de exploatație / registru animale',
      mandatory: false,
    },
  ],

  // ── ANT-15: Bivolițe lapte ────────────────────────────────────────────────
  'ANT-15': [
    {
      type: 'COD_EXPLOATATIE_ANSVSA',
      label: 'Cod exploatație ANSVSA – bivolițe',
      mandatory: true,
    },
    {
      type: 'DECLARATIE_ZOOTEHNICA_APIA',
      label: 'Declarație zotehnică APIA – bivolițe',
      mandatory: true,
    },
    {
      type: 'BND_CONFIRMARE',
      label: 'Confirmare date actualizate în BND',
      mandatory: true,
    },
  ],

  // ── ECO-M1: Rotație culturi ───────────────────────────────────────────────
  'ECO-M1': [
    {
      type: 'ANGAJAMENT_ECO1',
      label: 'Angajament eco-schema 1 – rotație culturi',
      mandatory: true,
    },
    {
      type: 'PLAN_ROTATIE_CULTURI',
      label: 'Plan rotație culturi pe minim 3 parcele',
      mandatory: true,
      notes: 'Rotație obligatorie: min. 3 culturi diferite pe exploatație',
    },
  ],

  // ── ECO-M2: Pajiști permanente extensive ──────────────────────────────────
  'ECO-M2': [
    {
      type: 'ANGAJAMENT_ECO2',
      label: 'Angajament eco-schema 2 – pajiști extensive',
      mandatory: true,
    },
    {
      type: 'PLAN_MANAGEMENT_PAJISTI',
      label: 'Plan de management pajiști permanente',
      mandatory: false,
    },
  ],

  // ── ECO-M3: Agricultură biologică ─────────────────────────────────────────
  'ECO-M3': [
    {
      type: 'CERTIFICAT_BIO',
      label: 'Certificat de conformitate agricultură biologică sau notificare conversie',
      mandatory: true,
      notes: 'Emis de organism de inspecție/certificare acreditat',
    },
    {
      type: 'ANGAJAMENT_ECO3',
      label: 'Angajament eco-schema 3',
      mandatory: true,
    },
  ],

  // ── ECO-M4: Pășuni HNV ────────────────────────────────────────────────────
  'ECO-M4': [
    {
      type: 'HARTA_HNV',
      label: 'Hartă identificare habitate HNV pe parcele declarate',
      mandatory: true,
    },
    {
      type: 'ANGAJAMENT_ECO4',
      label: 'Angajament eco-schema 4 – pășuni HNV',
      mandatory: true,
    },
  ],

  // ── ECO-M5: Bunăstarea animalelor ─────────────────────────────────────────
  'ECO-M5': [
    {
      type: 'COD_EXPLOATATIE_ANSVSA',
      label: 'Cod exploatație ANSVSA',
      mandatory: true,
    },
    {
      type: 'DECLARATIE_BUNASTARE_ANIMALE',
      label: 'Declarație privind condițiile de bunăstare a animalelor',
      mandatory: true,
    },
    {
      type: 'ANGAJAMENT_ECO5',
      label: 'Angajament eco-schema 5',
      mandatory: true,
    },
  ],

  // ── ECO-M6: Utilizare durabilă pesticide ──────────────────────────────────
  'ECO-M6': [
    {
      type: 'PLAN_IPM',
      label: 'Plan de management integrat al dăunătorilor (IPM)',
      mandatory: true,
    },
    {
      type: 'ANGAJAMENT_ECO6',
      label: 'Angajament eco-schema 6',
      mandatory: true,
    },
    {
      type: 'REGISTRU_FITOSANITAR',
      label: 'Extras registru fitosanitar pentru campania curentă',
      mandatory: false,
    },
  ],
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the document requirements for a dossier given the selected intervention codes.
 * Deduplicates by document type (takes the most restrictive / mandatory version).
 */
export function getRequiredDocuments(
  interventionCodes: string[],
  includeParcelDocs = true,
): DocumentRequirement[] {
  const map = new Map<string, DocumentRequirement>()

  // Always-required docs
  for (const req of DOC_RULES._ALL) {
    map.set(req.type, req)
  }

  // Per-parcel docs (land-use right)
  if (includeParcelDocs) {
    for (const req of DOC_RULES._PARCEL) {
      map.set(req.type, req)
    }
  }

  // Per-intervention docs
  for (const code of interventionCodes) {
    const rules = DOC_RULES[code]
    if (!rules) continue
    for (const req of rules) {
      const existing = map.get(req.type)
      // If both exist, keep the mandatory one
      if (!existing || (!existing.mandatory && req.mandatory)) {
        map.set(req.type, req)
      }
    }
  }

  return Array.from(map.values())
}

/**
 * Compute dossier completeness as a percentage 0–100.
 * Based on how many mandatory documents have status UPLOADED or VERIFIED.
 */
export function computeCompleteness(
  requiredDocs: DocumentRequirement[],
  uploadedDocTypes: Set<string>,
): number {
  const mandatory = requiredDocs.filter(d => d.mandatory)
  if (mandatory.length === 0) return 100
  const done = mandatory.filter(d =>
    uploadedDocTypes.has(d.type),
  ).length
  return Math.round((done / mandatory.length) * 100)
}

// ─── Change form metadata ─────────────────────────────────────────────────────

export const CHANGE_FORM_META: Record<
  string,
  { label: string; description: string; color: string }
> = {
  M1: {
    label: 'M1',
    description: 'Modificare declarație suprafețe',
    color: 'bg-blue-100 text-blue-700',
  },
  'M1.1': {
    label: 'M1.1',
    description: 'Modificare declarație zotehnică',
    color: 'bg-purple-100 text-purple-700',
  },
  'M1.2': {
    label: 'M1.2',
    description: 'Modificare declarație apă irigații',
    color: 'bg-cyan-100 text-cyan-700',
  },
  'M1.3': {
    label: 'M1.3',
    description: 'Modificare declarație protecție plante / echipament',
    color: 'bg-green-100 text-green-700',
  },
  'M1.4': {
    label: 'M1.4',
    description: 'Modificare declarație terase',
    color: 'bg-yellow-100 text-yellow-700',
  },
  'M1.5': {
    label: 'M1.5',
    description: 'Modificare studii agrochimice',
    color: 'bg-orange-100 text-orange-700',
  },
  M2: {
    label: 'M2',
    description: 'Completare cerere (adăugare elemente noi)',
    color: 'bg-indigo-100 text-indigo-700',
  },
  M3: {
    label: 'M3',
    description: 'Retragere parțială (renunțare la unele elemente)',
    color: 'bg-red-100 text-red-600',
  },
  M4: {
    label: 'M4',
    description: 'Modificare date administrative / bancare / societate',
    color: 'bg-gray-100 text-gray-700',
  },
}

export const LAND_USE_LABELS: Record<string, string> = {
  AR: 'Arabil',
  PS: 'Pășune',
  FN: 'Fânețe',
  LV: 'Livadă',
  VI: 'Vie',
  AL: 'Alte terenuri agricole',
}

export const LAND_RIGHT_LABELS: Record<string, string> = {
  ARENDA: 'Contract de arendă',
  PROPRIETATE: 'Proprietate',
  CONCESIUNE: 'Concesiune',
  COMODAT: 'Comodat',
  ASOCIERE: 'Asociere în participațiune',
  OTHER: 'Alt tip',
}

export const DOSSIER_STATUS_CFG: Record<
  string,
  { label: string; color: string }
> = {
  DRAFT:        { label: 'Ciornă',             color: 'bg-gray-100 text-gray-500' },
  CHECKING:     { label: 'În verificare',       color: 'bg-yellow-100 text-yellow-700' },
  READY:        { label: 'Pregătit depunere',   color: 'bg-blue-100 text-blue-700' },
  SUBMITTED:    { label: 'Depus APIA',          color: 'bg-indigo-100 text-indigo-700' },
  UNDER_REVIEW: { label: 'În analiză APIA',     color: 'bg-purple-100 text-purple-700' },
  ACCEPTED:     { label: 'Acceptat',            color: 'bg-green-100 text-green-700' },
  CORRECTED:    { label: 'Corectat (M form)',   color: 'bg-orange-100 text-orange-700' },
  ARCHIVED:     { label: 'Arhivat',             color: 'bg-gray-100 text-gray-400' },
}
