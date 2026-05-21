'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { X, AlertTriangle, CheckCircle, Leaf } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  RegistruFitosanitar, FitosanitarFormData, TipAgent, UnitateDoza, UnitateCantitate,
  CULTURA_OPTIONS, JUDETE_ROMANIA, TIP_AGENT_LABELS, getBBCHForCultura, formatDateRO,
} from '@/lib/bbch-data'
import { BBCHSelector, BBCHChart } from './BBCHChart'

type ModalMode = 'add' | 'view' | 'correct'

interface FitosanitarModalProps {
  mode: ModalMode
  initialData?: RegistruFitosanitar
  onClose: () => void
  onSaved: () => void
}

const EMPTY_FORM: FitosanitarFormData = {
  data_tratament: '',
  cultura: 'Grâu',
  parcela_id: null,
  locul_terenului: '',
  nr_parcela: null,
  judet: null,
  bbch_code: '',
  bbch_descriere: '',
  tip_agent: 'boala',
  agent_daunare: '',
  denumire_produs: '',
  substanta_activa: null,
  nr_omologare: null,
  doza_omologata_min: null,
  doza_omologata_max: null,
  doza_folosita: 0,
  unitate_doza: 'l/ha',
  suprafata_tratata: 0,
  cantitate_utilizata: 0,
  unitate_cantitate: 'litri',
  nume_prenume_responsabil: '',
  semnatura_url: null,
  data_incepere_recoltare: null,
  phi_zile: null,
  numar_document: null,
  data_document: null,
  conditii_meteo: null,
  echipament_utilizat: null,
  observatii: null,
}

type FormErrors = Partial<Record<keyof FitosanitarFormData, string>>

// Form state uses string inputs (convert to numbers on save)
interface FormState {
  data_tratament: string
  cultura: string
  locul_terenului: string
  nr_parcela: string
  judet: string
  bbch_code: string
  bbch_descriere: string
  tip_agent: TipAgent | ''
  agent_daunare: string
  denumire_produs: string
  substanta_activa: string
  nr_omologare: string
  doza_omologata_min: string
  doza_omologata_max: string
  doza_folosita: string
  unitate_doza: UnitateDoza
  suprafata_tratata: string
  cantitate_utilizata: string
  unitate_cantitate: UnitateCantitate
  nume_prenume_responsabil: string
  data_incepere_recoltare: string
  numar_document: string
  data_document: string
  conditii_meteo: string
  echipament_utilizat: string
  observatii: string
}

function entryToFormState(e: RegistruFitosanitar): FormState {
  return {
    data_tratament: e.data_tratament ?? '',
    cultura: e.cultura ?? 'Grâu',
    locul_terenului: e.locul_terenului ?? '',
    nr_parcela: e.nr_parcela ?? '',
    judet: e.judet ?? '',
    bbch_code: e.bbch_code ?? '',
    bbch_descriere: e.bbch_descriere ?? '',
    tip_agent: e.tip_agent ?? '',
    agent_daunare: e.agent_daunare ?? '',
    denumire_produs: e.denumire_produs ?? '',
    substanta_activa: e.substanta_activa ?? '',
    nr_omologare: e.nr_omologare ?? '',
    doza_omologata_min: e.doza_omologata_min?.toString() ?? '',
    doza_omologata_max: e.doza_omologata_max?.toString() ?? '',
    doza_folosita: e.doza_folosita?.toString() ?? '',
    unitate_doza: e.unitate_doza ?? 'l/ha',
    suprafata_tratata: e.suprafata_tratata?.toString() ?? '',
    cantitate_utilizata: e.cantitate_utilizata?.toString() ?? '',
    unitate_cantitate: e.unitate_cantitate ?? 'litri',
    nume_prenume_responsabil: e.nume_prenume_responsabil ?? '',
    data_incepere_recoltare: e.data_incepere_recoltare ?? '',
    numar_document: e.numar_document ?? '',
    data_document: e.data_document ?? '',
    conditii_meteo: e.conditii_meteo ?? '',
    echipament_utilizat: e.echipament_utilizat ?? '',
    observatii: e.observatii ?? '',
  }
}

const emptyFormState: FormState = {
  data_tratament: '', cultura: 'Grâu', locul_terenului: '', nr_parcela: '', judet: '',
  bbch_code: '', bbch_descriere: '', tip_agent: '', agent_daunare: '',
  denumire_produs: '', substanta_activa: '', nr_omologare: '',
  doza_omologata_min: '', doza_omologata_max: '', doza_folosita: '', unitate_doza: 'l/ha',
  suprafata_tratata: '', cantitate_utilizata: '', unitate_cantitate: 'litri',
  nume_prenume_responsabil: '', data_incepere_recoltare: '',
  numar_document: '', data_document: '',
  conditii_meteo: '', echipament_utilizat: '', observatii: '',
}

export function FitosanitarModal({ mode, initialData, onClose, onSaved }: FitosanitarModalProps) {
  const isView = mode === 'view'
  const isCorrect = mode === 'correct'

  const [form, setForm] = useState<FormState>(
    initialData ? entryToFormState(initialData) : emptyFormState
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [saving, setSaving] = useState(false)
  const [showBBCHChart, setShowBBCHChart] = useState(false)

  // ── Derived computed values ─────────────────────────────────────────────────
  const phiZile = useMemo(() => {
    if (!form.data_incepere_recoltare || !form.data_tratament) return null
    const ms = new Date(form.data_incepere_recoltare).getTime() - new Date(form.data_tratament).getTime()
    return Math.round(ms / 86_400_000)
  }, [form.data_incepere_recoltare, form.data_tratament])

  const cantitateCalculata = useMemo(() => {
    const d = parseFloat(form.doza_folosita)
    const s = parseFloat(form.suprafata_tratata)
    if (isNaN(d) || isNaN(s) || d <= 0 || s <= 0) return null
    return +(d * s).toFixed(3)
  }, [form.doza_folosita, form.suprafata_tratata])

  const isOverDose = useMemo(() => {
    const d = parseFloat(form.doza_folosita)
    const max = parseFloat(form.doza_omologata_max)
    return !isNaN(d) && !isNaN(max) && max > 0 && d > max
  }, [form.doza_folosita, form.doza_omologata_max])

  const phiWarning = useMemo(() => {
    return phiZile !== null && phiZile <= 0
  }, [phiZile])

  function set(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const handleBBCHSelect = useCallback((code: string, descriere: string) => {
    setForm(prev => ({ ...prev, bbch_code: code, bbch_descriere: descriere }))
    setErrors(prev => ({ ...prev, bbch_code: undefined }))
  }, [])

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: FormErrors = {}
    if (!form.data_tratament) e.data_tratament = 'Data tratamentului este obligatorie.'
    if (form.data_tratament && new Date(form.data_tratament) > new Date()) {
      e.data_tratament = 'Data tratamentului nu poate fi în viitor.'
    }
    if (!form.cultura) e.cultura = 'Cultura este obligatorie.'
    if (!form.locul_terenului.trim()) e.locul_terenului = 'Locul terenului este obligatoriu.'
    if (!form.suprafata_tratata || parseFloat(form.suprafata_tratata) <= 0) {
      e.suprafata_tratata = 'Suprafața tratată trebuie să fie mai mare decât 0.'
    }
    if (!form.bbch_code) e.bbch_code = 'Fenofaza BBCH este obligatorie.'
    if (!form.tip_agent) e.tip_agent = 'Tipul agentului de dăunare este obligatoriu.'
    if (!form.agent_daunare.trim()) e.agent_daunare = 'Denumirea agentului de dăunare este obligatorie.'
    if (!form.denumire_produs.trim()) e.denumire_produs = 'Denumirea produsului PPP este obligatorie.'
    if (!form.doza_folosita || parseFloat(form.doza_folosita) <= 0) {
      e.doza_folosita = 'Doza folosită trebuie să fie mai mare decât 0.'
    }
    if (!form.cantitate_utilizata || parseFloat(form.cantitate_utilizata) <= 0) {
      e.cantitate_utilizata = 'Cantitatea utilizată trebuie să fie mai mare decât 0.'
    }
    if (!form.nume_prenume_responsabil.trim()) {
      e.nume_prenume_responsabil = 'Numele responsabilului este obligatoriu.'
    }
    if (form.data_incepere_recoltare && form.data_tratament) {
      if (new Date(form.data_incepere_recoltare) <= new Date(form.data_tratament)) {
        e.data_incepere_recoltare = 'Data recoltării trebuie să fie după data tratamentului.'
      }
    }
    // Warn if cantitate deviates >10% from auto-calc
    if (cantitateCalculata !== null) {
      const entered = parseFloat(form.cantitate_utilizata)
      const deviation = Math.abs(entered - cantitateCalculata) / cantitateCalculata
      if (!isNaN(entered) && deviation > 0.1) {
        // Not blocking, just a warning — don't add to errors
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!validate()) {
      toast.error('Vă rugăm corectați erorile din formular.')
      return
    }
    setSaving(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      toast.error('Sesiunea a expirat. Reautentificați-vă.')
      setSaving(false)
      return
    }

    const phi = phiZile

    const payload = {
      user_id: user.id,
      data_tratament: form.data_tratament,
      cultura: form.cultura,
      locul_terenului: form.locul_terenului.trim(),
      nr_parcela: form.nr_parcela.trim() || null,
      judet: form.judet || null,
      bbch_code: form.bbch_code,
      bbch_descriere: form.bbch_descriere,
      tip_agent: form.tip_agent as TipAgent,
      agent_daunare: form.agent_daunare.trim(),
      denumire_produs: form.denumire_produs.trim(),
      substanta_activa: form.substanta_activa.trim() || null,
      nr_omologare: form.nr_omologare.trim() || null,
      doza_omologata_min: form.doza_omologata_min ? parseFloat(form.doza_omologata_min) : null,
      doza_omologata_max: form.doza_omologata_max ? parseFloat(form.doza_omologata_max) : null,
      doza_folosita: parseFloat(form.doza_folosita),
      unitate_doza: form.unitate_doza,
      suprafata_tratata: parseFloat(form.suprafata_tratata),
      cantitate_utilizata: parseFloat(form.cantitate_utilizata),
      unitate_cantitate: form.unitate_cantitate,
      nume_prenume_responsabil: form.nume_prenume_responsabil.trim(),
      data_incepere_recoltare: form.data_incepere_recoltare || null,
      phi_zile: phi,
      numar_document: form.numar_document.trim() || null,
      data_document: form.data_document || null,
      conditii_meteo: form.conditii_meteo.trim() || null,
      echipament_utilizat: form.echipament_utilizat.trim() || null,
      observatii: isCorrect
        ? `Corectare a înregistrării #${initialData?.numar_inregistrare ?? '?'}. ${form.observatii}`.trim()
        : form.observatii.trim() || null,
    }

    const { error } = await db.from('registru_fitosanitar').insert(payload)
    if (error) {
      toast.error('Eroare la salvare: ' + error.message)
      setSaving(false)
      return
    }

    // If correction mode: soft-mark old entry with annotation
    if (isCorrect && initialData) {
      await db.from('registru_fitosanitar')
        .update({
          observatii: `[ÎNLOCUIT] ${initialData.observatii ?? ''}`.trim(),
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', initialData.id)
        .eq('user_id', user.id)
    }

    toast.success(isCorrect ? 'Corectare salvată ca intrare nouă.' : 'Tratament înregistrat cu succes.')
    setSaving(false)
    onSaved()
    onClose()
  }

  // ── Shared input style ──────────────────────────────────────────────────────
  const inputCls = (field: keyof FormErrors) =>
    `w-full px-2.5 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-brand-500 ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300'
    } ${isView ? 'bg-gray-50 cursor-default' : ''}`

  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'
  const errCls = 'text-xs text-red-600 mt-0.5'

  function SectionHeader({ num, title }: { num: number; title: string }) {
    return (
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
        <div className="w-6 h-6 rounded-full bg-green-700 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
          {num}
        </div>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">

          {/* Modal header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-700 flex items-center justify-center">
                <Leaf className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {isView ? 'Detalii Tratament' : isCorrect ? 'Corectare Tratament' : 'Înregistrare Tratament Nou'}
                </h2>
                {initialData && (
                  <p className="text-xs text-gray-500">
                    Nr. {initialData.numar_inregistrare} · {formatDateRO(initialData.data_tratament)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBBCHChart(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600"
              >
                📊 Referință BBCH
              </button>
              <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-200 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Correction banner */}
          {isCorrect && (
            <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                <strong>Mod corectare:</strong> Se va crea o intrare nouă. Înregistrarea originală #
                {initialData?.numar_inregistrare} va fi marcată ca înlocuită (imutabilitate legală).
              </p>
            </div>
          )}

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

            {/* ─── Section 1: Identificare ───────────────────────────────── */}
            <div>
              <SectionHeader num={1} title="Identificare Tratament" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Data tratamentului *</label>
                  <input
                    type="date"
                    value={form.data_tratament}
                    onChange={e => set('data_tratament', e.target.value)}
                    disabled={isView}
                    max={new Date().toISOString().split('T')[0]}
                    className={inputCls('data_tratament')}
                  />
                  {errors.data_tratament && <p className={errCls}>{errors.data_tratament}</p>}
                </div>
                <div>
                  <label className={labelCls}>Număr înregistrare</label>
                  <input
                    type="text"
                    value={initialData ? `#${initialData.numar_inregistrare}` : 'Auto-generat'}
                    disabled
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded bg-gray-50 text-gray-500"
                  />
                </div>
              </div>
            </div>

            {/* ─── Section 2: Cultură și Teren ───────────────────────────── */}
            <div>
              <SectionHeader num={2} title="Cultură și Teren" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Cultură *</label>
                  <select
                    value={form.cultura}
                    onChange={e => { set('cultura', e.target.value); set('bbch_code', ''); set('bbch_descriere', '') }}
                    disabled={isView}
                    className={inputCls('cultura')}
                  >
                    {CULTURA_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.cultura && <p className={errCls}>{errors.cultura}</p>}
                </div>
                <div>
                  <label className={labelCls}>Județ</label>
                  <select
                    value={form.judet ?? ''}
                    onChange={e => set('judet', e.target.value)}
                    disabled={isView}
                    className={inputCls('judet')}
                  >
                    <option value="">— Selectați —</option>
                    {JUDETE_ROMANIA.map(j => <option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Locul terenului *</label>
                  <input
                    type="text"
                    placeholder="Ex: Tarla 12, Câmpul Mare, Comuna Izvoare"
                    value={form.locul_terenului}
                    onChange={e => set('locul_terenului', e.target.value)}
                    disabled={isView}
                    className={inputCls('locul_terenului')}
                  />
                  {errors.locul_terenului && <p className={errCls}>{errors.locul_terenului}</p>}
                </div>
                <div>
                  <label className={labelCls}>Nr. parcelă</label>
                  <input
                    type="text"
                    placeholder="Ex: A/123"
                    value={form.nr_parcela ?? ''}
                    onChange={e => set('nr_parcela', e.target.value)}
                    disabled={isView}
                    className={inputCls('nr_parcela')}
                  />
                </div>
                <div>
                  <label className={labelCls}>Suprafață tratată (ha) *</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="Ex: 12.5"
                    value={form.suprafata_tratata}
                    onChange={e => set('suprafata_tratata', e.target.value)}
                    disabled={isView}
                    className={inputCls('suprafata_tratata')}
                  />
                  {errors.suprafata_tratata && <p className={errCls}>{errors.suprafata_tratata}</p>}
                </div>
              </div>
            </div>

            {/* ─── Section 3: Fenofaza BBCH ──────────────────────────────── */}
            <div>
              <SectionHeader num={3} title="Fenofaza Culturii (BBCH) *" />
              <BBCHSelector
                cultura={form.cultura}
                value={form.bbch_code}
                onChange={handleBBCHSelect}
                error={errors.bbch_code}
              />
            </div>

            {/* ─── Section 4: Agent de dăunare ───────────────────────────── */}
            <div>
              <SectionHeader num={4} title="Agentul de Dăunare" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Tip agent *</label>
                  <div className="flex gap-2 flex-wrap">
                    {(['boala', 'daunator', 'buruiana', 'mixt'] as TipAgent[]).map(t => (
                      <label key={t} className={`flex items-center gap-1.5 px-3 py-1.5 rounded border cursor-pointer text-sm transition-colors ${
                        form.tip_agent === t
                          ? 'border-green-600 bg-green-50 text-green-800'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      } ${isView ? 'cursor-default' : ''}`}>
                        <input
                          type="radio"
                          className="sr-only"
                          name="tip_agent"
                          value={t}
                          checked={form.tip_agent === t}
                          onChange={() => !isView && set('tip_agent', t)}
                          disabled={isView}
                        />
                        {TIP_AGENT_LABELS[t]}
                      </label>
                    ))}
                  </div>
                  {errors.tip_agent && <p className={errCls}>{errors.tip_agent as string}</p>}
                </div>
                <div>
                  <label className={labelCls}>Denumire agent de dăunare *</label>
                  <input
                    type="text"
                    placeholder="Ex: Fusarium graminearum, Afide, Pălămidă"
                    value={form.agent_daunare}
                    onChange={e => set('agent_daunare', e.target.value)}
                    disabled={isView}
                    className={inputCls('agent_daunare')}
                  />
                  {errors.agent_daunare && <p className={errCls}>{errors.agent_daunare}</p>}
                </div>
              </div>
            </div>

            {/* ─── Section 5: Produsul PPP ───────────────────────────────── */}
            <div>
              <SectionHeader num={5} title="Produsul de Protecție a Plantelor (PPP)" />
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls}>Denumirea produsului PPP *</label>
                  <input
                    type="text"
                    placeholder="Ex: Caramba Star, Falcon 460 EC"
                    value={form.denumire_produs}
                    onChange={e => set('denumire_produs', e.target.value)}
                    disabled={isView}
                    className={inputCls('denumire_produs')}
                  />
                  {errors.denumire_produs && <p className={errCls}>{errors.denumire_produs}</p>}
                </div>
                <div>
                  <label className={labelCls}>Substanța activă</label>
                  <input
                    type="text"
                    placeholder="Ex: Tebuconazole, Spiroxamine"
                    value={form.substanta_activa ?? ''}
                    onChange={e => set('substanta_activa', e.target.value)}
                    disabled={isView}
                    className={inputCls('substanta_activa')}
                  />
                </div>
                <div>
                  <label className={labelCls}>Nr. omologare</label>
                  <input
                    type="text"
                    placeholder="Ex: RO/0000123"
                    value={form.nr_omologare ?? ''}
                    onChange={e => set('nr_omologare', e.target.value)}
                    disabled={isView}
                    className={inputCls('nr_omologare')}
                  />
                </div>

                {/* Dose fields */}
                <div>
                  <label className={labelCls}>Doză omologată min</label>
                  <input
                    type="number" step="0.001" min="0"
                    placeholder="0.000"
                    value={form.doza_omologata_min ?? ''}
                    onChange={e => set('doza_omologata_min', e.target.value)}
                    disabled={isView}
                    className={inputCls('doza_omologata_min')}
                  />
                </div>
                <div>
                  <label className={labelCls}>Doză omologată max</label>
                  <input
                    type="number" step="0.001" min="0"
                    placeholder="0.000"
                    value={form.doza_omologata_max ?? ''}
                    onChange={e => set('doza_omologata_max', e.target.value)}
                    disabled={isView}
                    className={inputCls('doza_omologata_max')}
                  />
                </div>
                <div>
                  <label className={labelCls}>Doză folosită * </label>
                  <div className="flex gap-2">
                    <input
                      type="number" step="0.001" min="0"
                      placeholder="0.000"
                      value={form.doza_folosita}
                      onChange={e => set('doza_folosita', e.target.value)}
                      disabled={isView}
                      className={`flex-1 px-2.5 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                        errors.doza_folosita ? 'border-red-400 bg-red-50' : isOverDose ? 'border-orange-400' : 'border-gray-300'
                      }`}
                    />
                    <select
                      value={form.unitate_doza}
                      onChange={e => set('unitate_doza', e.target.value as UnitateDoza)}
                      disabled={isView}
                      className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {(['l/ha', 'kg/ha', 'g/ha', 'ml/ha'] as UnitateDoza[]).map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  {errors.doza_folosita && <p className={errCls}>{errors.doza_folosita}</p>}
                  {isOverDose && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Doza folosită depășește doza omologată maximă!
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ─── Section 6: Cantitate ──────────────────────────────────── */}
            <div>
              <SectionHeader num={6} title="Cantitate Utilizată" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Cantitate utilizată * ({form.unitate_cantitate})</label>
                  <input
                    type="number" step="0.001" min="0"
                    placeholder="0.000"
                    value={form.cantitate_utilizata}
                    onChange={e => set('cantitate_utilizata', e.target.value)}
                    disabled={isView}
                    className={inputCls('cantitate_utilizata')}
                  />
                  {errors.cantitate_utilizata && <p className={errCls}>{errors.cantitate_utilizata}</p>}
                </div>
                <div>
                  <label className={labelCls}>Unitate *</label>
                  <div className="flex gap-3">
                    {(['litri', 'kg'] as UnitateCantitate[]).map(u => (
                      <label key={u} className={`flex items-center gap-1.5 px-4 py-1.5 rounded border cursor-pointer text-sm transition-colors ${
                        form.unitate_cantitate === u
                          ? 'border-green-600 bg-green-50 text-green-800'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}>
                        <input
                          type="radio" className="sr-only"
                          name="unitate_cantitate"
                          value={u}
                          checked={form.unitate_cantitate === u}
                          onChange={() => !isView && set('unitate_cantitate', u)}
                          disabled={isView}
                        />
                        {u.charAt(0).toUpperCase() + u.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>
                {cantitateCalculata !== null && (
                  <div className="col-span-2 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                    <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800">
                      <strong>Auto-calcul:</strong> {form.doza_folosita} {form.unitate_doza} × {form.suprafata_tratata} ha ={' '}
                      <strong>{cantitateCalculata} {form.unitate_cantitate === 'litri' ? 'L' : 'kg'}</strong>.
                      {parseFloat(form.cantitate_utilizata) > 0 && Math.abs(parseFloat(form.cantitate_utilizata) - cantitateCalculata) / cantitateCalculata > 0.1 && (
                        <span className="text-orange-700"> ⚠️ Valoarea introdusă diferă cu mai mult de 10% față de calcul.</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ─── Section 7: Responsabil ───────────────────────────────── */}
            <div>
              <SectionHeader num={7} title="Persoana Responsabilă" />
              <div>
                <label className={labelCls}>Nume și prenume *</label>
                <input
                  type="text"
                  placeholder="Ex: Ionescu Mihai"
                  value={form.nume_prenume_responsabil}
                  onChange={e => set('nume_prenume_responsabil', e.target.value)}
                  disabled={isView}
                  className={inputCls('nume_prenume_responsabil')}
                />
                {errors.nume_prenume_responsabil && (
                  <p className={errCls}>{errors.nume_prenume_responsabil}</p>
                )}
              </div>
            </div>

            {/* ─── Section 8: Recoltare și Documente ───────────────────── */}
            <div>
              <SectionHeader num={8} title="Recoltare și Documente" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Data începerii recoltării</label>
                  <input
                    type="date"
                    value={form.data_incepere_recoltare ?? ''}
                    onChange={e => set('data_incepere_recoltare', e.target.value)}
                    disabled={isView}
                    className={inputCls('data_incepere_recoltare')}
                  />
                  {errors.data_incepere_recoltare && (
                    <p className={errCls}>{errors.data_incepere_recoltare}</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>PHI — Interval Pauză Pre-Recoltare</label>
                  <div className={`px-2.5 py-1.5 text-sm border rounded ${
                    phiZile === null ? 'bg-gray-50 text-gray-400 border-gray-200'
                      : phiWarning ? 'bg-red-50 text-red-700 border-red-300'
                      : 'bg-green-50 text-green-800 border-green-300'
                  }`}>
                    {phiZile === null
                      ? '— (completați datele de mai sus)'
                      : phiWarning
                        ? `⚠️ ${phiZile} zile — recoltare ÎNAINTE de tratament!`
                        : `✓ ${phiZile} zile`}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Nr. document dare în consum</label>
                  <input
                    type="text"
                    placeholder="Ex: DC/2025/001"
                    value={form.numar_document ?? ''}
                    onChange={e => set('numar_document', e.target.value)}
                    disabled={isView}
                    className={inputCls('numar_document')}
                  />
                </div>
                <div>
                  <label className={labelCls}>Data documentului</label>
                  <input
                    type="date"
                    value={form.data_document ?? ''}
                    onChange={e => set('data_document', e.target.value)}
                    disabled={isView}
                    className={inputCls('data_document')}
                  />
                </div>
              </div>
            </div>

            {/* ─── Section 9: Informații suplimentare ───────────────────── */}
            <div>
              <SectionHeader num={9} title="Informații Suplimentare (Opțional)" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Condiții meteo la aplicare</label>
                  <input
                    type="text"
                    placeholder="Ex: Parțial noros, 18°C, vânt slab"
                    value={form.conditii_meteo ?? ''}
                    onChange={e => set('conditii_meteo', e.target.value)}
                    disabled={isView}
                    className={inputCls('conditii_meteo')}
                  />
                </div>
                <div>
                  <label className={labelCls}>Echipament utilizat</label>
                  <input
                    type="text"
                    placeholder="Ex: Pulverizator autopropulsat 3000 L"
                    value={form.echipament_utilizat ?? ''}
                    onChange={e => set('echipament_utilizat', e.target.value)}
                    disabled={isView}
                    className={inputCls('echipament_utilizat')}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Observații</label>
                  <textarea
                    rows={3}
                    placeholder="Observații suplimentare..."
                    value={form.observatii ?? ''}
                    onChange={e => set('observatii', e.target.value)}
                    disabled={isView}
                    className={`${inputCls('observatii')} resize-none`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer buttons */}
          {!isView && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <p className="text-xs text-gray-500">
                * Câmpuri obligatorii · Înregistrările sunt imutabile (OG 4/1995)
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
                >
                  Anulează
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded font-medium disabled:opacity-60"
                >
                  {saving ? 'Se salvează...' : isCorrect ? 'Salvează Corectare' : 'Înregistrează Tratament'}
                </button>
              </div>
            </div>
          )}
          {isView && (
            <div className="flex justify-end px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
              >
                Închide
              </button>
            </div>
          )}
        </div>
      </div>

      {/* BBCH Chart overlay */}
      {showBBCHChart && (
        <>
          <div className="fixed inset-0 bg-black/30 z-60" onClick={() => setShowBBCHChart(false)} />
          <div className="fixed inset-4 z-70 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <BBCHChart
              initialCultura={form.cultura}
              highlightCode={form.bbch_code}
              onSelectCode={(code, descriere) => {
                handleBBCHSelect(code, descriere)
                setShowBBCHChart(false)
              }}
              onClose={() => setShowBBCHChart(false)}
            />
          </div>
        </>
      )}
    </>
  )
}
