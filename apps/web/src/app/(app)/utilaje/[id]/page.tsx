'use client'

export const runtime = 'edge'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Loader2, Pencil, Save, X, Trash2,
  Fuel, Wrench, ClipboardList, Settings2,
  CheckCircle2, AlertTriangle, Clock,
} from 'lucide-react'
import type { Machine, FuelLog, MaintenanceTask, MachineWorkLog, Operator, Implement } from '@/lib/fleet-types'

// ─── Constants ────────────────────────────────────────────────────────────────

const MACHINE_TYPES = [
  { value: 'TRACTOR', label: 'Tractor' }, { value: 'COMBINA', label: 'Combină' },
  { value: 'SEMANATOARE', label: 'Semănătoare' }, { value: 'STROPITOARE', label: 'Stropitoare' },
  { value: 'REMORCA', label: 'Remorcă' }, { value: 'ALTELE', label: 'Altele' },
]

const OP_TYPES = [
  { value: 'ARAT', label: 'Arat' }, { value: 'DISCUIT', label: 'Discuit' },
  { value: 'SEMANAT', label: 'Semănat' }, { value: 'FERTILIZAT', label: 'Fertilizat' },
  { value: 'ERBICIDAT', label: 'Erbicidat' }, { value: 'STROPIT', label: 'Stropit' },
  { value: 'RECOLTAT', label: 'Recoltat' }, { value: 'TRANSPORT', label: 'Transport' },
  { value: 'ALTELE', label: 'Altele' },
]

const MAINT_TYPES = [
  { value: 'SERVICE', label: 'Service' }, { value: 'REVIZIE', label: 'Revizie' },
  { value: 'REPARATIE', label: 'Reparație' }, { value: 'ITP', label: 'ITP' },
  { value: 'ALTELE', label: 'Altele' },
]

type TabType = 'general' | 'jurnal' | 'combustibil' | 'mentenanta'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('ro-RO')
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MachineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [machine,  setMachine]  = useState<Machine | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('general')

  // ── General tab
  const [editing,  setEditing]  = useState(false)
  const [editForm, setEditForm] = useState<Partial<Machine>>({})
  const [saving,   setSaving]   = useState(false)

  // ── Jurnal lucru tab
  const [workLogs,    setWorkLogs]    = useState<MachineWorkLog[]>([])
  const [operators,   setOperators]   = useState<Operator[]>([])
  const [implements_, setImplements]  = useState<Implement[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [showAddLog,  setShowAddLog]  = useState(false)
  const [savingLog,   setSavingLog]   = useState(false)
  const [logForm, setLogForm] = useState({
    log_date: new Date().toISOString().split('T')[0],
    operator_id: '', implement_id: '', operation_type: 'ARAT',
    hours_worked: '', area_worked_ha: '', fuel_consumed_l: '',
    start_hours: '', end_hours: '', notes: '',
  })

  // ── Combustibil tab
  const [fuelLogs,    setFuelLogs]    = useState<FuelLog[]>([])
  const [fuelLoading, setFuelLoading] = useState(false)
  const [showAddFuel, setShowAddFuel] = useState(false)
  const [savingFuel,  setSavingFuel]  = useState(false)
  const [fuelForm, setFuelForm] = useState({
    log_date: new Date().toISOString().split('T')[0],
    liters: '', cost_per_liter: '', odometer_km: '',
    hours_meter: '', location: '', notes: '',
  })

  // ── Mentenanță tab
  const [maintTasks,   setMaintTasks]   = useState<MaintenanceTask[]>([])
  const [maintLoading, setMaintLoading] = useState(false)
  const [showAddMaint, setShowAddMaint] = useState(false)
  const [savingMaint,  setSavingMaint]  = useState(false)
  const [maintForm, setMaintForm] = useState({
    title: '', type: 'SERVICE', due_date: '', due_hours: '',
    due_km: '', cost: '', service_provider: '', notes: '',
  })

  // ── Load machine ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    createClient().from('machines').select('*').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) { toast.error('Utilaj negăsit'); router.push('/utilaje'); return }
        setMachine(data as Machine)
        setEditForm(data as Machine)
        setLoading(false)
      })
  }, [id, router])

  // ── Load tab data ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !machine) return
    const db = createClient()

    if (activeTab === 'jurnal' && workLogs.length === 0 && !logsLoading) {
      setLogsLoading(true)
      Promise.all([
        db.from('machine_work_logs')
          .select('*, operators(name), implements(name)')
          .eq('machine_id', id)
          .order('log_date', { ascending: false }),
        db.from('operators').select('id,name').eq('is_active', true).order('name'),
        db.from('implements').select('id,name,type').eq('is_active', true).order('name'),
      ]).then(([{ data: logs }, { data: ops }, { data: impls }]) => {
        setWorkLogs((logs ?? []) as MachineWorkLog[])
        setOperators((ops ?? []) as Operator[])
        setImplements((impls ?? []) as Implement[])
        setLogsLoading(false)
      })
    }

    if (activeTab === 'combustibil' && fuelLogs.length === 0 && !fuelLoading) {
      setFuelLoading(true)
      db.from('fuel_logs').select('*').eq('machine_id', id)
        .order('log_date', { ascending: false })
        .then(({ data }) => { setFuelLogs((data ?? []) as FuelLog[]); setFuelLoading(false) })
    }

    if (activeTab === 'mentenanta' && maintTasks.length === 0 && !maintLoading) {
      setMaintLoading(true)
      db.from('maintenance_tasks').select('*').eq('machine_id', id)
        .order('due_date', { ascending: true, nullsFirst: false })
        .then(({ data }) => { setMaintTasks((data ?? []) as MaintenanceTask[]); setMaintLoading(false) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id, machine])

  // ── General: save ──────────────────────────────────────────────────────────
  async function saveMachine(e: React.FormEvent) {
    e.preventDefault()
    if (!machine) return
    setSaving(true)
    const { error } = await createClient().from('machines').update({
      name: editForm.name, type: editForm.type,
      brand: editForm.brand || null, model: editForm.model || null,
      year: editForm.year ? Number(editForm.year) : null,
      plate: editForm.plate || null, fuel_type: editForm.fuel_type,
      engine_hp: editForm.engine_hp ? Number(editForm.engine_hp) : null,
      current_hours: editForm.current_hours ? Number(editForm.current_hours) : null,
      current_km: editForm.current_km ? Number(editForm.current_km) : null,
      vin: editForm.vin || null,
      purchase_date: editForm.purchase_date || null,
      purchase_price: editForm.purchase_price ? Number(editForm.purchase_price) : null,
      notes: editForm.notes || null,
    }).eq('id', machine.id)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success('Utilaj actualizat')
    setMachine({ ...machine, ...editForm } as Machine)
    setEditing(false)
    setSaving(false)
  }

  // ── Work logs ──────────────────────────────────────────────────────────────
  async function saveWorkLog(e: React.FormEvent) {
    e.preventDefault()
    if (!machine) return
    setSavingLog(true)
    const { data: { user: logUser } } = await createClient().auth.getUser()
    if (!logUser) { toast.error('Sesiune expirată.'); setSavingLog(false); return }
    const { error } = await createClient().from('machine_work_logs').insert({
      user_id: logUser.id,
      machine_id: machine.id,
      operator_id: logForm.operator_id || null,
      implement_id: logForm.implement_id || null,
      log_date: logForm.log_date,
      operation_type: logForm.operation_type,
      hours_worked: logForm.hours_worked ? Number(logForm.hours_worked) : null,
      area_worked_ha: logForm.area_worked_ha ? Number(logForm.area_worked_ha) : null,
      fuel_consumed_l: logForm.fuel_consumed_l ? Number(logForm.fuel_consumed_l) : null,
      start_hours: logForm.start_hours ? Number(logForm.start_hours) : null,
      end_hours: logForm.end_hours ? Number(logForm.end_hours) : null,
      notes: logForm.notes || null,
    })
    if (error) { toast.error(error.message); setSavingLog(false); return }
    toast.success('Sesiune de lucru adăugată')
    setShowAddLog(false)
    setLogForm(f => ({ ...f, notes: '', fuel_consumed_l: '', area_worked_ha: '', hours_worked: '', start_hours: '', end_hours: '' }))
    const { data } = await createClient().from('machine_work_logs')
      .select('*, operators(name), implements(name)').eq('machine_id', machine.id)
      .order('log_date', { ascending: false })
    setWorkLogs((data ?? []) as MachineWorkLog[])
    setSavingLog(false)
  }

  async function deleteWorkLog(logId: string) {
    if (!confirm('Șterge înregistrarea?')) return
    await createClient().from('machine_work_logs').delete().eq('id', logId)
    setWorkLogs(prev => prev.filter(l => l.id !== logId))
  }

  // ── Fuel logs ──────────────────────────────────────────────────────────────
  async function saveFuelLog(e: React.FormEvent) {
    e.preventDefault()
    if (!machine || !fuelForm.liters) return
    setSavingFuel(true)
    const { data: { user: fuelUser } } = await createClient().auth.getUser()
    if (!fuelUser) { toast.error('Sesiune expirată.'); setSavingFuel(false); return }
    const { error } = await createClient().from('fuel_logs').insert({
      user_id: fuelUser.id,
      machine_id: machine.id,
      log_date: fuelForm.log_date,
      liters: Number(fuelForm.liters),
      cost_per_liter: fuelForm.cost_per_liter ? Number(fuelForm.cost_per_liter) : null,
      odometer_km: fuelForm.odometer_km ? Number(fuelForm.odometer_km) : null,
      hours_meter: fuelForm.hours_meter ? Number(fuelForm.hours_meter) : null,
      location: fuelForm.location || null,
      notes: fuelForm.notes || null,
    })
    if (error) { toast.error(error.message); setSavingFuel(false); return }
    toast.success('Alimentare înregistrată')
    setShowAddFuel(false)
    setFuelForm(f => ({ ...f, liters: '', cost_per_liter: '', notes: '' }))
    const { data } = await createClient().from('fuel_logs').select('*').eq('machine_id', machine.id)
      .order('log_date', { ascending: false })
    setFuelLogs((data ?? []) as FuelLog[])
    setSavingFuel(false)
  }

  async function deleteFuelLog(logId: string) {
    if (!confirm('Șterge alimentarea?')) return
    await createClient().from('fuel_logs').delete().eq('id', logId)
    setFuelLogs(prev => prev.filter(l => l.id !== logId))
  }

  // ── Maintenance ────────────────────────────────────────────────────────────
  async function saveMaintTask(e: React.FormEvent) {
    e.preventDefault()
    if (!machine || !maintForm.title.trim()) return
    setSavingMaint(true)
    const { data: { user: maintUser } } = await createClient().auth.getUser()
    if (!maintUser) { toast.error('Sesiune expirată.'); setSavingMaint(false); return }
    const { error } = await createClient().from('maintenance_tasks').insert({
      user_id: maintUser.id,
      machine_id: machine.id,
      title: maintForm.title.trim(),
      type: maintForm.type,
      due_date: maintForm.due_date || null,
      due_hours: maintForm.due_hours ? Number(maintForm.due_hours) : null,
      due_km: maintForm.due_km ? Number(maintForm.due_km) : null,
      cost: maintForm.cost ? Number(maintForm.cost) : null,
      service_provider: maintForm.service_provider || null,
      notes: maintForm.notes || null,
    })
    if (error) { toast.error(error.message); setSavingMaint(false); return }
    toast.success('Sarcină adăugată')
    setShowAddMaint(false)
    setMaintForm({ title: '', type: 'SERVICE', due_date: '', due_hours: '', due_km: '', cost: '', service_provider: '', notes: '' })
    const { data } = await createClient().from('maintenance_tasks').select('*').eq('machine_id', machine.id)
      .order('due_date', { ascending: true, nullsFirst: false })
    setMaintTasks((data ?? []) as MaintenanceTask[])
    setSavingMaint(false)
  }

  async function completeMaintTask(task: MaintenanceTask) {
    const today = new Date().toISOString().split('T')[0]
    const { error } = await createClient().from('maintenance_tasks')
      .update({ status: 'FINALIZAT', completed_date: today }).eq('id', task.id)
    if (error) { toast.error(error.message); return }
    setMaintTasks(prev => prev.map(t =>
      t.id === task.id ? { ...t, status: 'FINALIZAT' as const, completed_date: today } : t
    ))
    toast.success('Sarcină finalizată')
  }

  async function deleteMaintTask(taskId: string) {
    if (!confirm('Șterge sarcina?')) return
    await createClient().from('maintenance_tasks').delete().eq('id', taskId)
    setMaintTasks(prev => prev.filter(t => t.id !== taskId))
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Se încarcă...
    </div>
  }
  if (!machine) return null

  const today = new Date().toISOString().split('T')[0]
  const overdueTasks = maintTasks.filter(t => t.status === 'PLANIFICAT' && t.due_date && t.due_date < today)
  const totalFuelL    = fuelLogs.reduce((s, f) => s + f.liters, 0)
  const totalFuelCost = fuelLogs.reduce((s, f) => s + (f.total_cost ?? 0), 0)
  const totalWorkHours = workLogs.reduce((s, w) => s + (w.hours_worked ?? 0), 0)
  const typeLabel = MACHINE_TYPES.find(t => t.value === machine.type)?.label ?? machine.type

  const TABS = [
    { key: 'general' as TabType,     label: 'Informații',   icon: Settings2 },
    { key: 'jurnal' as TabType,      label: 'Jurnal lucru', icon: ClipboardList },
    { key: 'combustibil' as TabType, label: 'Combustibil',  icon: Fuel },
    { key: 'mentenanta' as TabType,  label: 'Mentenanță',   icon: Wrench },
  ]

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/utilaje')}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-800">{machine.name}</h1>
          <p className="text-sm text-gray-500">
            {typeLabel}
            {machine.brand && ` · ${machine.brand}`}
            {machine.model && ` ${machine.model}`}
            {machine.year  && ` · ${machine.year}`}
            {machine.plate && ` · ${machine.plate}`}
          </p>
        </div>
        <span className={`shrink-0 px-2.5 py-1 text-xs rounded-full font-medium ${machine.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {machine.is_active ? 'Activ' : 'Inactiv'}
        </span>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-lg font-bold text-gray-800">
            {machine.current_hours != null ? `${machine.current_hours} h` : '—'}
          </div>
          <div className="text-xs text-gray-500">Ore motor curente</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-lg font-bold text-gray-800">{totalWorkHours > 0 ? `${totalWorkHours.toFixed(1)} h` : '—'}</div>
          <div className="text-xs text-gray-500">Ore lucrate (înregistrate)</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className={`text-lg font-bold ${overdueTasks.length > 0 ? 'text-red-600' : 'text-gray-800'}`}>
            {overdueTasks.length > 0 ? `${overdueTasks.length} restante` : maintTasks.filter(t => t.status === 'PLANIFICAT').length > 0 ? 'Planificate' : 'OK'}
          </div>
          <div className="text-xs text-gray-500">Mentenanță</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === t.key ? 'bg-white shadow text-brand-700 font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.key === 'mentenanta' && overdueTasks.length > 0 && (
              <span className="ml-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {overdueTasks.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Tab: General ─────────────────────────────────────────────────────── */}
      {activeTab === 'general' && (
        <form onSubmit={saveMachine} className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <span className="text-sm font-semibold text-gray-700">Fișă tehnică utilaj</span>
            {!editing ? (
              <button type="button" onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                <Pencil className="w-3.5 h-3.5" /> Editează
              </button>
            ) : (
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvează
                </button>
                <button type="button" onClick={() => { setEditing(false); setEditForm(machine) }}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {([
              { label: 'Denumire *', key: 'name', required: true },
              { label: 'Marcă', key: 'brand' },
              { label: 'Model', key: 'model' },
              { label: 'An fabricație', key: 'year', inputType: 'number' },
              { label: 'Nr. înmatriculare', key: 'plate' },
              { label: 'VIN / Număr serie', key: 'vin' },
              { label: 'Putere motor (CP)', key: 'engine_hp', inputType: 'number' },
              { label: 'Ore motor curente', key: 'current_hours', inputType: 'number' },
              { label: 'Km odometru curenți', key: 'current_km', inputType: 'number' },
              { label: 'Dată achiziție', key: 'purchase_date', inputType: 'date' },
              { label: 'Preț achiziție (RON)', key: 'purchase_price', inputType: 'number' },
            ] as { label: string; key: keyof Machine; required?: boolean; inputType?: string }[]).map(f => (
              <div key={f.key as string}>
                <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                {editing ? (
                  <input type={f.inputType ?? 'text'} required={f.required}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={(editForm as unknown as Record<string, unknown>)[f.key as string] as string ?? ''}
                    onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))} />
                ) : (
                  <div className="text-sm text-gray-800 py-0.5">
                    {(machine as unknown as Record<string, unknown>)[f.key as string] as string ?? '—'}
                  </div>
                )}
              </div>
            ))}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tip utilaj</label>
              {editing ? (
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={editForm.type ?? ''} onChange={e => setEditForm(p => ({ ...p, type: e.target.value }))}>
                  {MACHINE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              ) : <div className="text-sm text-gray-800 py-0.5">{typeLabel}</div>}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tip combustibil</label>
              {editing ? (
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={editForm.fuel_type ?? 'motorina'} onChange={e => setEditForm(p => ({ ...p, fuel_type: e.target.value }))}>
                  {['motorina', 'benzina', 'electric', 'hibrid'].map(v => <option key={v}>{v}</option>)}
                </select>
              ) : <div className="text-sm text-gray-800 capitalize py-0.5">{machine.fuel_type}</div>}
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className="block text-xs text-gray-500 mb-1">Observații</label>
              {editing ? (
                <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" rows={3}
                  value={editForm.notes ?? ''}
                  onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
              ) : <div className="text-sm text-gray-800 py-0.5">{machine.notes ?? '—'}</div>}
            </div>
          </div>
        </form>
      )}

      {/* ─── Tab: Jurnal lucru ───────────────────────────────────────────────── */}
      {activeTab === 'jurnal' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-semibold text-gray-700">Jurnal activități câmp</span>
            <button onClick={() => setShowAddLog(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">
              <Plus className="w-3.5 h-3.5" /> Sesiune nouă
            </button>
          </div>

          {showAddLog && (
            <form onSubmit={saveWorkLog} className="bg-white border border-brand-200 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dată *</label>
                  <input required type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={logForm.log_date} onChange={e => setLogForm(f => ({ ...f, log_date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Operație</label>
                  <select className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={logForm.operation_type} onChange={e => setLogForm(f => ({ ...f, operation_type: e.target.value }))}>
                    {OP_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Operator</label>
                  <select className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={logForm.operator_id} onChange={e => setLogForm(f => ({ ...f, operator_id: e.target.value }))}>
                    <option value="">— Selectează —</option>
                    {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Implement</label>
                  <select className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={logForm.implement_id} onChange={e => setLogForm(f => ({ ...f, implement_id: e.target.value }))}>
                    <option value="">— Fără implement —</option>
                    {implements_.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ore lucrate</label>
                  <input type="number" step="0.1" min="0" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="0.0" value={logForm.hours_worked} onChange={e => setLogForm(f => ({ ...f, hours_worked: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Suprafață (ha)</label>
                  <input type="number" step="0.01" min="0" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="0.00" value={logForm.area_worked_ha} onChange={e => setLogForm(f => ({ ...f, area_worked_ha: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Combustibil (L)</label>
                  <input type="number" step="0.1" min="0" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="0.0" value={logForm.fuel_consumed_l} onChange={e => setLogForm(f => ({ ...f, fuel_consumed_l: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ore contor start / end</label>
                  <div className="flex gap-1">
                    <input type="number" step="0.1" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                      placeholder="start" value={logForm.start_hours} onChange={e => setLogForm(f => ({ ...f, start_hours: e.target.value }))} />
                    <input type="number" step="0.1" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                      placeholder="end" value={logForm.end_hours} onChange={e => setLogForm(f => ({ ...f, end_hours: e.target.value }))} />
                  </div>
                </div>
                <div className="col-span-2 md:col-span-4">
                  <label className="block text-xs text-gray-500 mb-1">Observații</label>
                  <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={logForm.notes} onChange={e => setLogForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingLog}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg disabled:opacity-50">
                  {savingLog ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Salvează
                </button>
                <button type="button" onClick={() => setShowAddLog(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg">Anulează</button>
              </div>
            </form>
          )}

          {logsLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Încărcare...</div>
          ) : workLogs.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 flex items-center justify-center h-32 text-gray-400 text-sm">
              Nicio sesiune de lucru înregistrată.
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium">
                    <th className="px-4 py-2.5 text-left">Dată</th>
                    <th className="px-4 py-2.5 text-left">Operație</th>
                    <th className="px-4 py-2.5 text-left">Operator</th>
                    <th className="px-4 py-2.5 text-left">Implement</th>
                    <th className="px-4 py-2.5 text-right">Ore</th>
                    <th className="px-4 py-2.5 text-right">Suprafață</th>
                    <th className="px-4 py-2.5 text-right">Combustibil</th>
                    <th className="px-4 py-2.5 text-left">Note</th>
                    <th className="px-4 py-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {workLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{fmtDate(log.log_date)}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-medium text-gray-700">
                          {OP_TYPES.find(o => o.value === log.operation_type)?.label ?? log.operation_type ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{log.operators?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{log.implements?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{log.hours_worked != null ? `${log.hours_worked} h` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{log.area_worked_ha != null ? `${log.area_worked_ha} ha` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{log.fuel_consumed_l != null ? `${log.fuel_consumed_l} L` : '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[120px] truncate">{log.notes ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => void deleteWorkLog(log.id)} className="p-1 text-gray-300 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400 text-right">
                Total ore înregistrate: <strong className="text-gray-600">{totalWorkHours.toFixed(1)} h</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Combustibil ───────────────────────────────────────────────── */}
      {activeTab === 'combustibil' && (
        <div>
          {fuelLogs.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-xl font-bold text-gray-800">{totalFuelL.toFixed(1)} L</div>
                <div className="text-xs text-gray-500 mt-0.5">Total combustibil înregistrat</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-xl font-bold text-gray-800">{totalFuelCost > 0 ? `${totalFuelCost.toFixed(0)} RON` : '—'}</div>
                <div className="text-xs text-gray-500 mt-0.5">Cost total combustibil</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-xl font-bold text-gray-800">{fuelLogs.length}</div>
                <div className="text-xs text-gray-500 mt-0.5">Alimentări înregistrate</div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-semibold text-gray-700">Registru combustibil</span>
            <button onClick={() => setShowAddFuel(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">
              <Plus className="w-3.5 h-3.5" /> Alimentare nouă
            </button>
          </div>

          {showAddFuel && (
            <form onSubmit={saveFuelLog} className="bg-white border border-brand-200 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dată *</label>
                  <input required type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={fuelForm.log_date} onChange={e => setFuelForm(f => ({ ...f, log_date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Litri *</label>
                  <input required type="number" step="0.1" min="0.1" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="0.0" value={fuelForm.liters} onChange={e => setFuelForm(f => ({ ...f, liters: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Preț / litru (RON)</label>
                  <input type="number" step="0.01" min="0" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="0.00" value={fuelForm.cost_per_liter} onChange={e => setFuelForm(f => ({ ...f, cost_per_liter: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ore contor</label>
                  <input type="number" step="0.1" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="0.0" value={fuelForm.hours_meter} onChange={e => setFuelForm(f => ({ ...f, hours_meter: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Odometru (km)</label>
                  <input type="number" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="0" value={fuelForm.odometer_km} onChange={e => setFuelForm(f => ({ ...f, odometer_km: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Locație alimentare</label>
                  <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="ex: Depou fermă" value={fuelForm.location} onChange={e => setFuelForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Observații</label>
                  <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={fuelForm.notes} onChange={e => setFuelForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingFuel}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg disabled:opacity-50">
                  {savingFuel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Salvează
                </button>
                <button type="button" onClick={() => setShowAddFuel(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg">Anulează</button>
              </div>
            </form>
          )}

          {fuelLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Încărcare...</div>
          ) : fuelLogs.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 flex items-center justify-center h-32 text-gray-400 text-sm">
              Nicio alimentare înregistrată.
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium">
                    <th className="px-4 py-2.5 text-left">Dată</th>
                    <th className="px-4 py-2.5 text-right">Litri</th>
                    <th className="px-4 py-2.5 text-right">Preț/L</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                    <th className="px-4 py-2.5 text-right">Ore contor</th>
                    <th className="px-4 py-2.5 text-right">Km</th>
                    <th className="px-4 py-2.5 text-left">Locație</th>
                    <th className="px-4 py-2.5 text-left">Note</th>
                    <th className="px-4 py-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fuelLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{fmtDate(log.log_date)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-800">{log.liters} L</td>
                      <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{log.cost_per_liter != null ? `${log.cost_per_liter} RON` : '—'}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{log.total_cost != null ? `${log.total_cost} RON` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{log.hours_meter != null ? `${log.hours_meter} h` : '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{log.odometer_km != null ? `${log.odometer_km} km` : '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{log.location ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[100px] truncate">{log.notes ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => void deleteFuelLog(log.id)} className="p-1 text-gray-300 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Mentenanță ────────────────────────────────────────────────── */}
      {activeTab === 'mentenanta' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-semibold text-gray-700">Mentenanță & Service</span>
            <button onClick={() => setShowAddMaint(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">
              <Plus className="w-3.5 h-3.5" /> Sarcină nouă
            </button>
          </div>

          {showAddMaint && (
            <form onSubmit={saveMaintTask} className="bg-white border border-brand-200 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Titlu *</label>
                  <input required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="ex: Schimb ulei motor + filtru"
                    value={maintForm.title} onChange={e => setMaintForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tip intervenție</label>
                  <select className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={maintForm.type} onChange={e => setMaintForm(f => ({ ...f, type: e.target.value }))}>
                    {MAINT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Dată scadentă</label>
                  <input type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={maintForm.due_date} onChange={e => setMaintForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">La ore contor</label>
                  <input type="number" step="0.1" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="ex: 500" value={maintForm.due_hours} onChange={e => setMaintForm(f => ({ ...f, due_hours: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">La km odometru</label>
                  <input type="number" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="ex: 10000" value={maintForm.due_km} onChange={e => setMaintForm(f => ({ ...f, due_km: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cost estimat (RON)</label>
                  <input type="number" step="0.01" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={maintForm.cost} onChange={e => setMaintForm(f => ({ ...f, cost: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Service / Prestator</label>
                  <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={maintForm.service_provider} onChange={e => setMaintForm(f => ({ ...f, service_provider: e.target.value }))} />
                </div>
                <div className="col-span-2 md:col-span-4">
                  <label className="block text-xs text-gray-500 mb-1">Observații</label>
                  <input className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    value={maintForm.notes} onChange={e => setMaintForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingMaint}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg disabled:opacity-50">
                  {savingMaint ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Salvează
                </button>
                <button type="button" onClick={() => setShowAddMaint(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg">Anulează</button>
              </div>
            </form>
          )}

          {maintLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Încărcare...</div>
          ) : maintTasks.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 flex items-center justify-center h-32 text-gray-400 text-sm">
              Nicio sarcină de mentenanță.
            </div>
          ) : (
            <div className="space-y-2">
              {maintTasks.map(task => {
                const isOverdue = task.status === 'PLANIFICAT' && task.due_date != null && task.due_date < today
                return (
                  <div key={task.id}
                    className={`bg-white rounded-lg border p-4 ${isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {task.status === 'FINALIZAT'
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          : isOverdue
                            ? <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                            : <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                        }
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-800">{task.title}</div>
                          <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-gray-500">
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {MAINT_TYPES.find(t => t.value === task.type)?.label ?? task.type}
                            </span>
                            {task.due_date && (
                              <span>Scadent: <strong className={isOverdue ? 'text-red-600' : 'text-gray-700'}>{fmtDate(task.due_date)}</strong></span>
                            )}
                            {task.due_hours != null && <span>La {task.due_hours} h contor</span>}
                            {task.due_km   != null && <span>La {task.due_km} km</span>}
                            {task.cost     != null && <span>Cost: {task.cost} RON</span>}
                            {task.service_provider && <span>Prestator: {task.service_provider}</span>}
                            {task.completed_date && (
                              <span className="text-green-600">Finalizat: {fmtDate(task.completed_date)}</span>
                            )}
                          </div>
                          {task.notes && <div className="text-xs text-gray-400 mt-1">{task.notes}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {task.status !== 'FINALIZAT' && (
                          <button onClick={() => void completeMaintTask(task)}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100">
                            <CheckCircle2 className="w-3 h-3" /> Finalizează
                          </button>
                        )}
                        <button onClick={() => void deleteMaintTask(task.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
