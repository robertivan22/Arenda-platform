'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { Plus, Loader2, ChevronRight, Power, Trash2, ShieldCheck, AlertTriangle, HelpCircle, Cpu } from 'lucide-react'
import type { Machine, TaricValidationResult } from '@/lib/fleet-types'
import { classifyMachine } from '@/lib/taric-classifier'

const MACHINE_TYPES = [
  { value: 'TRACTOR',    label: 'Tractor' },
  { value: 'COMBINA',    label: 'Combină' },
  { value: 'SEMANATOARE',label: 'Semănătoare' },
  { value: 'STROPITOARE',label: 'Stropitoare' },
  { value: 'REMORCA',    label: 'Remorcă' },
  { value: 'ALTELE',     label: 'Altele' },
]

const TYPE_COLORS: Record<string, string> = {
  TRACTOR:     'bg-blue-100 text-blue-700',
  COMBINA:     'bg-amber-100 text-amber-700',
  SEMANATOARE: 'bg-green-100 text-green-700',
  STROPITOARE: 'bg-cyan-100 text-cyan-700',
  REMORCA:     'bg-gray-100 text-gray-600',
  ALTELE:      'bg-purple-100 text-purple-700',
}

const EMPTY = () => ({
  name: '', type: 'TRACTOR', brand: '', model: '',
  year: '', plate: '', fuel_type: 'motorina', engine_hp: '', notes: '',
  rca_active: false, rca_price: '', rca_expiry_date: '',
  taric_code: '', taric_validated: false, taric_description: '', taric_checked_at: '',
})

export default function UtilajePage() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY())
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('ALL')
  const [taricResult, setTaricResult] = useState<TaricValidationResult | null>(null)
  const [taricChecking, setTaricChecking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await createClient().from('machines').select('*').order('name')
    setMachines((data ?? []) as Machine[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function addMachine(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const { data: { user } } = await createClient().auth.getUser()
    if (!user) { toast.error('Sesiune expirată. Reconectați-vă.'); setSaving(false); return }
    const { error } = await createClient().from('machines').insert({
      user_id: user.id,
      name: form.name.trim(),
      type: form.type,
      brand: form.brand || null,
      model: form.model || null,
      year: form.year ? Number(form.year) : null,
      plate: form.plate || null,
      fuel_type: form.fuel_type,
      engine_hp: form.engine_hp ? Number(form.engine_hp) : null,
      notes: form.notes || null,
      rca_active: form.rca_active,
      rca_price: form.rca_price ? Number(form.rca_price) : null,
      rca_expiry_date: form.rca_expiry_date || null,
      taric_code: form.taric_code || null,
      taric_validated: form.taric_validated || false,
      taric_description: form.taric_description || null,
      taric_checked_at: form.taric_checked_at || null,
    })
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Utilaj adăugat')
    setForm(EMPTY())
    setShowAdd(false)
    setTaricResult(null)
    void load()
    setSaving(false)
  }

  async function checkTaric() {
    const suggested = classifyMachine({ type: form.type, engine_hp: form.engine_hp ? Number(form.engine_hp) : null, brand: form.brand, model: form.model, name: form.name })
    const codeToCheck = form.taric_code || suggested.code
    setForm(f => ({ ...f, taric_code: codeToCheck }))
    setTaricChecking(true)
    try {
      const res = await fetch('/api/taric/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeToCheck, reference_date: new Date().toISOString().split('T')[0] }),
      })
      const data = await res.json() as TaricValidationResult
      setTaricResult(data)
      if (data.exists_in_taric && data.valid_for_reference_date) {
        setForm(f => ({
          ...f,
          taric_code: data.normalized_code,
          taric_validated: true,
          taric_description: data.description ?? '',
          taric_checked_at: new Date().toISOString(),
        }))
      }
    } catch {
      toast.error('Verificarea TARIC a eșuat. Încearcă din nou.')
    } finally {
      setTaricChecking(false)
    }
  }

  function suggestTaricCode() {
    const s = classifyMachine({ type: form.type, engine_hp: form.engine_hp ? Number(form.engine_hp) : null, brand: form.brand, model: form.model, name: form.name })
    setForm(f => ({ ...f, taric_code: s.code }))
    setTaricResult(null)
  }

  async function toggleActive(m: Machine) {
    const { error } = await createClient().from('machines').update({ is_active: !m.is_active }).eq('id', m.id)
    if (error) { toast.error(error.message); return }
    void load()
  }

  async function deleteMachine(id: string) {
    if (!confirm('Șterge utilajul? Această acțiune nu poate fi anulată.')) return
    const { error } = await createClient().from('machines').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    void load()
  }

  const filtered = filter === 'ALL' ? machines : machines.filter(m => m.type === filter)
  const activeCount = machines.filter(m => m.is_active).length
  const pathname = usePathname()

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <PageHeader title="Parc Utilaje" subtitle="Tractoare, combine, semănători și alte echipamente agricole" />
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Utilaj nou
        </button>
      </div>

      {/* Sub-nav */}
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        {[
          { label: 'Parc utilaje',  href: '/utilaje' },
          { label: 'Implementuri', href: '/utilaje/implementuri' },
          { label: 'Operatori',    href: '/utilaje/operatori' },
        ].map(t => (
          <a key={t.href} href={t.href}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              pathname === t.href ? 'bg-white shadow text-brand-700 font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </a>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-800">{machines.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total utilaje</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Active</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-400">{machines.length - activeCount}</div>
          <div className="text-xs text-gray-500 mt-0.5">Inactive / în service</div>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={addMachine} className="bg-white border border-brand-200 rounded-lg p-4 mb-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">Adaugă utilaj nou</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <input required
              className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Denumire *" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {MACHINE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={form.fuel_type} onChange={e => setForm(f => ({ ...f, fuel_type: e.target.value }))}>
              {['motorina', 'benzina', 'electric', 'hibrid'].map(v => <option key={v}>{v}</option>)}
            </select>
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Marcă" value={form.brand}
              onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Model" value={form.model}
              onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="An fabricație" type="number" min="1960" max={new Date().getFullYear() + 1}
              value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Nr. înmatriculare" value={form.plate}
              onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} />
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Putere (CP)" type="number" min="0" value={form.engine_hp}
              onChange={e => setForm(f => ({ ...f, engine_hp: e.target.value }))} />
            <input className="sm:col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Observații" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          {/* RCA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" className="rounded" checked={form.rca_active}
                onChange={e => setForm(f => ({ ...f, rca_active: e.target.checked }))} />
              RCA activ
            </label>
            <input className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Pret RCA (RON)" type="number" min="0" step="0.01"
              value={form.rca_price}
              onChange={e => setForm(f => ({ ...f, rca_price: e.target.value }))} />
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data expirare RCA</label>
              <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.rca_expiry_date}
                onChange={e => setForm(f => ({ ...f, rca_expiry_date: e.target.value }))} />
            </div>
          </div>
          {/* TARIC section */}
          <div className="border border-indigo-100 bg-indigo-50/50 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-semibold text-indigo-700">Cod Vamal TARIC</span>
              <span className="text-xs text-indigo-400">— pentru import / declarații vamale</span>
            </div>
            {/* How-it-works note */}
            <div className="mb-3 p-2.5 bg-white border border-indigo-100 rounded-lg text-xs text-gray-600 space-y-1">
              <p><span className="font-semibold text-indigo-700">Sugerează cod</span> — generează automat un cod candidat pe baza tipului de utilaj și puterii motorului (reguli deterministe: TRACTOR 75–130 CP → 8701941000, Combină → 8433510000 etc.).</p>
              <p><span className="font-semibold text-indigo-700">Verifică TARIC</span> — validează codul în nomenclatorul vamal combinat UE (CN/TARIC) via UK Trade Tariff API și returnează descrierea oficială și perioada de validitate.</p>
              <p className="text-gray-400">Coduri acceptate: 6 cifre (HS) · 8 cifre (CN/NC) · 10 cifre (TARIC). Câmpul este opțional și poate fi completat ulterior din fișa utilajului.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="ex. 8701941000 (10 cifre)"
                maxLength={10}
                value={form.taric_code}
                onChange={e => { setForm(f => ({ ...f, taric_code: e.target.value, taric_validated: false })); setTaricResult(null) }}
              />
              <button type="button" onClick={suggestTaricCode}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50 whitespace-nowrap">
                <HelpCircle className="w-3.5 h-3.5" /> Sugerează cod
              </button>
              <button type="button" onClick={() => void checkTaric()} disabled={taricChecking || !form.type}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap">
                {taricChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Verifică TARIC
              </button>
            </div>
            {taricResult && (
              <div className={`mt-2 p-2.5 rounded-lg text-xs border flex items-start gap-2 ${
                taricResult.error ? 'bg-amber-50 border-amber-200 text-amber-800' :
                taricResult.exists_in_taric && taricResult.valid_for_reference_date ? 'bg-green-50 border-green-200 text-green-800' :
                'bg-red-50 border-red-200 text-red-800'
              }`}>
                {taricResult.error ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> :
                 taricResult.exists_in_taric && taricResult.valid_for_reference_date ? <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> :
                 <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />}
                <div>
                  {taricResult.description && <div className="font-medium">{taricResult.description}</div>}
                  <div>{taricResult.message}</div>
                  {taricResult.code_level && <div className="text-xs opacity-70 mt-0.5">Nivel: {taricResult.code_level} · Cod: {taricResult.normalized_code}</div>}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Salvează
            </button>
            <button type="button" onClick={() => { setShowAdd(false); setForm(EMPTY()); setTaricResult(null) }}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Anulează
            </button>
          </div>
        </form>
      )}

      {/* Type filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[{ value: 'ALL', label: 'Toate' }, ...MACHINE_TYPES].map(f => (
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

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Se încarcă...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg flex flex-col items-center justify-center h-40 gap-2 text-gray-400 text-sm">
          {machines.length === 0 ? 'Niciun utilaj înregistrat.' : 'Niciun utilaj pentru filtrul ales.'}
        </div>
      ) : (
        <>
        <div className="hidden sm:block bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Tip</th>
                <th className="px-4 py-3 text-left">Denumire</th>
                <th className="px-4 py-3 text-left">Marcă / Model</th>
                <th className="px-4 py-3 text-left">An</th>
                <th className="px-4 py-3 text-left">Nr. înm.</th>
                <th className="px-4 py-3 text-left">Combustibil</th>
                <th className="px-4 py-3 text-left">RCA</th>
                <th className="px-4 py-3 text-left">TARIC</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Acțiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(m => {
                const cls   = TYPE_COLORS[m.type] ?? 'bg-gray-100 text-gray-600'
                const label = MACHINE_TYPES.find(t => t.value === m.type)?.label ?? m.type
                return (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cls}`}>{label}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{m.name}</td>
                    <td className="px-4 py-3 text-gray-500">{[m.brand, m.model].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{m.year ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{m.plate ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs capitalize">{m.fuel_type}</td>
                    <td className="px-4 py-3">
                      {m.rca_active ? (
                        <div>
                          <span className={`text-xs font-medium ${m.rca_expiry_date && new Date(m.rca_expiry_date) < new Date() ? 'text-red-600' : 'text-green-600'}`}>
                            {m.rca_expiry_date && new Date(m.rca_expiry_date) < new Date() ? 'Expirat' : 'Activ'}
                          </span>
                          {m.rca_expiry_date && <div className="text-xs text-gray-400">{m.rca_expiry_date}</div>}
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {m.taric_code ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-gray-700">{m.taric_code}</span>
                          {m.taric_validated
                            ? <ShieldCheck className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            : <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {m.is_active ? 'Activ' : 'Inactiv'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <a href={`/utilaje/${m.id}`}
                          className="p-1.5 text-gray-400 hover:text-brand-600 rounded" title="Detalii utilaj">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => void toggleActive(m)}
                          className={`p-1.5 rounded ${m.is_active ? 'text-green-500 hover:text-gray-400' : 'text-gray-400 hover:text-green-500'}`}
                          title={m.is_active ? 'Dezactivează' : 'Activează'}>
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => void deleteMachine(m.id)}
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

        {/* Mobile cards */}
        <div className="sm:hidden bg-white rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {filtered.map(m => {
            const cls   = TYPE_COLORS[m.type] ?? 'bg-gray-100 text-gray-600'
            const label = MACHINE_TYPES.find(t => t.value === m.type)?.label ?? m.type
            return (
              <div key={m.id} className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${cls}`}>{label}</span>
                    <span className="font-medium text-gray-900 text-sm truncate">{m.name}</span>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium flex-shrink-0 ${m.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {m.is_active ? 'Activ' : 'Inactiv'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mb-2">
                  <div><span className="text-gray-400">Marcă/Model </span>{[m.brand, m.model].filter(Boolean).join(' ') || '—'}</div>
                  <div><span className="text-gray-400">An </span>{m.year ?? '—'}</div>
                  <div><span className="text-gray-400">Nr. înm. </span><span className="font-mono">{m.plate ?? '—'}</span></div>
                  <div><span className="text-gray-400">Combustibil </span><span className="capitalize">{m.fuel_type}</span></div>
                  {m.rca_active && (
                    <div className="col-span-2">
                      <span className="text-gray-400">RCA </span>
                      <span className={`font-medium ${m.rca_expiry_date && new Date(m.rca_expiry_date) < new Date() ? 'text-red-600' : 'text-green-600'}`}>
                        {m.rca_expiry_date && new Date(m.rca_expiry_date) < new Date() ? 'Expirat' : 'Activ'}
                      </span>
                      {m.rca_expiry_date && <span className="text-gray-400 ml-1">{m.rca_expiry_date}</span>}
                    </div>
                  )}
                  {m.taric_code && (
                    <div className="col-span-2 flex items-center gap-1.5">
                      <span className="text-gray-400">TARIC </span>
                      <span className="font-mono text-xs">{m.taric_code}</span>
                      {m.taric_validated
                        ? <ShieldCheck className="w-3 h-3 text-green-500" />
                        : <AlertTriangle className="w-3 h-3 text-amber-400" />}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <a href={`/utilaje/${m.id}`}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                    <ChevronRight className="w-3 h-3" /> Detalii
                  </a>
                  <button onClick={() => void toggleActive(m)}
                    className={`flex items-center gap-1 px-3 py-1.5 text-xs border rounded-lg ${m.is_active ? 'border-green-200 text-green-600 hover:bg-green-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                    <Power className="w-3 h-3" /> {m.is_active ? 'Dezactivează' : 'Activează'}
                  </button>
                  <button onClick={() => void deleteMachine(m.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs border border-red-100 text-red-500 rounded-lg hover:bg-red-50">
                    <Trash2 className="w-3 h-3" /> Șterge
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        </>
      )}

      {/* Links to sub-pages */}
      <div className="flex gap-3 mt-6">
        <a href="/utilaje/operatori"
          className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">
          Gestionează operatori →
        </a>
        <a href="/utilaje/implementuri"
          className="flex items-center gap-1.5 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">
          Gestionează implementuri →
        </a>
      </div>
    </div>
  )
}
