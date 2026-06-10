'use client'
export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { Plus, Loader2, Power, Pencil, Building2, Phone, Mail, Hash } from 'lucide-react'
import type { Supplier } from '@/lib/inventory-types'

const EMPTY_FORM = () => ({
  name: '', cui: '', address: '', phone: '', email: '', notes: '',
})

export default function FurnizoriPage() {
  const [rows, setRows] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(EMPTY_FORM())
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await createClient()
      .from('suppliers')
      .select('*')
      .order('name')
    if (error) toast.error('Eroare la incarcare furnizori.')
    setRows((data ?? []) as Supplier[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM())
    setShowModal(true)
  }

  function openEdit(s: Supplier) {
    setEditing(s)
    setForm({ name: s.name, cui: s.cui ?? '', address: s.address ?? '', phone: s.phone ?? '', email: s.email ?? '', notes: s.notes ?? '' })
    setShowModal(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Numele furnizorului este obligatoriu.'); return }
    setSaving(true)
    const db = createClient()
    if (editing) {
      const { error } = await db.from('suppliers').update({
        name: form.name.trim(), cui: form.cui.trim() || null,
        address: form.address.trim() || null, phone: form.phone.trim() || null,
        email: form.email.trim() || null, notes: form.notes.trim() || null,
      }).eq('id', editing.id)
      if (error) { toast.error('Eroare la salvare.'); setSaving(false); return }
      toast.success('Furnizor actualizat.')
    } else {
      const { data: { user } } = await db.auth.getUser()
      if (!user) { toast.error('Sesiune expirata.'); setSaving(false); return }
      const { error } = await db.from('suppliers').insert({
        user_id: user.id, name: form.name.trim(),
        cui: form.cui.trim() || null, address: form.address.trim() || null,
        phone: form.phone.trim() || null, email: form.email.trim() || null,
        notes: form.notes.trim() || null,
      })
      if (error) { toast.error('Eroare la adaugare.'); setSaving(false); return }
      toast.success('Furnizor adaugat.')
    }
    setSaving(false)
    setShowModal(false)
    void load()
  }

  async function toggleActive(s: Supplier) {
    const { error } = await createClient().from('suppliers').update({ is_active: !s.is_active }).eq('id', s.id)
    if (error) { toast.error('Eroare.'); return }
    toast.success(s.is_active ? 'Furnizor dezactivat.' : 'Furnizor activat.')
    void load()
  }

  const displayed = rows.filter(r =>
    filter === 'all' ? true : filter === 'active' ? r.is_active : !r.is_active
  )

  const inp = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500'
  const th = 'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide'
  const td = 'px-4 py-3 text-sm'

  return (
    <div>
      <PageHeader
        title="Furnizori"
        subtitle={`${rows.filter(r => r.is_active).length} activi din ${rows.length} total`}
        actions={
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            Furnizor nou
          </button>
        }
      />

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {(['active','all','inactive'] as const).map(v => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filter === v ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {v === 'active' ? 'Activi' : v === 'all' ? 'Toti' : 'Inactivi'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Niciun furnizor</p>
          <p className="text-sm mt-1">Adauga primul furnizor de inputuri agricole.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className={th}>Furnizor</th>
                <th className={th}>CUI</th>
                <th className={th}>Contact</th>
                <th className={th}>Status</th>
                <th className={th + ' text-right'}>Actiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayed.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className={td}>
                    <div className="font-medium text-gray-900">{s.name}</div>
                    {s.address && <div className="text-xs text-gray-400 mt-0.5">{s.address}</div>}
                  </td>
                  <td className={td}>
                    {s.cui ? (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                        <Hash className="w-3 h-3" />{s.cui}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className={td}>
                    <div className="flex flex-col gap-0.5">
                      {s.phone && <span className="inline-flex items-center gap-1 text-xs text-gray-600"><Phone className="w-3 h-3" />{s.phone}</span>}
                      {s.email && <span className="inline-flex items-center gap-1 text-xs text-gray-600"><Mail className="w-3 h-3" />{s.email}</span>}
                      {!s.phone && !s.email && <span className="text-gray-300 text-xs">—</span>}
                    </div>
                  </td>
                  <td className={td}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.is_active ? 'Activ' : 'Inactiv'}
                    </span>
                  </td>
                  <td className={td + ' text-right'}>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors" title="Editeaza">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleActive(s)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title={s.is_active ? 'Dezactiveaza' : 'Activeaza'}>
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">{editing ? 'Editeaza furnizor' : 'Furnizor nou'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={save} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Denumire *</label>
                <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Agro Distribution SRL" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">CUI</label>
                  <input className={inp} value={form.cui} onChange={e => setForm(f => ({ ...f, cui: e.target.value }))} placeholder="RO12345678" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
                  <input className={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0740 000 000" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" className={inp} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@furnizor.ro" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Adresa</label>
                <input className={inp} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Str., Nr., Localitate, Judet" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
                <textarea className={inp + ' resize-none'} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Anuleaza</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors">
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editing ? 'Salveaza' : 'Adauga'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
