/**
 * lib/api/response.ts
 *
 * Wrapper unificat pentru răspunsuri JSON din API routes.
 *
 * Când cookie-ul `impersonation_session_id` este prezent în request,
 * toate datele returnate sunt trecute prin `redactSensitiveFields()`
 * înainte de serializare — indiferent dacă rutele apelante știu sau nu
 * de mecanismul de impersonare.
 *
 * Utilizare:
 *   return jsonResponse(req, { data }, 200)
 *   return jsonResponse(req, { error: 'Not found' }, 404)
 *   return jsonError(req, 'Unauthorized', 401)
 */

import { type NextRequest } from 'next/server'
import { redactSensitiveFields, IMPERSONATION_COOKIE } from '@/lib/admin/sensitive-fields'

interface JsonResponseOptions {
  headers?: Record<string, string>
}

/**
 * Returnează un `Response` JSON, aplicând redactarea câmpurilor sensibile
 * automat dacă sesiunea curentă este o sesiune de impersonare.
 */
export function jsonResponse(
  request: NextRequest,
  data: unknown,
  status = 200,
  options: JsonResponseOptions = {},
): Response {
  const isImpersonating = !!request.cookies.get(IMPERSONATION_COOKIE)?.value

  const payload = isImpersonating
    ? redactSensitiveFields(data)
    : data

  return Response.json(payload, {
    status,
    headers: options.headers,
  })
}

/**
 * Scurtătură pentru răspunsuri de eroare.
 */
export function jsonError(
  request: NextRequest,
  message: string,
  status = 400,
  detail?: unknown,
): Response {
  return jsonResponse(
    request,
    detail !== undefined ? { error: message, detail } : { error: message },
    status,
  )
}

/**
 * Răspuns 403 standard pentru acțiuni blocate în mod impersonare.
 */
export function jsonImpersonationForbidden(request: NextRequest): Response {
  return jsonError(
    request,
    'Acțiune indisponibilă în mod impersonare',
    403,
  )
}
