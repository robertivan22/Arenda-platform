'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { Plus, Loader2, Power, Trash2, ArrowLeft } from 'lucide-react'
import type { Implement } from '@/lib/fleet-types'

const IMPL_TYPES = [
  { value: 'PLUG',        label: 'Plug' },
  { value: 'DISC',        label: 'Discuitor' },
  { value: 'CULTIVATOR',  label: 'Cultivator' },
  { value: 'SEMANATOARE', label: 'Semănătoare' },
  { value: 'STROPITOARE', label: 'Stropitoare / Bară' },
  { value: 'COSITOR',     label: 'Cositor / Tocător' },
  { value: 'REMORCA',     label: 'Remorcă' },
  { value: 'ALTELE',      label: 'Altele' },
]

const TYPE_COLORS: Record<string, string> = {
  PLUG:        'bg-orange-100 text-orange-700',
  DISC:        'bg-amber-100 text-amber-700',
  CULTIVATOR:  'bg-lime-100 text-lime-700',
  SEMANATOARE: 'bg-green-100 text-green-700',
  STROPITOARE: 'bg-cyan-100 text-cyan-700',
  COSITOR:     'bg-yellow-100 text-yellow-700',
  REMORCA:     'bg-gray-100 text-gray-600',
  ALTELE:      'bg-purple-100 text-purple-700',
}

const EMPTY = () => ({ name: '', type: 'PLUG', brand: '', model: '', year: '', notes: '' })

export default function ImplementuriPage() {
  const [items, setItems] = useState<Implement[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY())
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await createClient().from('implements').select('*').order('name')
    setItems((data ?? []) as Implement[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const { data: { user } } = await createClient().auth.getUser()
    if (!user) { toast.error('Sesiune expirată. Reconectați-vă.'); setSaving(false); return }
    const { error } = await createClient().from('implements').insert({
      user_id: user.id,
      name: form.name.trim(),
      type: form.type,
      brand: form.brand || null,
      model: form.model || null,
      year: form.year ? Number(form.year) : null,
      notes: form.notes || null,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Implement adăugat')
    setForm(EMPTY())
    setShowAdd(false)
    void load()
    setSaving(false)
  }

  async function toggleActive(item: Implement) {
    const { error } = await createClient().from('implements').update({ is_active: !item.is_active }).eq('id', item.id)
    if (error) { toast.error(error.message); return }
    void load()
  }

  async function del(id: string) {
    if (!confirm('Șterge implementul?')) return
    const { error } = await createClient().from('implements').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    void load()
  }

  const filtered = filter === 'ALL' ? items : items.filter(i => i.type === filter)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <a href="/utilaje" className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-4 h-4" />
        </a>
        <div className="flex-1">
          <PageHeader title="Implementuri & Atasamente" subtitle="Pluguri, discuitoare, semănători, stropitori și alte unelte" />
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700">
          <Plus className="w-4 h-4" /> Implement nou
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={add} className="bg-white border border-brand-200 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <input required className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Denumire *" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {IMPL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Marcă" value={form.brand}
              onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Model" value={form.model}
              onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="An fabricație" type="number" value={form.year}
              onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
            <input className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
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

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[{ value: 'ALL', label: 'Toate' }, ...IMPL_TYPES].map(f => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              filter === f.value
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-gray-300 text-gray-500 hover:border-brand-400'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Se încarcă...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg flex items-center justify-center h-40 text-gray-400 text-sm">
          {items.length === 0 ? 'Niciun implement înregistrat.' : 'Niciun implement pentru filtrul ales.'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Tip</th>
                <th className="px-4 py-3 text-left">Denumire</th>
                <th className="px-4 py-3 text-left">Marcă / Model</th>
                <th className="px-4 py-3 text-left">An</th>
                <th className="px-4 py-3 text-left">Note</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(item => {
                const cls   = TYPE_COLORS[item.type] ?? 'bg-gray-100 text-gray-600'
                const label = IMPL_TYPES.find(t => t.value === item.type)?.label ?? item.type
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>{label}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{item.name}</td>
                    <td className="px-4 py-3 text-gray-500">{[item.brand, item.model].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{item.year ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[160px] truncate">{item.notes ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${item.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {item.is_active ? 'Activ' : 'Inactiv'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => void toggleActive(item)}
                          className={`p-1.5 rounded ${item.is_active ? 'text-green-500 hover:text-gray-400' : 'text-gray-400 hover:text-green-500'}`}
                          title={item.is_active ? 'Dezactivează' : 'Activează'}>
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => void del(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded" title="Șterge">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
