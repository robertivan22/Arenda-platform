/**
 * ArendaPro — ANAF error classifier
 *
 * Maps ANAF HTTP error codes to user-friendly messages, recommended actions,
 * and internal error type identifiers.
 *
 * NEVER shows the raw Authorization header or token values.
 */

export type AnafErrorType =
  | 'anaf_unauthorized'      // HTTP 401 — token expired / invalid
  | 'anaf_bad_request'       // HTTP 400 — invalid XML / data
  | 'anaf_server_error'      // HTTP 500 — temporary ANAF issue
  | 'anaf_timeout'           // AbortError / fetch timeout
  | 'anaf_rejected'          // Declared but ANAF explicitly rejected content
  | 'anaf_unknown'           // Anything else

export interface AnafErrorInfo {
  type: AnafErrorType
  title: string
  message: string
  actions: string[]
  /** Raw technical detail to show in expandable section */
  technical: string
}

export function classifyAnafError(rawError: string): AnafErrorInfo {
  const lower = rawError.toLowerCase()

  // ── HTTP 401 ──────────────────────────────────────────────
  if (lower.includes('401') || lower.includes('unauthorized')) {
    return {
      type: 'anaf_unauthorized',
      title: 'Conexiune ANAF neautorizată',
      message:
        'Nu am putut trimite declarația e-Transport deoarece conexiunea cu ANAF nu este autorizată. ' +
        'Tokenul OAuth poate fi expirat, invalid sau aplicația nu are acces la serviciul RO e-Transport.',
      actions: [
        'Mergi la tab-ul Setări din pagina e-Transport.',
        'Apasă „Revocă" și reconectează contul ANAF.',
        'Obține un token nou din logincert.anaf.ro → Setări cont → Acces API / OAuth2.',
        'Verifică că CUI-ul firmei este corect în Setări → Companie.',
        'Revino la transport și apasă din nou „Generează cod UIT".',
      ],
      technical: rawError,
    }
  }

  // ── HTTP 400 ──────────────────────────────────────────────
  if (lower.includes('400') || lower.includes('bad request')) {
    return {
      type: 'anaf_bad_request',
      title: 'Date invalide pentru e-Transport',
      message:
        'Declarația XML conține date lipsă sau incorecte. ' +
        'ANAF a refuzat cererea din cauza formatului sau conținutului declarației.',
      actions: [
        'Verifică că toate bunurile au cod NC/TARIC (6–8 cifre).',
        'Verifică că numărul vehiculului este completat corect.',
        'Verifică că locul de încărcare și descărcare sunt specificate.',
        'Verifică că data transportului nu este mai veche de 7 zile.',
        'Verifică că CUI-ul companiei este valid în Setări → Companie.',
      ],
      technical: rawError,
    }
  }

  // ── HTTP 500 / 503 ────────────────────────────────────────
  if (lower.includes('500') || lower.includes('503') || lower.includes('service unavailable')) {
    return {
      type: 'anaf_server_error',
      title: 'Eroare temporară ANAF',
      message:
        'Serviciul RO e-Transport al ANAF nu a putut procesa cererea. ' +
        'Aceasta este o problemă temporară de infrastructură ANAF, nu o eroare a declarației.',
      actions: [
        'Încearcă din nou peste 5–10 minute.',
        'Verifică dacă serviciile ANAF sunt disponibile pe anaf.ro.',
        'Dacă problema persistă, salvează transportul și încearcă mai târziu.',
      ],
      technical: rawError,
    }
  }

  // ── Timeout ───────────────────────────────────────────────
  if (lower.includes('abort') || lower.includes('timeout') || lower.includes('time') && lower.includes('out')) {
    return {
      type: 'anaf_timeout',
      title: 'ANAF nu a răspuns la timp',
      message:
        'Cererea către serviciul RO e-Transport a expirat fără răspuns. ' +
        'Declarația poate fi sau nu înregistrată la ANAF.',
      actions: [
        'Apasă „Verifică status ANAF" pentru a vedea dacă declarația a fost înregistrată.',
        'Dacă nu există niciun status, încearcă să retrimiti declarația.',
        'Verifică conexiunea la internet.',
      ],
      technical: rawError,
    }
  }

  // ── Generic / unknown ─────────────────────────────────────
  return {
    type: 'anaf_unknown',
    title: 'Eroare la generarea codului UIT',
    message:
      'A apărut o eroare neașteptată la comunicarea cu serviciul RO e-Transport al ANAF.',
    actions: [
      'Verifică detaliile tehnice de mai jos.',
      'Verifică că tokenul ANAF este valid în tab-ul Setări.',
      'Încearcă din nou sau contactează suportul.',
    ],
    technical: rawError,
  }
}
