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
 * Fetch user-specific template from Supabase.
 * Falls back to system default (user_id IS NULL) if no user template exists.
 * Returns null if even the system default is the placeholder comment.
 */
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

  if (userTmpl?.html_content && !userTmpl.html_content.includes('System default')) {
    return userTmpl as TemplateRow
  }

  // Fall back to system default (user_id IS NULL)
  const { data: sysTmpl } = await db
    .from('document_templates')
    .select('id, html_content, name')
    .is('user_id', null)
    .eq('doc_type', docType)
    .eq('is_active', true)
    .maybeSingle()

  if (sysTmpl?.html_content && !sysTmpl.html_content.includes('System default')) {
    return sysTmpl as TemplateRow
  }

  // No custom template — caller should use built-in JSX template
  return null
}
