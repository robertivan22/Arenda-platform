'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { Plus, Loader2, Power, Trash2, ArrowLeft } from 'lucide-react'
import type { Operator } from '@/lib/fleet-types'

const EMPTY = () => ({ name: '', phone: '', license_category: '', notes: '' })

export default function OperatoriPage() {
  const [operators, setOperators] = useState<Operator[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await createClient().from('operators').select('*').order('name')
    setOperators((data ?? []) as Operator[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const { data: { user } } = await createClient().auth.getUser()
    if (!user) { toast.error('Sesiune expirată. Reconectați-vă.'); setSaving(false); return }
    const { error } = await createClient().from('operators').insert({
      user_id: user.id,
      name: form.name.trim(),
      phone: form.phone || null,
      license_category: form.license_category || null,
      notes: form.notes || null,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Operator adăugat')
    setForm(EMPTY())
    setShowAdd(false)
    void load()
    setSaving(false)
  }

  async function toggleActive(op: Operator) {
    const { error } = await createClient().from('operators').update({ is_active: !op.is_active }).eq('id', op.id)
    if (error) { toast.error(error.message); return }
    void load()
  }

  async function del(id: string) {
    if (!confirm('Șterge operatorul? Înregistrările de lucru existente nu vor fi afectate.')) return
    const { error } = await createClient().from('operators').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    void load()
  }

  const activeCount = operators.filter(o => o.is_active).length

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <a href="/utilaje" className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-4 h-4" />
        </a>
        <div className="flex-1">
          <PageHeader title="Operatori" subtitle="Mecanizatori și conducători auto utilaje agricole" />
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700">
          <Plus className="w-4 h-4" /> Operator nou
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xl font-bold text-gray-800">{operators.length}</div>
          <div className="text-xs text-gray-500">Total operatori</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xl font-bold text-green-600">{activeCount}</div>
          <div className="text-xs text-gray-500">Activi</div>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={add} className="bg-white border border-brand-200 rounded-lg p-4 mb-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">Adaugă operator</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input required className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Nume complet *" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Telefon" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Categorii permis (ex: B, C, TR)" value={form.license_category}
              onChange={e => setForm(f => ({ ...f, license_category: e.target.value }))} />
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Observații" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Salvează
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setForm(EMPTY()) }}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Anulează
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Se încarcă...
        </div>
      ) : operators.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg flex items-center justify-center h-40 text-gray-400 text-sm">
          Niciun operator înregistrat.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Nume</th>
                <th className="px-4 py-3 text-left">Telefon</th>
                <th className="px-4 py-3 text-left">Categorii permis</th>
                <th className="px-4 py-3 text-left">Note</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {operators.map(op => (
                <tr key={op.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold shrink-0">
                        {op.name.charAt(0).toUpperCase()}
                      </div>
                      {op.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{op.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{op.license_category ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px] truncate">{op.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${op.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {op.is_active ? 'Activ' : 'Inactiv'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => void toggleActive(op)}
                        className={`p-1.5 rounded ${op.is_active ? 'text-green-500 hover:text-gray-400' : 'text-gray-400 hover:text-green-500'}`}
                        title={op.is_active ? 'Dezactivează' : 'Activează'}>
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => void del(op.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded" title="Șterge">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
