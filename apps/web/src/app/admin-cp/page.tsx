'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Save, ChevronDown, ChevronRight, Shield, FileText, Users, X } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Profile {
  id: string
  email: string | null
  display_name: string | null
  is_admin: boolean
}

interface Permissions {
  user_id: string
  can_dashboard: boolean
  can_arendasi: boolean
  can_contracte: boolean
  can_parcele: boolean
  can_tranzactii: boolean
  can_facturi: boolean
  can_rapoarte: boolean
  can_declaratii: boolean
  can_setari: boolean
}

interface Template {
  id?: string
  user_id: string | null
  doc_type: 'CONTRACT' | 'FACTURA' | 'AVIZ'
  name: string
  html_content: string
  is_active: boolean
}

type DocType = 'CONTRACT' | 'FACTURA' | 'AVIZ'

// ─── Permission field labels ──────────────────────────────────────────────────
const PERM_FIELDS: { key: keyof Omit<Permissions, 'user_id'>; label: string }[] = [
  { key: 'can_dashboard',  label: 'Dashboard' },
  { key: 'can_arendasi',   label: 'Arendași' },
  { key: 'can_contracte',  label: 'Contracte' },
  { key: 'can_parcele',    label: 'Parcele' },
  { key: 'can_tranzactii', label: 'Tranzacții' },
  { key: 'can_facturi',    label: 'Facturi & Avize' },
  { key: 'can_rapoarte',   label: 'Rapoarte' },
  { key: 'can_declaratii', label: 'Declarații' },
  { key: 'can_setari',     label: 'Setări' },
]

const DEFAULT_PERMS: Omit<Permissions, 'user_id'> = {
  can_dashboard: true, can_arendasi: true, can_contracte: true,
  can_parcele: true, can_tranzactii: true, can_facturi: true,
  can_rapoarte: true, can_declaratii: true, can_setari: true,
}

// ─── Placeholder reference per doc type ──────────────────────────────────────
const PLACEHOLDERS: Record<DocType, string[]> = {
  FACTURA: [
    '{{invoice_number}}', '{{invoice_series}}', '{{invoice_date}}', '{{due_date}}',
    '{{company_name}}', '{{company_cif}}', '{{company_reg_com}}', '{{company_address}}',
    '{{company_iban}}', '{{company_bank}}', '{{company_phone}}', '{{company_email}}',
    '{{client_name}}', '{{client_cnp}}', '{{client_address}}', '{{client_iban}}',
    '{{client_bank}}', '{{client_phone}}', '{{client_email}}',
    '{{products_table}}', '{{total_fara_tva}}', '{{tva_rate}}', '{{tva_amount}}', '{{total_cu_tva}}',
  ],
  AVIZ: [
    '{{aviz_number}}', '{{aviz_series}}', '{{aviz_date}}',
    '{{company_name}}', '{{company_cif}}', '{{company_address}}', '{{company_iban}}', '{{company_bank}}',
    '{{client_name}}', '{{client_cnp}}', '{{client_address}}', '{{client_iban}}', '{{client_bank}}',
    '{{products_table}}', '{{total_kg}}', '{{total_ron}}',
  ],
  CONTRACT: [
    '{{contract_number}}', '{{sign_date}}', '{{start_date}}', '{{end_date}}',
    '{{primarie_nr}}', '{{primarie_date}}',
    '{{company_name}}', '{{company_cif}}', '{{company_address}}', '{{company_iban}}', '{{company_bank}}',
    '{{lessor_name}}', '{{lessor_cnp}}', '{{lessor_address}}', '{{lessor_iban}}', '{{lessor_bank}}',
    '{{localities}}', '{{total_ha}}', '{{duration_years}}', '{{tax_method}}',
    '{{parcels_table}}', '{{rent_levels_table}}',
    '{{clause_1}}', '{{clause_2}}', '{{clause_3}}',
  ],
}

const STARTER_HTML: Record<DocType, string> = {
  FACTURA: `<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; font-size: 12px; padding: 20mm; }
  h1 { text-align: center; font-size: 18px; }
  .parties { display: flex; justify-content: space-between; margin: 16px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; }
  th { background: #f5f5f5; }
  .totals { text-align: right; margin-top: 8px; }
</style></head>
<body>
  <h1>FACTURĂ FISCALĂ</h1>
  <p style="text-align:center">Nr. {{invoice_number}} | Serie: {{invoice_series}} | Data: {{invoice_date}}</p>
  <div class="parties">
    <div><strong>FURNIZOR:</strong><br>{{company_name}}<br>CIF: {{company_cif}}<br>{{company_address}}<br>IBAN: {{company_iban}}</div>
    <div><strong>CLIENT:</strong><br>{{client_name}}<br>CNP: {{client_cnp}}<br>{{client_address}}<br>IBAN: {{client_iban}}</div>
  </div>
  {{products_table}}
  <div class="totals">
    <p>Total fără TVA: <strong>{{total_fara_tva}} RON</strong></p>
    <p>TVA {{tva_rate}}%: <strong>{{tva_amount}} RON</strong></p>
    <p>TOTAL: <strong>{{total_cu_tva}} RON</strong></p>
  </div>
</body></html>`,
  AVIZ: `<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; font-size: 12px; padding: 20mm; }
  h1 { text-align: center; font-size: 18px; }
  .parties { display: flex; justify-content: space-between; margin: 16px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; }
  th { background: #f5f5f5; }
</style></head>
<body>
  <h1>AVIZ DE ÎNSOȚIRE A MĂRFII</h1>
  <p style="text-align:center">Nr. {{aviz_number}} | Data: {{aviz_date}}</p>
  <div class="parties">
    <div><strong>FURNIZOR:</strong><br>{{company_name}}<br>CIF: {{company_cif}}<br>{{company_address}}</div>
    <div><strong>CLIENT:</strong><br>{{client_name}}<br>{{client_address}}</div>
  </div>
  {{products_table}}
</body></html>`,
  CONTRACT: `<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"><style>
  body { font-family: 'Times New Roman', serif; font-size: 11pt; padding: 20mm 28mm; }
  h1 { text-align: center; font-size: 14pt; }
  h2 { font-size: 11pt; text-transform: uppercase; border-bottom: 1px solid #ccc; margin-top: 14pt; }
  p { text-align: justify; margin: 6pt 0; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 10pt; }
  th, td { border: 1px solid #333; padding: 4pt 6pt; }
  th { background: #f0f0f0; }
</style></head>
<body>
  <h1>CONTRACT DE ARENDARE NR. {{contract_number}}</h1>
  <p style="text-align:center">Încheiat la data de {{sign_date}}</p>

  <h2>Părțile Contractante</h2>
  <p><strong>ARENDATOR:</strong> {{company_name}}, CIF {{company_cif}}, cu sediul în {{company_address}}</p>
  <p><strong>ARENDAȘ:</strong> {{lessor_name}}, CNP {{lessor_cnp}}, domiciliat în {{lessor_address}}</p>

  <h2>Obiectul Contractului</h2>
  <p>Arendatorul dă în arendă terenul agricol cu suprafața totală de {{total_ha}} ha,
  situat în {{localities}}.</p>
  {{parcels_table}}

  <h2>Durata Contractului</h2>
  <p>Contractul se încheie pe o perioadă de {{duration_years}} ani,
  începând cu data de {{start_date}} și expirând la data de {{end_date}}.</p>

  <h2>Arenda</h2>
  {{rent_levels_table}}

  <h2>Clauze Speciale</h2>
  <p>{{clause_1}}</p>
  <p>{{clause_2}}</p>

  <div style="display:flex; justify-content:space-between; margin-top:40pt">
    <div><strong>ARENDATOR</strong><br><br><br>{{company_name}}</div>
    <div><strong>ARENDAȘ</strong><br><br><br>{{lessor_name}}</div>
  </div>
</body></html>`,
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50'
const tdCls = 'px-3 py-2 text-sm text-gray-800'

// ─── Component ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [tab, setTab] = useState<'users' | 'templates'>('users')

  // Users
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [permissions, setPermissions] = useState<Record<string, Permissions>>({})
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [savingPerms, setSavingPerms] = useState(false)

  // Templates
  const [selectedUser, setSelectedUser] = useState<string>('') // '' = system default
  const [docType, setDocType] = useState<DocType>('FACTURA')
  const [templates, setTemplates] = useState<Record<string, Record<DocType, Template | null>>>({})
  const [editingHtml, setEditingHtml] = useState('')
  const [editingName, setEditingName] = useState('')
  const [showPlaceholders, setShowPlaceholders] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const db = createClient()
    db.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const { data: profile } = await db.from('profiles').select('is_admin').eq('id', user.id).single()
      if (profile?.is_admin) {
        setIsAdmin(true)
        await loadAll(db)
      }
      setLoading(false)
    })
  }, [])

  const loadAll = useCallback(async (db: ReturnType<typeof createClient>) => {
    const [{ data: profs }, { data: perms }, { data: tmpls }] = await Promise.all([
      db.from('profiles').select('id, email, display_name, is_admin').order('email'),
      db.from('user_permissions').select('*'),
      db.from('document_templates').select('*'),
    ])

    setProfiles((profs ?? []) as Profile[])

    // Index permissions by user_id
    const permMap: Record<string, Permissions> = {}
    ;(perms ?? []).forEach((p: Permissions) => { permMap[p.user_id] = p })
    setPermissions(permMap)

    // Index templates by user_id ('' for system) + docType
    const tmplMap: Record<string, Record<DocType, Template | null>> = { '': { CONTRACT: null, FACTURA: null, AVIZ: null } }
    ;(tmpls ?? []).forEach((t: Template) => {
      const key = t.user_id ?? ''
      if (!tmplMap[key]) tmplMap[key] = { CONTRACT: null, FACTURA: null, AVIZ: null }
      tmplMap[key][t.doc_type] = t
    })
    setTemplates(tmplMap)
  }, [])

  // ── Load template into editor when user/docType changes ────────────────────
  useEffect(() => {
    const tmpl = templates[selectedUser]?.[docType]
    setEditingHtml(tmpl?.html_content ?? STARTER_HTML[docType])
    setEditingName(tmpl?.name ?? (selectedUser === '' ? `Default ${docType}` : `Template ${docType}`))
  }, [selectedUser, docType, templates])

  // ── Save permissions ────────────────────────────────────────────────────────
  async function savePermissions(userId: string, p: Permissions) {
    setSavingPerms(true)
    const db = createClient()
    const { error } = await db.from('user_permissions').upsert({
      ...p, user_id: userId, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    setSavingPerms(false)
    if (error) { toast.error(error.message); return }
    toast.success('Permisiuni salvate.')
  }

  function togglePerm(userId: string, field: keyof Omit<Permissions, 'user_id'>) {
    const current = permissions[userId] ?? { user_id: userId, ...DEFAULT_PERMS }
    const updated = { ...current, [field]: !current[field] }
    setPermissions(prev => ({ ...prev, [userId]: updated }))
  }

  // ── Toggle is_admin ─────────────────────────────────────────────────────────
  async function toggleAdmin(profile: Profile) {
    const db = createClient()
    const { error } = await db.from('profiles').update({ is_admin: !profile.is_admin }).eq('id', profile.id)
    if (error) { toast.error(error.message); return }
    setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, is_admin: !p.is_admin } : p))
    toast.success(`${profile.email} ${!profile.is_admin ? 'promovat admin' : 'revocat din admin'}.`)
  }

  // ── Save template ───────────────────────────────────────────────────────────
  async function saveTemplate() {
    if (!editingHtml.trim()) { toast.error('Template-ul este gol.'); return }
    setSavingTemplate(true)
    const db = createClient()
    const existing = templates[selectedUser]?.[docType]
    const payload = {
      user_id: selectedUser || null,
      doc_type: docType,
      name: editingName || `${docType} Template`,
      html_content: editingHtml,
      is_active: true,
      updated_at: new Date().toISOString(),
    }
    let error
    if (existing?.id) {
      ;({ error } = await db.from('document_templates').update(payload).eq('id', existing.id))
    } else {
      ;({ error } = await db.from('document_templates').insert(payload))
    }
    setSavingTemplate(false)
    if (error) { toast.error(error.message); return }
    toast.success('Template salvat.')
    // Reload templates
    const { data: tmpls } = await db.from('document_templates').select('*')
    const tmplMap: Record<string, Record<DocType, Template | null>> = { '': { CONTRACT: null, FACTURA: null, AVIZ: null } }
    ;(tmpls ?? []).forEach((t: Template) => {
      const key = t.user_id ?? ''
      if (!tmplMap[key]) tmplMap[key] = { CONTRACT: null, FACTURA: null, AVIZ: null }
      tmplMap[key][t.doc_type] = t
    })
    setTemplates(tmplMap)
  }

  // ── Reset to default ────────────────────────────────────────────────────────
  async function resetTemplate() {
    const db = createClient()
    const existing = templates[selectedUser]?.[docType]
    if (existing?.id) {
      await db.from('document_templates').delete().eq('id', existing.id)
      setTemplates(prev => {
        const n = { ...prev }
        if (n[selectedUser]) n[selectedUser][docType] = null
        return n
      })
      toast.success('Template șters — se va folosi cel implicit.')
    }
    setEditingHtml(STARTER_HTML[docType])
    setEditingName(`Default ${docType}`)
  }

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="flex h-screen items-center justify-center text-gray-400 text-sm">Se verifică accesul...</div>
  }
  if (!isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-gray-500 text-sm">Acces restricționat. Această pagină este disponibilă doar pentru administratori.</p>
        </div>
      </div>
    )
  }

  const currentUserPerms = (userId: string): Permissions =>
    permissions[userId] ?? { user_id: userId, ...DEFAULT_PERMS }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1e3a22] text-white px-6 py-4 flex items-center gap-3">
        <Shield className="w-5 h-5 text-amber-400" />
        <span className="font-bold text-lg">Admin Panel</span>
        <span className="text-white/40 text-sm ml-auto">ArendaPro</span>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0">
          {([['users', 'Utilizatori'], ['templates', 'Template-uri']] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === k ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >{l}</button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">

        {/* ══ USERS TAB ══════════════════════════════════════════════════════ */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-800">Utilizatori ({profiles.length})</h2>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th className={thCls}>Email</th>
                    <th className={thCls}>Nume afișat</th>
                    <th className={thCls}>Admin</th>
                    <th className={thCls}>Permisiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map(profile => {
                    const perms = currentUserPerms(profile.id)
                    const isExpanded = expandedUser === profile.id
                    const allEnabled = PERM_FIELDS.every(f => perms[f.key])
                    return (
                      <>
                        <tr
                          key={profile.id}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className={`${tdCls} font-medium`}>{profile.email ?? '—'}</td>
                          <td className={tdCls}>
                            <input
                              type="text"
                              defaultValue={profile.display_name ?? ''}
                              onBlur={async e => {
                                const db = createClient()
                                await db.from('profiles').update({ display_name: e.target.value }).eq('id', profile.id)
                              }}
                              placeholder="(nesetat)"
                              className="text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-400 rounded px-1 py-0.5 w-full"
                            />
                          </td>
                          <td className={tdCls}>
                            {/* Admin toggle */}
                            <button
                              onClick={() => toggleAdmin(profile)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                profile.is_admin ? 'bg-amber-500' : 'bg-gray-200'
                              }`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                                profile.is_admin ? 'translate-x-4' : 'translate-x-0.5'
                              }`} />
                            </button>
                          </td>
                          <td className={tdCls}>
                            <button
                              onClick={() => setExpandedUser(isExpanded ? null : profile.id)}
                              className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
                            >
                              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              {allEnabled ? 'Toate active' : `${PERM_FIELDS.filter(f => perms[f.key]).length}/${PERM_FIELDS.length}`}
                            </button>
                          </td>
                        </tr>

                        {/* Expanded permissions row */}
                        {isExpanded && (
                          <tr key={`${profile.id}-perms`}>
                            <td colSpan={4} className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                              <div className="flex items-center gap-2 mb-3">
                                <Shield className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-xs font-semibold text-gray-500 uppercase">Permisiuni acces secțiuni</span>
                              </div>
                              <div className="grid grid-cols-3 gap-3 mb-4">
                                {PERM_FIELDS.map(f => (
                                  <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                                    <button
                                      type="button"
                                      onClick={() => togglePerm(profile.id, f.key)}
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                                        perms[f.key] ? 'bg-green-500' : 'bg-gray-200'
                                      }`}
                                    >
                                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                                        perms[f.key] ? 'translate-x-4' : 'translate-x-0.5'
                                      }`} />
                                    </button>
                                    <span className="text-sm text-gray-700">{f.label}</span>
                                  </label>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => savePermissions(profile.id, perms)}
                                  disabled={savingPerms}
                                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1e3a22] hover:bg-[#2d6a4f] text-white rounded font-medium disabled:opacity-60"
                                >
                                  <Save className="w-3 h-3" />
                                  {savingPerms ? 'Se salvează...' : 'Salvează permisiuni'}
                                </button>
                                <button
                                  onClick={() => {
                                    const all = { user_id: profile.id, ...DEFAULT_PERMS }
                                    setPermissions(prev => ({ ...prev, [profile.id]: all }))
                                  }}
                                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-100"
                                >
                                  Activează tot
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                  {profiles.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-sm text-gray-400">Niciun utilizator găsit.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ TEMPLATES TAB ══════════════════════════════════════════════════ */}
        {tab === 'templates' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-800">Template-uri documente</h2>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-4 flex-wrap">
                {/* User selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Utilizator</label>
                  <select
                    value={selectedUser}
                    onChange={e => setSelectedUser(e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400 min-w-[200px]"
                  >
                    <option value="">⚙️ Template implicit (sistem)</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.email ?? p.id}</option>
                    ))}
                  </select>
                </div>

                {/* Doc type */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tip document</label>
                  <div className="flex rounded-lg overflow-hidden border border-gray-200">
                    {(['FACTURA', 'AVIZ', 'CONTRACT'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setDocType(t)}
                        className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                          docType === t ? 'bg-[#1e3a22] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >{t}</button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div className="ml-auto text-xs text-gray-500 self-end pb-1.5">
                  {templates[selectedUser]?.[docType]
                    ? <span className="text-green-600 font-medium">✓ Template personalizat activ</span>
                    : selectedUser
                      ? <span className="text-amber-600">⚠ Folosește template-ul implicit</span>
                      : <span className="text-gray-500">Template implicit de sistem</span>}
                </div>
              </div>
            </div>

            {/* Template editor */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    placeholder="Nume template"
                    className="text-sm font-medium border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                  <button
                    onClick={() => setShowPlaceholders(v => !v)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {showPlaceholders ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    Placeholder-uri disponibile
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPreview(true)}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100 font-medium"
                  >
                    Previzualizare
                  </button>
                  {selectedUser && templates[selectedUser]?.[docType] && (
                    <button
                      onClick={resetTemplate}
                      className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 font-medium"
                    >
                      Șterge (revin la implicit)
                    </button>
                  )}
                  <button
                    onClick={saveTemplate}
                    disabled={savingTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1e3a22] hover:bg-[#2d6a4f] text-white rounded font-medium disabled:opacity-60"
                  >
                    <Save className="w-3 h-3" />
                    {savingTemplate ? 'Se salvează...' : 'Salvează template'}
                  </button>
                </div>
              </div>

              {/* Placeholders reference */}
              {showPlaceholders && (
                <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                  <p className="text-xs font-semibold text-blue-700 mb-2">Placeholder-uri pentru {docType}:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PLACEHOLDERS[docType].map(ph => (
                      <button
                        key={ph}
                        onClick={() => setEditingHtml(h => h + ph)}
                        className="px-2 py-0.5 bg-white border border-blue-200 text-blue-700 text-xs rounded font-mono hover:bg-blue-100 transition-colors"
                        title="Click pentru a insera"
                      >
                        {ph}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-blue-500 mt-2">Click pe un placeholder pentru a-l insera la sfârșitul templateului.</p>
                </div>
              )}

              {/* HTML textarea */}
              <textarea
                value={editingHtml}
                onChange={e => setEditingHtml(e.target.value)}
                rows={28}
                spellCheck={false}
                className="w-full p-4 text-xs font-mono text-gray-800 border-0 focus:outline-none resize-y"
                placeholder="Scrie HTML-ul template-ului aici..."
              />
            </div>

            {/* Info box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
              <strong>Cum funcționează:</strong> Dacă un utilizator are un template personalizat setat pentru un tip de document,
              acel template va fi folosit la generarea documentului (cu placeholder-urile înlocuite cu datele reale).
              Dacă nu are template, se va folosi template-ul implicit (codul JSX din aplicație).
              Template-ul de sistem poate fi înlocuit prin selectarea „Template implicit (sistem)" și salvarea unui HTML personalizat.
            </div>
          </div>
        )}
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-sm">Previzualizare template — {docType}</span>
              <button onClick={() => setShowPreview(false)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {/* dangerouslySetInnerHTML is safe here — only the admin can edit and view this */}
              <iframe
                srcDoc={editingHtml}
                className="w-full h-full border-0 min-h-[600px]"
                title="Template Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
