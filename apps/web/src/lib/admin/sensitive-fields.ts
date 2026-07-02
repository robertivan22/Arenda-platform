/**
 * lib/admin/sensitive-fields.ts
 *
 * Definește câmpurile sensibile care nu se afișează NICIODATĂ în răspunsurile
 * API când o sesiune de impersonare este activă (cookie impersonation_session_id
 * prezent), chiar dacă query-ul de bază le-ar include.
 *
 * Funcția redactSensitiveFields() trebuie apelată pe orice obiect JSON înainte
 * de serializarea lui ca răspuns HTTP în contextul impersonării.
 */

// ── Lista explicită de coloane/câmpuri ÎNTOTDEAUNA redactate ─────────────────
const EXPLICIT_SENSITIVE_FIELDS = new Set([
  // Auth internals (nu sunt expuse normal, dar adăugate ca siguranță)
  'encrypted_password',
  'admin_refresh_token_encrypted',

  // Provider tokens OAuth (din auth.identities și tabele de business)
  'provider_token',
  'provider_refresh_token',
  'anaf_oauth_refresh_token',
  'anaf_access_token',
  'stripe_customer_secret',

  // Câmpuri 2FA / MFA
  'totp_secret',
  'recovery_codes',

  // Orice câmpuri de tip secret/token/password din tabelele de business
  // (adaugă aici coloanele specifice proiectului la nevoie)
  'webhook_secret',
  'api_key_secret',
])

// ── Pattern regex pentru câmpuri sensibile prin denumire ─────────────────────
// Prinde: *_password, *_secret, *_token, *_encrypted, totp_*, recovery_*
const SENSITIVE_PATTERN = /password|_secret$|_token$|_encrypted$|^totp_|^recovery_code/i

// ── Câmpuri EXCLUSE din redactare (false positives cunoscute) ────────────────
// Ex: "access_token" trimis explicit de client ca Bearer token este OK în
// contextul răspunsului de autentificare propriu-zisă, dar acolo impersonarea
// nu e activă. Lista de mai jos e de siguranță.
const REDACTION_EXCEPTIONS = new Set([
  // Nimic deocamdată — adaugă dacă apar false positives
])

/**
 * Redactează recursiv câmpurile sensibile dintr-un obiect JSON arbitrar.
 * Înlocuiește valoarea cu "[REDACTED]" fără a arunca erori.
 *
 * @param obj  Obiectul de redactat (plain object sau array)
 * @param depth Adâncimea recursiei (limitat la 10 pentru a preveni stack overflow)
 */
export function redactSensitiveFields(
  obj: unknown,
  depth = 0,
): unknown {
  if (depth > 10 || obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveFields(item, depth + 1))
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (
      !REDACTION_EXCEPTIONS.has(key) &&
      (EXPLICIT_SENSITIVE_FIELDS.has(key) || SENSITIVE_PATTERN.test(key))
    ) {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitiveFields(value, depth + 1)
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Verifică dacă un câmp dat este sensibil (util pentru logging/debugging).
 */
export function isSensitiveField(fieldName: string): boolean {
  return (
    !REDACTION_EXCEPTIONS.has(fieldName) &&
    (EXPLICIT_SENSITIVE_FIELDS.has(fieldName) || SENSITIVE_PATTERN.test(fieldName))
  )
}

/**
 * Rute API protejate în mod absolut în timpul impersonării.
 * Orice request la aceste rute întoarce 403 indiferent de scope sau metodă.
 */
export const PROTECTED_ROUTES_DURING_IMPERSONATION: RegExp[] = [
  /^\/api\/auth\/change-password/i,
  /^\/api\/auth\/reset-password/i,
  /^\/api\/auth\/update-password/i,
  /^\/api\/profil\/password/i,
  /^\/api\/setari\/api-keys/i,
  /^\/api\/setari\/integrations\/[^/]+\/secret/i,
  /^\/api\/efactura\/token/i,        // vizualizare/setare token ANAF SPV
  /^\/api\/etransport\/token/i,
  /^\/api\/stripe\/secret/i,
  /^\/api\/export/i,                 // export de date (poate include câmpuri sensibile)
]

/** Nume cookie care marchează o sesiune de impersonare activă */
export const IMPERSONATION_COOKIE = 'impersonation_session_id'
