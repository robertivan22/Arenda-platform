'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'
import { StatusBadge } from '@/components/data-display/StatusBadge'

type PaymentStatus = 'PENDING' | 'PAID' | 'OVERDUE'

interface Payment {
  id: string
  lessor_id: string
  lessor_name: string
  contract_id: string | null
  contract_number: string | null
  amount: number
  due_date: string
  paid_date: string | null
  status: PaymentStatus
  notes: string | null
}

interface LessorOption { id: string; display_name: string }
interface ContractOption { id: string; lessor_id: string; contract_number: string }

export default function PlatiPage() {
  const [rows, setRows] = useState<Payment[]>([])
  const [lessors, setLessors] = useState<LessorOption[]>([])
  const [contracts, setContracts] = useState<ContractOption[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ lessorId: '', contractId: '', amount: '', dueDate: '', notes: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ lessorId: '', contractId: '', amount: '', dueDate: '', notes: '', status: 'PENDING' })
  const [editSaving, setEditSaving] = useState(false)

  const reload = useCallback(async () => {
    const db = createClient()
    const { data } = await db
      .from('payments')
      .select('id, lessor_id, contract_id, contract_number, amount, due_date, paid_date, status, notes, lessors(first_name, last_name, company_name, type)')
      .order('due_date', { ascending: false })
    if (data) {
      setRows((data as any[]).map((p) => ({
        ...p,
        lessor_name: p.lessors
          ? (p.lessors.type === 'LEGAL' ? p.lessors.company_name : `${p.lessors.last_name} ${p.lessors.first_name}`.trim())
          : 'fara arendator',
      })))
    }
  }, [])

  useEffect(() => {
    const db = createClient()
    reload()
    db.from('lessors').select('id, first_name, last_name, company_name, type').order('last_name')
      .then(({ data }) => {
        if (data) setLessors((data as any[]).map((l) => ({
          id: l.id,
          display_name: l.type === 'LEGAL' ? l.company_name : `${l.last_name} ${l.first_name}`.trim(),
        })))
      })
    db.from('contracts').select('id, lessor_id, contract_number').order('contract_number')
      .then(({ data }) => { if (data) setContracts(data as ContractOption[]) })
  }, [reload])

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    const contract = contracts.find(c => c.id === form.contractId)
    const { error } = await db.from('payments').insert({
      user_id: user!.id,
      lessor_id: form.lessorId,
      contract_id: form.contractId || null,
      contract_number: contract?.contract_number || null,
      amount: parseFloat(form.amount),
      due_date: form.dueDate,
      notes: form.notes || null,
      status: 'PENDING',
    })
    setSaving(false)
    if (error) { toast.error('Eroare: ' + error.message); return }
    toast.success('Plata adaugata.')
    setShowForm(false)
    setForm({ lessorId: '', contractId: '', amount: '', dueDate: '', notes: '' })
    reload()
  }

  function startEdit(row: Payment) {
    setEditId(row.id)
    setEditForm({
      lessorId: row.lessor_id,
      contractId: row.contract_id ?? '',
      amount: String(row.amount),
      dueDate: row.due_date,
      notes: row.notes ?? '',
      status: row.status,
    })
    setShowForm(false)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editId) return
    setEditSaving(true)
    const contract = contracts.find(c => c.id === editForm.contractId)
    const { error } = await createClient().from('payments').update({
      lessor_id: editForm.lessorId,
      contract_id: editForm.contractId || null,
      contract_number: contract?.contract_number || null,
      amount: parseFloat(editForm.amount),
      due_date: editForm.dueDate,
      notes: editForm.notes || null,
      status: editForm.status as PaymentStatus,
      paid_date: editForm.status === 'PAID' ? new Date().toISOString().split('T')[0] : null,
    }).eq('id', editId)
    setEditSaving(false)
    if (error) { toast.error('Eroare: ' + error.message); return }
    toast.success('Plata actualizata.')
    setEditId(null)
    reload()
  }

  async function markPaid(id: string) {
    const { error } = await createClient().from('payments').update({
      status: 'PAID',
      paid_date: new Date().toISOString().split('T')[0],
    }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Marcata ca platita.')
    reload()
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'
  const neplatite = rows.filter(r => r.status !== 'PAID').length

  return (
    <div>
      <PageHeader
        title="Plati"
        subtitle={`${neplatite} neplatite`}
        actions={
          <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded font-medium">
            <Plus className="w-3.5 h-3.5" /> Adauga plata
          </button>
        }
      />
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Arendator *</label>
              <select className={inputCls} value={form.lessorId} onChange={e => setField('lessorId', e.target.value)} required>
                <option value="">Selectati</option>
                {lessors.map(l => <option key={l.id} value={l.id}>{l.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Contract</label>
              <select className={inputCls} value={form.contractId} onChange={e => setField('contractId', e.target.value)}>
                <option value="">Selectati</option>
                {contracts.filter(c => !form.lessorId || c.lessor_id === form.lessorId)
                  .map(c => <option key={c.id} value={c.id}>{c.contract_number}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Suma (RON) *</label>
              <input className={inputCls} type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setField('amount', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Scadenta *</label>
              <input className={inputCls} type="date" value={form.dueDate} onChange={e => setField('dueDate', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Observatii</label>
              <input className={inputCls} value={form.notes} onChange={e => setField('notes', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" disabled={saving} className="px-4 py-1.5 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Se salveaza...' : 'Salveaza'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Anuleaza</button>
          </div>
        </form>
      )}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Arendator','Contract','Suma (RON)','Scadenta','Data platii','Status','Actiuni'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Nicio plata inregistrata</td></tr>}
            {rows.map(row => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{row.lessor_name}</td>
                <td className="px-3 py-2">{row.contract_number ?? 'fara contract'}</td>
                <td className="px-3 py-2 font-semibold">{Number(row.amount).toFixed(2)}</td>
                <td className="px-3 py-2">{row.due_date}</td>
                <td className="px-3 py-2">{row.paid_date ?? 'neplatita'}</td>
                <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(row)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Editeaza"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {row.status !== 'PAID' && (
                      <button onClick={() => markPaid(row.id)} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 border border-green-300">
                        Platit
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inline edit panel */}
      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Editeaza plata</h3>
            <form onSubmit={saveEdit}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Arendator *</label>
                  <select className={inputCls} value={editForm.lessorId} onChange={e => setEditForm(p => ({ ...p, lessorId: e.target.value }))} required>
                    <option value="">Selectati</option>
                    {lessors.map(l => <option key={l.id} value={l.id}>{l.display_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Contract</label>
                  <select className={inputCls} value={editForm.contractId} onChange={e => setEditForm(p => ({ ...p, contractId: e.target.value }))}>
                    <option value="">Selectati</option>
                    {contracts.filter(c => !editForm.lessorId || c.lessor_id === editForm.lessorId)
                      .map(c => <option key={c.id} value={c.id}>{c.contract_number}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Suma (RON) *</label>
                  <input className={inputCls} type="number" min="0.01" step="0.01" value={editForm.amount} onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))} required />
                </div>
                <div>
                  <label className={labelCls}>Scadenta *</label>
                  <input className={inputCls} type="date" value={editForm.dueDate} onChange={e => setEditForm(p => ({ ...p, dueDate: e.target.value }))} required />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select className={inputCls} value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                    <option value="PENDING">In asteptare</option>
                    <option value="PAID">Platit</option>
                    <option value="OVERDUE">Restanta</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Observatii</label>
                  <input className={inputCls} value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button type="submit" disabled={editSaving} className="px-4 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50">
                  {editSaving ? 'Se salveaza...' : 'Salveaza'}
                </button>
                <button type="button" onClick={() => setEditId(null)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Anuleaza</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
