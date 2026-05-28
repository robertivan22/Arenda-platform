/**
 * Renders a document template by replacing {{placeholder}} tags with actual data.
 * Returns the filled HTML string, or null if no template was found for the user.
 *
 * Usage in print pages:
 *   const html = await getUserTemplate(db, userId, 'FACTURA', data)
 *   if (html) return <div dangerouslySetInnerHTML={{ __html: html }} />
 *   // else: render default JSX template
 */
export function renderTemplate(html: string, data: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : `{{${key}}}`
  })
}

export type DocType = 'CONTRACT' | 'FACTURA' | 'AVIZ'

export interface TemplateRow {
  id: string
  html_content: string
  name: string
}

/**
 * Fetch JSON text-config for a user+docType from document_templates.
 * Falls back to system default (user_id IS NULL).
 * Returns null if no saved config exists → caller uses built-in defaults.
 */
export async function fetchTextConfig(
  db: ReturnType<typeof import('@/lib/supabase/client').createClient>,
  userId: string,
  docType: DocType,
): Promise<Record<string, string> | null> {
  const tryParse = (s: string | null | undefined) => {
    if (!s) return null
    try { const p = JSON.parse(s); if (typeof p === 'object') return p as Record<string, string> } catch {}
    return null
  }

  const { data: userRow } = await db
    .from('document_templates')
    .select('html_content')
    .eq('user_id', userId)
    .eq('doc_type', docType)
    .eq('is_active', true)
    .maybeSingle()
  const userCfg = tryParse(userRow?.html_content)
  if (userCfg) return userCfg

  const { data: sysRow } = await db
    .from('document_templates')
    .select('html_content')
    .is('user_id', null)
    .eq('doc_type', docType)
    .eq('is_active', true)
    .maybeSingle()
  return tryParse(sysRow?.html_content)
}

export async function fetchTemplate(
  db: ReturnType<typeof import('@/lib/supabase/client').createClient>,
  userId: string,
  docType: DocType,
): Promise<TemplateRow | null> {
  // Try user-specific template first
  const { data: userTmpl } = await db
    .from('document_templates')
    .select('id, html_content, name')
    .eq('user_id', userId)
    .eq('doc_type', docType)
    .eq('is_active', true)
    .maybeSingle()

  if (userTmpl?.html_content) return userTmpl as TemplateRow

  // Fall back to system default (user_id IS NULL)
  const { data: sysTmpl } = await db
    .from('document_templates')
    .select('id, html_content, name')
    .is('user_id', null)
    .eq('doc_type', docType)
    .eq('is_active', true)
    .maybeSingle()

  if (sysTmpl?.html_content) return sysTmpl as TemplateRow

  // No custom template — caller should use built-in JSX template
  return null
}
