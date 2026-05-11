'use client'

export const runtime = 'edge'

import { useState, useEffect } from 'react'
import { payments, lessors, contracts, type Payment, type Lessor, type Contract } from '@/lib/mockStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { StatusBadge } from '@/components/data-display/StatusBadge'

export default function PlatiPage() {
  const [rows, setRows] = useState<Payment[]>([])
  const [lessorsList, setLessorsList] = useState<Lessor[]>([])
  const [contractsList, setContractsList] = useState<Contract[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ lessorId: '', lessorName: '', contractId: '', contractNumber: '', amount: '', dueDate: '', notes: '' })

  function reload() {
    setRows(payments.list())
    setLessorsList(lessors.list())
    setContractsList(contracts.list())
  }
  useEffect(() => { reload() }, [])

  function set(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })) }

  function handleLessorChange(id: string) {
    const l = lessorsList.find(l => l.id === id)
    setForm(prev => ({ ...prev, lessorId: id, lessorName: l?.displayName ?? '' }))
  }

  function handleContractChange(id: string) {
    const c = contractsList.find(c => c.id === id)
    setForm(prev => ({ ...prev, contractId: id, contractNumber: c?.contractNumber ?? '' }))
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    payments.create({ ...form, paidDate: '', status: 'OVERDUE' })
    toast.success('Plată adăugată.')
    setShowForm(false)
    setForm({ lessorId: '', lessorName: '', contractId: '', contractNumber: '', amount: '', dueDate: '', notes: '' })
    reload()
  }

  function markPaid(id: string) {
    payments.markPaid(id)
    toast.success('Marcată ca plătită.')
    reload()
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'

  return (
    <div>
      <PageHeader title="Plăți restante" subtitle={`${rows.filter(r=>r.status==='OVERDUE').length} restante`}
        actions={<button onClick={() => setShowForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded font-medium"><Plus className="w-3.5 h-3.5" /> Adaugă plată</button>}
      />

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Arendator</label>
              <select className={inputCls} value={form.lessorId} onChange={e => handleLessorChange(e.target.value)} required>
                <option value="">Selectați</option>
                {lessorsList.map(l => <option key={l.id} value={l.id}>{l.displayName}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Contract</label>
              <select className={inputCls} value={form.contractId} onChange={e => handleContractChange(e.target.value)}>
                <option value="">Selectați</option>
                {contractsList.filter(c => !form.lessorId || c.lessorId === form.lessorId).map(c => <option key={c.id} value={c.id}>{c.contractNumber}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Sumă (RON) *</label><input className={inputCls} type="number" value={form.amount} onChange={e => set('amount', e.target.value)} required /></div>
            <div><label className={labelCls}>Scadență *</label><input className={inputCls} type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} required /></div>
            <div><label className={labelCls}>Observații</label><input className={inputCls} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="px-4 py-1.5 bg-brand-600 text-white text-sm rounded hover:bg-brand-700">Salvează</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">Anulează</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Arendator','Contract','Sumă (RON)','Scadență','Status','Acțiuni'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Nicio plată înregistrată</td></tr>}
            {rows.map(row => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{row.lessorName}</td>
                <td className="px-3 py-2">{row.contractNumber}</td>
                <td className="px-3 py-2 font-semibold">{row.amount}</td>
                <td className="px-3 py-2">{row.dueDate}</td>
                <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                <td className="px-3 py-2">
                  {row.status !== 'PAID' && (
                    <button onClick={() => markPaid(row.id)} className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 border border-green-300">
                      Marchează plătit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
