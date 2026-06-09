'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Save, ChevronDown, ChevronRight, Shield, FileText, Users, Leaf, MessageSquare, Tractor, Activity, MapPin, LayoutDashboard, ExternalLink } from 'lucide-react'
import { CONFIG_FIELDS, getDefaults, DocConfig } from '@/lib/doc-config-fields'

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
  can_fitosanitar: boolean
  can_setari: boolean
}

interface ContactMessage {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  message: string
  is_read: boolean
  created_at: string
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
  { key: 'can_dashboard',    label: 'Dashboard' },
  { key: 'can_arendasi',     label: 'Arendași' },
  { key: 'can_contracte',    label: 'Contracte' },
  { key: 'can_parcele',      label: 'Parcele / Utilaje / Ferma' },
  { key: 'can_tranzactii',   label: 'Tranzacții' },
  { key: 'can_facturi',      label: 'Facturi & Avize' },
  { key: 'can_rapoarte',     label: 'Rapoarte' },
  { key: 'can_declaratii',   label: 'Declarații' },
  { key: 'can_fitosanitar',  label: 'Registru Fitosanitar' },
  { key: 'can_setari',       label: 'Setări' },
]

const DEFAULT_PERMS: Omit<Permissions, 'user_id'> = {
  can_dashboard: true, can_arendasi: true, can_contracte: true,
  can_parcele: true, can_tranzactii: true, can_facturi: true,
  can_rapoarte: true, can_declaratii: true, can_fitosanitar: true, can_setari: true,
}




// ─── Styles ───────────────────────────────────────────────────────────────────
const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50'
const tdCls = 'px-3 py-2 text-sm text-gray-800'

// ─── Component ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [tab, setTab] = useState<'users' | 'templates' | 'fitosanitar' | 'messages' | 'module'>('users')

  // Users
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [permissions, setPermissions] = useState<Record<string, Permissions>>({})
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [savingPerms, setSavingPerms] = useState(false)

  // Templates
  const [selectedUser, setSelectedUser] = useState<string>('') // '' = system default
  const [docType, setDocType] = useState<DocType>('FACTURA')
  const [templates, setTemplates] = useState<Record<string, Record<DocType, Template | null>>>({})
  const [editingConfig, setEditingConfig] = useState<DocConfig>({})
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Messages
  const [messages, setMessages] = useState<ContactMessage[]>([])

  // Fitosanitar
  interface FitoRow {
    id: string; user_id: string; user_email?: string
    numar_inregistrare: number; data_tratament: string; cultura: string
    denumire_produs: string; agent_daunare: string; suprafata_tratata: number
    tip_agent: string; observatii?: string | null
  }
  const [fitoRows, setFitoRows] = useState<FitoRow[]>([])
  const [fitoLoading, setFitoLoading] = useState(false)

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
    const [{ data: profs }, { data: perms }, { data: tmpls }, { data: msgs }] = await Promise.all([
      db.from('profiles').select('id, email, display_name, is_admin').order('email'),
      db.from('user_permissions').select('*'),
      db.from('document_templates').select('*'),
      db.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(200),
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
    setMessages((msgs ?? []) as ContactMessage[])
  }, [])

  // ── Load config into editor when user/docType changes ──────────────────────────
  useEffect(() => {
    const tmpl = templates[selectedUser]?.[docType]
    if (tmpl?.html_content) {
      try {
        const parsed = JSON.parse(tmpl.html_content)
        if (parsed && typeof parsed === 'object') { setEditingConfig(parsed); return }
      } catch {}
    }
    setEditingConfig(getDefaults(docType))
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

  async function markAsRead(id: string) {
    const { error } = await createClient().from('contact_messages').update({ is_read: true }).eq('id', id)
    if (!error) setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m))
  }

  const loadFitosanitar = useCallback(async () => {
    setFitoLoading(true)
    const db = createClient()
    const [{ data: entries }, { data: profs }] = await Promise.all([
      db.from('registru_fitosanitar').select('id,user_id,numar_inregistrare,data_tratament,cultura,denumire_produs,agent_daunare,suprafata_tratata,tip_agent,observatii').order('data_tratament', { ascending: false }).limit(500),
      db.from('profiles').select('id,email'),
    ])
    const emailMap: Record<string, string> = {}
    ;(profs ?? []).forEach((p: { id: string; email: string | null }) => { emailMap[p.id] = p.email ?? p.id })
    setFitoRows(((entries ?? []) as FitoRow[]).map(r => ({ ...r, user_email: emailMap[r.user_id] ?? r.user_id })))
    setFitoLoading(false)
  }, [])

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
    setSavingTemplate(true)
    const db = createClient()
    const existing = templates[selectedUser]?.[docType]
    const payload = {
      user_id: selectedUser || null,
      doc_type: docType,
      name: `${docType} Config`,
      html_content: JSON.stringify(editingConfig),
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
    toast.success('Configurație salvată.')
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
      toast.success('Configurație ştearsă — se vor folosi valorile implicite.')
    }
    setEditingConfig(getDefaults(docType))
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
          {([['users', 'Utilizatori'], ['templates', 'Template-uri'], ['fitosanitar', 'Registru Fitosanitar']] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => {
                setTab(k)
                if (k === 'fitosanitar') void loadFitosanitar()
              }}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === k ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >{l}</button>
          ))}
          <button
            onClick={() => setTab('messages')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              tab === 'messages' ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Mesaje Contact
            {messages.filter(m => !m.is_read).length > 0 && (
              <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">
                {messages.filter(m => !m.is_read).length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('module')}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'module' ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >Module noi</button>
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

            {/* Config field editor */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Texte editabile — {docType}</span>
                <div className="flex gap-2">
                  {selectedUser && templates[selectedUser]?.[docType] && (
                    <button
                      onClick={resetTemplate}
                      className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50 font-medium"
                    >
                      Resetează la implicit
                    </button>
                  )}
                  <button
                    onClick={saveTemplate}
                    disabled={savingTemplate}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#1e3a22] hover:bg-[#2d6a4f] text-white rounded font-medium disabled:opacity-60"
                  >
                    <Save className="w-3 h-3" />
                    {savingTemplate ? 'Se salvează...' : 'Salvează configurație'}
                  </button>
                </div>
              </div>

              <div className="p-4 grid gap-4">
                {CONFIG_FIELDS[docType].map(field => (
                  <div key={field.key}>
                    {field.type === 'checkbox' ? (
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <button
                          type="button"
                          onClick={() => setEditingConfig(c => ({
                            ...c,
                            [field.key]: (c[field.key] ?? field.defaultValue) === 'true' ? 'false' : 'true',
                          }))}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                            (editingConfig[field.key] ?? field.defaultValue) === 'true' ? 'bg-green-500' : 'bg-gray-200'
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                            (editingConfig[field.key] ?? field.defaultValue) === 'true' ? 'translate-x-4' : 'translate-x-0.5'
                          }`} />
                        </button>
                        <span className="text-sm font-medium text-gray-700">{field.label}</span>
                      </label>
                    ) : (
                      <>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                        {field.multiline ? (
                          <textarea
                            value={editingConfig[field.key] ?? field.defaultValue}
                            onChange={e => setEditingConfig(c => ({ ...c, [field.key]: e.target.value }))}
                            rows={3}
                            className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 resize-y"
                          />
                        ) : (
                          <input
                            type="text"
                            value={editingConfig[field.key] ?? field.defaultValue}
                            onChange={e => setEditingConfig(c => ({ ...c, [field.key]: e.target.value }))}
                            className="w-full text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                          />
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Info box */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
              <strong>Cum funcționează:</strong> Textele editate aici vor fi afișate în documentele generate pentru utilizatorul selectat.
              Dacă nu există o configurație salvată, se folosesc valorile implicite din aplicație.
              Selectați „Template implicit (sistem)" pentru a schimba valorile pentru toți utilizatorii care nu au configurație proprie.
            </div>
          </div>
        )}

        {/* ══ FITOSANITAR TAB ════════════════════════════════════════════════ */}
        {tab === 'fitosanitar' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Leaf className="w-4 h-4 text-green-600" />
              <h2 className="font-semibold text-gray-800">Registru Fitosanitar — Toate înregistrările ({fitoRows.length})</h2>
              <button
                onClick={() => void loadFitosanitar()}
                className="ml-auto px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
              >
                Reîncarcă
              </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {fitoLoading ? (
                <div className="py-12 text-center text-sm text-gray-400">Se încarcă...</div>
              ) : fitoRows.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  Nicio înregistrare. Rulați migrarea SQL în Supabase dacă tabela nu există.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>
                        <th className={thCls}>Utilizator</th>
                        <th className={thCls}>Nr.</th>
                        <th className={thCls}>Data Tratam.</th>
                        <th className={thCls}>Cultură</th>
                        <th className={thCls}>Produs PPP</th>
                        <th className={thCls}>Agent Dăunare</th>
                        <th className={thCls}>Tip Agent</th>
                        <th className={`${thCls} text-right`}>Ha</th>
                        <th className={thCls}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fitoRows.map(row => {
                        const isReplaced = typeof row.observatii === 'string' && row.observatii.startsWith('[ÎNLOCUIT]')
                        return (
                          <tr key={row.id} className={`border-b border-gray-100 ${isReplaced ? 'opacity-55 bg-gray-50' : 'hover:bg-gray-50'}`}>
                            <td className={`${tdCls} text-xs text-gray-500 max-w-[160px] truncate`}>{row.user_email}</td>
                            <td className="px-3 py-2 font-mono text-xs text-gray-500">#{row.numar_inregistrare}</td>
                            <td className={`${tdCls} whitespace-nowrap`}>{row.data_tratament}</td>
                            <td className={tdCls}>{row.cultura}</td>
                            <td className={`${tdCls} max-w-[160px] truncate`}>{row.denumire_produs}</td>
                            <td className={`${tdCls} max-w-[140px] truncate`}>{row.agent_daunare}</td>
                            <td className={tdCls}>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                row.tip_agent === 'boala'    ? 'bg-purple-100 text-purple-700' :
                                row.tip_agent === 'daunator' ? 'bg-red-100 text-red-700' :
                                row.tip_agent === 'buruiana' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>{row.tip_agent}</span>
                            </td>
                            <td className="px-3 py-2 text-right text-sm">{row.suprafata_tratata}</td>
                            <td className={tdCls}>
                              {isReplaced
                                ? <span className="bg-gray-200 text-gray-600 text-[10px] font-medium px-1.5 py-0.5 rounded">Inactiv</span>
                                : <span className="bg-green-100 text-green-700 text-[10px] font-medium px-1.5 py-0.5 rounded">Activ</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ══ MESSAGES TAB ═══════════════════════════════════════════════════ */}
        {tab === 'messages' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-800">
                Mesaje Contact ({messages.length})
              </h2>
              {messages.filter(m => !m.is_read).length > 0 && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-semibold">
                  {messages.filter(m => !m.is_read).length} necitite
                </span>
              )}
            </div>

            {messages.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-sm text-gray-400">
                Niciun mesaj primit încă.
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`bg-white rounded-lg border p-4 transition-colors ${
                      !msg.is_read ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          {!msg.is_read && <span className="w-2 h-2 bg-amber-500 rounded-full flex-shrink-0" />}
                          <span className="font-semibold text-gray-800 text-sm">{msg.name}</span>
                          {msg.company && <span className="text-xs text-gray-500">· {msg.company}</span>}
                          <span className="text-xs text-gray-400 ml-auto">
                            {new Date(msg.created_at).toLocaleString('ro-RO')}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                          <span>✉ {msg.email}</span>
                          {msg.phone && <span>📱 {msg.phone}</span>}
                        </div>
                        <p className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-gray-100 leading-relaxed">
                          {msg.message}
                        </p>
                      </div>
                      {!msg.is_read && (
                        <button
                          onClick={() => markAsRead(msg.id)}
                          className="flex-shrink-0 px-3 py-1.5 text-xs bg-[#1e3a22] text-white rounded-lg hover:bg-[#2d6a4f] transition-colors font-medium whitespace-nowrap"
                        >
                          Marchează citit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ MODULE NOI TAB ═════════════════════════════════════════════════ */}
        {tab === 'module' && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <LayoutDashboard className="w-4 h-4 text-gray-500" />
              <h2 className="font-semibold text-gray-800">Module noi adăugate</h2>
            </div>
            <p className="text-sm text-gray-500 -mt-3">Acces rapid la modulele implementate recent în platformă.</p>

            {/* Monitorizare Fermă */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Monitorizare Fermă</h3>
                  <p className="text-xs text-gray-500">Ruta: /ferma</p>
                </div>
                <a href="/ferma" target="_blank" className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> Deschide
                </a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="font-medium text-gray-700 mb-1">Surse date</p>
                  <p className="text-xs text-gray-500">Open-Meteo (meteo + sol, gratuit) + Sentinel Hub CDSE (NDVI satelitar)</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="font-medium text-gray-700 mb-1">Permisiune necesară</p>
                  <p className="text-xs text-gray-500"><code className="bg-gray-200 px-1 rounded">can_parcele</code> — controlat din tab Utilizatori</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="font-medium text-gray-700 mb-1">Env vars necesare</p>
                  <p className="text-xs text-gray-500 font-mono">SENTINEL_HUB_CLIENT_ID<br />SENTINEL_HUB_CLIENT_SECRET</p>
                </div>
              </div>
            </div>

            {/* Utilaje */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Tractor className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Parc Utilaje & Flotă</h3>
                  <p className="text-xs text-gray-500">Rute: /utilaje · /utilaje/implementuri · /utilaje/operatori</p>
                </div>
                <a href="/utilaje" target="_blank" className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> Deschide
                </a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { label: 'Parc utilaje', href: '/utilaje', desc: 'Lista mașini, jurnal lucru, combustibil, mentenanță' },
                  { label: 'Implementuri', href: '/utilaje/implementuri', desc: 'Plug, disc, semănătoare, stropitoare, remorcă etc.' },
                  { label: 'Operatori', href: '/utilaje/operatori', desc: 'Gestionare conducători și operatori utilaje' },
                  { label: 'Detaliu utilaj', href: '/utilaje', desc: 'Consum combustibil, program mentenanță, km/ore' },
                ].map(item => (
                  <a key={item.href + item.label} href={item.href} target="_blank"
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-colors group">
                    <MapPin className="w-4 h-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-800 group-hover:text-blue-700">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-400 ml-auto flex-shrink-0" />
                  </a>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">Permisiune: <code className="bg-gray-100 px-1 rounded">can_parcele</code> · SQL necesar: supabase-migration-fleet.sql + supabase-fix-rls-defaults.sql</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
