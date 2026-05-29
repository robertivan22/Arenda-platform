'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { AlertTriangle, FileSpreadsheet, Download, Check, FileCode, ShieldCheck, ShieldAlert, XCircle, Loader2, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { validateD112, buildD112ValidationInput, type VMsg } from '@/lib/d112Validator'


interface PayerInfo {
  cif: string; den: string; caen: string; casaAng: string
  numeDeclar: string; prenumeDeclar: string; functieDeclar: string
}

// CompanySettings shape loaded from DB
interface CS {
  name?: string; cif?: string; reg_com?: string
  address?: string; county?: string; locality?: string
  phone?: string; email?: string
  d112_caen?: string; d112_casa_ang?: string; d112_fax_soc?: string
  d112_adr_fisc?: string; d112_tel_fisc?: string; d112_fax_fisc?: string; d112_mail_fisc?: string
  d112_tip_rec?: number; d112_d_rec?: number
  d112_nume_declar?: string; d112_prenume_declar?: string; d112_functie_declar?: string
}

function buildAdrSoc(cs: CS): string {
  return [cs.address, cs.locality, cs.county].filter(Boolean).join(', ')
}

function buildPayer(cs: CS): PayerInfo {
  return {
    cif: cs.cif ?? '',
    den: cs.name ?? '',
    caen: cs.d112_caen ?? '0111',
    casaAng: cs.d112_casa_ang ?? 'IS',
    numeDeclar: cs.d112_nume_declar ?? '',
    prenumeDeclar: cs.d112_prenume_declar ?? '',
    functieDeclar: cs.d112_functie_declar ?? 'Administrator',
  }
}

const MISSING_REQUIRED: { key: keyof CS; label: string }[] = [
  { key: 'cif',                label: 'CIF firmă (tab Date firmă în Setări)' },
  { key: 'name',               label: 'Denumire firmă (tab Date firmă în Setări)' },
  { key: 'address',            label: 'Adresă sediu (tab Date firmă în Setări)' },
  { key: 'd112_caen',          label: 'Cod CAEN (tab Date Declarație 112)' },
  { key: 'd112_casa_ang',      label: 'Casa asig. sănătate (tab Date Declarație 112)' },
  { key: 'd112_nume_declar',   label: 'Nume declarant (tab Date Declarație 112)' },
  { key: 'd112_prenume_declar',label: 'Prenume declarant (tab Date Declarație 112)' },
]

const MONTHS = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
]

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

interface D112Row {
  lessorCnp: string
  lessorLastName: string
  lessorFirstName: string
  contractId: string
  paymentType: string
  grossAmountRon: number
  flatDeductionRon: number
  netTaxableRon: number
  withholdingTaxRon: number
  warnings: string[]
  isComplete: boolean
  legalBasis: string
}

interface D112Dataset {
  periodYear: number
  periodMonth: number
  rows: D112Row[]
  totalGrossRon: number
  totalWithholdingTaxRon: number
  rowsWithWarnings: number
  rowsIncomplete: number
  applicabilityNotes: string[]
  warnings: string[]
  generatedAt: string
  status: 'DRAFT'
  requiresAccountantReview: true
}

function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate() }

function pad2(n: number) { return String(n).padStart(2, '0') }

function escXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default function D112Page() {
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth === 1 ? 12 : currentMonth - 1)
  const [loading, setLoading] = useState(false)
  const [dataset, setDataset] = useState<D112Dataset | null>(null)
  const [cs, setCs] = useState<CS | null>(null)
  const [settingsMissing, setSettingsMissing] = useState<string[]>([])
  const [validationMsgs, setValidationMsgs] = useState<VMsg[] | null>(null)
  const [validating, setValidating] = useState(false)

  // Load company settings from DB
  useEffect(() => {
    const db = createClient()
    db.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data, error } = await db.from('company_settings').select('*').eq('user_id', user.id).maybeSingle()
      if (error) { toast.error('Eroare la încărcarea setărilor.'); return }
      if (data) {
        setCs(data as CS)
        const missing = MISSING_REQUIRED
          .filter(({ key }) => !((data as any)[key]?.toString().trim()))
          .map(({ label }) => label)
        setSettingsMissing(missing)
      } else {
        setSettingsMissing(['Completează Date firmă și Date Declarație 112 în Setări'])
      }
    })
  }, [])

  async function generate() {
    setLoading(true)
    setDataset(null)
    try {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) throw new Error('Neautentificat.')
      const { data: { session } } = await createClient().auth.getSession()
      const token = session?.access_token ?? ''
      const res = await fetch('/api/d112', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ year, month }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Eroare la generare D112.')
      setDataset(json.dataset)
      toast.success(`D112 generat — ${json.dataset.rows.length} înregistrări.`)
    } catch (e: any) {
      toast.error(e.message ?? 'Eroare la generare D112.')
    } finally {
      setLoading(false)
    }
  }

  function runValidation() {
    if (!dataset || !cs) return
    setValidating(true)
    try {
      const payer = buildPayer(cs)
      const input = buildD112ValidationInput(dataset, payer)
      const msgs = validateD112(input)
      setValidationMsgs(msgs)
      const errors = msgs.filter(m => m.level === 'ERR').length
      const warns = msgs.filter(m => m.level === 'ATT').length
      if (errors === 0) toast.success(`Validare completa — ${warns} avertizari, nicio eroare fatala.`)
      else toast.error(`Validare: ${errors} erori fatale (ERR). Fisierul XML nu va fi acceptat de ANAF.`)
    } finally {
      setValidating(false)
    }
  }

  function downloadCsv() {
    if (!dataset) return
    const headers = ['CNP', 'Nume', 'Prenume', 'Contract', 'Tip plată', 'Brut (RON)', 'Deducere (RON)', 'Bază impozabilă (RON)', 'Impozit reținut (RON)', 'Complet', 'Avertizări']
    const rows = dataset.rows.map(r => [
      r.lessorCnp, r.lessorLastName, r.lessorFirstName,
      r.contractId, r.paymentType,
      r.grossAmountRon, r.flatDeductionRon, r.netTaxableRon, r.withholdingTaxRon,
      r.isComplete ? 'DA' : 'NU',
      r.warnings.join(' | '),
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `D112_${dataset.periodYear}_${String(dataset.periodMonth).padStart(2, '0')}_DRAFT.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function downloadXml() {
    if (!dataset || !cs) { toast.error('Date firma lipsa. Configureaza in Setari.'); return }
    const NZC = daysInMonth(dataset.periodYear, dataset.periodMonth)
    const firstDay = `${pad2(1)}.${pad2(dataset.periodMonth)}.${dataset.periodYear}`
    const lastDay = `${pad2(NZC)}.${pad2(dataset.periodMonth)}.${dataset.periodYear}`

    const byLessor = new Map<string, { last: string; first: string; brut: number; netTax: number; impozit: number }>()
    for (const r of dataset.rows) {
      const key = r.lessorCnp || `NECNP_${r.lessorLastName}`
      const ex = byLessor.get(key)
      if (ex) { ex.brut += r.grossAmountRon; ex.netTax += r.netTaxableRon; ex.impozit += r.withholdingTaxRon }
      else byLessor.set(key, { last: r.lessorLastName, first: r.lessorFirstName, brut: r.grossAmountRon, netTax: r.netTaxableRon, impozit: r.withholdingTaxRon })
    }

    const totalImpozit = Math.round(dataset.totalWithholdingTaxRon)
    const adrSoc = buildAdrSoc(cs)
    const adrFisc = cs.d112_adr_fisc?.trim() || adrSoc
    const casaAng = escXml(cs.d112_casa_ang ?? 'IS')
    const telFisc = escXml((cs.d112_tel_fisc?.trim() || cs.phone) ?? '')
    const faxFisc = escXml(cs.d112_fax_fisc ?? '')
    const mailFisc = escXml((cs.d112_mail_fisc?.trim() || cs.email) ?? '')
    const caen = escXml(cs.d112_caen ?? '0111')

    const entries = [...byLessor.entries()]
    let idCounter = 1

    // ── D112 submission elements (angajator / asigurat) ───────────────────
    const d112Asigurati = entries.map(([cnp, d]) => {
      const brut = Math.round(d.brut); const impozit = Math.round(d.impozit)
      const netTax = Math.round(d.brut - d.impozit)
      const idAsig = String(idCounter++).padStart(6, '0')
      return `  <asigurat idAsig="${idAsig}" cnpAsig="${escXml(cnp)}" numeAsig="${escXml(d.last.toUpperCase())}" prenAsig="${escXml(d.first.toUpperCase())}" dataAng="${firstDay}" dataSf="${lastDay}" casaSn="${casaAng}" asigCI="2" asigSO="2" Timp_E3="${impozit}">
    <asiguratC C_1="26" C_2="${NZC}" C_19="${brut}" C_8="0" C_9="0"/>
    <asiguratE3 E3_1="C" E3_2="26" E3_3="3" E3_4="P" E3_8="${brut}" E3_9="0" E3_14="${brut}" E3_15="${impozit}" E3_16="${netTax}"/>
  </asigurat>`
    }).join('\n')

    // ── XFA form fields per asigurat (sbfrmPage1Asig) ────────────────────
    idCounter = 1
    const xfaAsigurati = entries.map(([cnp, d]) => {
      const brut = Math.round(d.brut); const impozit = Math.round(d.impozit)
      const netTax = Math.round(d.brut - d.impozit); const id = idCounter++
      return `<sbfrmAntetAsig xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:dataNode="dataGroup"/>
<sbfrmPage1Asig>
<sfmDateIdentif>
<asigScu_rez/><an_r>${dataset.periodYear}</an_r><luna_r>${dataset.periodMonth}</luna_r>
<cnp_asig>${escXml(cnp)}</cnp_asig><Cnp_ant/><idAsig>${id}</idAsig>
<Asig_so>2</Asig_so><Asig_ci>2</Asig_ci><Casa_sn>${casaAng}</Casa_sn>
<Data_sf>${lastDay}</Data_sf><Data_ang>${firstDay}</Data_ang>
<Pre_ant/><Nume_ant/><Pren_asig>${escXml(d.first.toUpperCase())}</Pren_asig><Nume_asig>${escXml(d.last.toUpperCase())}</Nume_asig>
<cis_asig/><asigScu/><motivExc/><bifa_plataNerezident>0</bifa_plataNerezident>
<bifa_Ucraina>0</bifa_Ucraina><asigExc>0</asigExc><bifa_IE>0</bifa_IE><Exc7/>
</sfmDateIdentif>
<det1><det2><stat_detasat/><cif_detasat/><bifa_UE>0</bifa_UE><bifa_altstat>0</bifa_altstat><acord_NU>0</acord_NU><acord_DA>0</acord_DA><dataD2/><dataD1/><tfNrCrt>1</tfNrCrt><detasat/><plata3>0</plata3><plata4>0</plata4></det2><plata_CAS>0</plata_CAS><plata_CASS>0</plata_CASS><plata_CAM>0</plata_CAM></det1>
<coAsig><cnpParinte2/><prenSot/><numeSot/><cnpSot/><prenParinte2/><numeParinte2/><prenParinte1/><numeParinte1/><cnpParinte1/></coAsig>
<sfmButoane><rbl2><rbC/><rbB/><rbA/></rbl2><tfNZL/><flag1>invisible</flag1><sal1>4050</sal1><rbl/><sal3>4582</sal3><flag/><sal2>4300</sal2><Sdimin>300</Sdimin></sfmButoane>
<sbfrmSectiuneaA><calc_aut>1</calc_aut><A_1>1</A_1><VB_A>0</VB_A><tichete1_A>0</tichete1_A><tichete2_A>0</tichete2_A><tichete3_A>0</tichete3_A><A_sal1>0</A_sal1><A_sal2>0</A_sal2><A_2>0</A_2><A_3>N</A_3><A_4>8</A_4><A_6/><A_7/><A_8/><A_8n/><sel1>Ati selectat asigExc = &apos;0-nu e cazul&apos; si bifa_IE = 0</sel1><A_13>0</A_13><A_14>0</A_14><A_13P>0</A_13P><A_14P>0</A_14P><A_13S>0</A_13S><A_13C>0</A_13C><A_11>0</A_11><A_12>0</A_12><A_11P>0</A_11P><A_12P>0</A_12P><A_12D/><A_14D/><PT1/><A_5>0</A_5><A_9>0</A_9></sbfrmSectiuneaA>
<sbfrmSectiuneaB><calc_aut>1</calc_aut><sbfrmSectiuneaB1rep><sbfrmSectiuneaB1><tfNrCrt>1</tfNrCrt><B1_1>1</B1_1><VB_B>0</VB_B><tichete1_B>0</tichete1_B><tichete2_B>0</tichete2_B><tichete3_B>0</tichete3_B><B1_sal1>0</B1_sal1><B1_sal2>0</B1_sal2><B1_2>0</B1_2><B1_3>N</B1_3><B1_4>8</B1_4><B1_6/><B1_7/><B1_8>0</B1_8><B1_15>0</B1_15><B1_15n/><B1_9>0</B1_9><B1_5>0</B1_5><B1_10>0</B1_10><B1_16/><B1_18>0</B1_18><B1_17/><adaug xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:dataNode="dataGroup"/></sbfrmSectiuneaB1></sbfrmSectiuneaB1rep><SbfrmSectiuneaB2><B2_1/><B2_2>0</B2_2><B2_3>0</B2_3><B2_4>0</B2_4><B2_5>0</B2_5><B2_5P>0</B2_5P><B2_5S>0</B2_5S><B2_5C>0</B2_5C><B2_6>0</B2_6><B2_6P>0</B2_6P><B2_6S>0</B2_6S><B2_6C>0</B2_6C><B2_7>0</B2_7><B2_7P>0</B2_7P><B2_7S>0</B2_7S><B2_7C>0</B2_7C></SbfrmSectiuneaB2><sbfrmSectiuneaB3><B3_1>0</B3_1><B3_2>0</B3_2><B3_3>0</B3_3><B3_6>0</B3_6><B3_6a>0</B3_6a><B3_8>0</B3_8><B3_4>0</B3_4><B3_5>0</B3_5><B3_7>0</B3_7><B3_7S/><B3_7C>0</B3_7C><B3_10>0</B3_10><B3_9>0</B3_9><B3_11>0</B3_11><B3_12>0</B3_12><B3_13>0</B3_13><B3_CMS>0</B3_CMS></sbfrmSectiuneaB3><sbfrmSectiuneaB4><sel1>Ati selectat asigExc = &apos;0-nu e cazul&apos; si bifa_IE = 0</sel1><B4_1>0</B4_1><B4_2>0</B4_2><B4_1n>0</B4_1n><B4_aj1>0</B4_aj1><B4_5>0</B4_5><B4_6>0</B4_6><B4_aj2>0</B4_aj2><B4_aj3>0</B4_aj3><B4_aj4>0</B4_aj4><B4_aj5>0</B4_aj5><B4_7>0</B4_7><B4_8>0</B4_8><B4_29/><B4_30/><B4_21/><B4_25/><B4_22>0</B4_22><B4_26>0</B4_26><B4_7P>0</B4_7P><B4_8P>0</B4_8P><B4_23/><B4_27/><B4_18>0</B4_18><B4_20>0</B4_20><B4_17>0</B4_17><B4_19>0</B4_19><B4_24>0</B4_24><B4_28>0</B4_28><B4_5P>0</B4_5P><B4_6P>0</B4_6P><B4_7S>0</B4_7S><B4_5S/><tip_8P/><B4_7C/><B4_8D/><PT1/><B4_6D/><B4_14>0</B4_14></sbfrmSectiuneaB4></sbfrmSectiuneaB>
<sbfrmSectiuneaC><SectiuneaC><ID_C>1</ID_C><C_1>26</C_1><C_2>${NZC}</C_2><C_5>0</C_5><C_3>0</C_3><C_17>0</C_17><C_19>${brut}</C_19><C_4>0</C_4><C_18>0</C_18><C_8>0</C_8><C_9>0</C_9><C_10>0</C_10><C_11>0</C_11><C_25>0</C_25><C_26>0</C_26><C_27>0</C_27><C_28>0</C_28><C_29>0</C_29></SectiuneaC></sbfrmSectiuneaC>
<secDE xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:dataNode="dataGroup"/>
<vezi_D xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:dataNode="dataGroup"/>
<sbfrmSectiuneaD><sbfrmSectiuneaDrep><tfNrCrt>1</tfNrCrt><Data_CMI/><D_1/><D_2/><D_3/><D_4/><D_5/><D_6/><D_7/><D_8/><D_8a/><D_9/><D_9a>0</D_9a><D_10/><D_11/><D_12/><D_13/><D_14>0</D_14><D_15>0</D_15><D_16>0</D_16><D_17>0</D_17><D_18>0</D_18><D_19/><D_20>0</D_20><D_20a/><D_21>0</D_21><D_21a/><D_23/><D_24>0</D_24><D_25>0</D_25><D_26>0</D_26><D_27>0</D_27><D_28/></sbfrmSectiuneaDrep></sbfrmSectiuneaD>
<sbfrmSectiuneaE><E1_1>0</E1_1><E1_2>0</E1_2><E1_3>0</E1_3><E1_4>0</E1_4><E1_41>0</E1_41><E1_42>0</E1_42><E1_421>0</E1_421><E1_422>0</E1_422><E1_5>0</E1_5><E1_6>0</E1_6><E1_7>0</E1_7><E2_1>0</E2_1><E2_2>0</E2_2><E2_3>0</E2_3><E2_4>0</E2_4>
<sbfrmSectiuneaE3><ID_E>1</ID_E><E3_1>C</E3_1><E3_2>26</E3_2><E3_3>3</E3_3><E3_4>P</E3_4><E3_5/><E3_6/><E3_80/><E3_81/><E3_82/><E3_83/><E3_92/><E3_93/><E3_45/><E3_46/><E3_47/><E3_48/><E3_49/><E3_7/><E3_8>${brut}</E3_8><E3_61/><E3_96/><E3_59/><E3_52/><E3_53/><E3_54/><E3_55/><E3_85/><E3_56/><E3_60/><E3_10/><E3_72/><E3_73/><E3_74/><E3_75/><E3_57/><E3_58/><E3_44/><E3_69/><E3_86/><E3_87/><E3_62/><E3_63/><E3_64/><E3_65/><E3_88/><E3_66/><E3_90/><E3_91/><E3_77/><E3_78/><E3_68/><E3_67/><E3_71/><E3_79/><E3_94/><E3_95/><E3_9>0</E3_9><E3_20/><E3_70/><E3_23/><E3_24/><E3_27/><E3_28/><E3_19/><E3_31/><E3_11/><E3_12>0</E3_12><E3_121>0</E3_121><E3_122>0</E3_122><E3_1221>0</E3_1221><E3_1222>0</E3_1222><E3_13/><E3_14>${brut}</E3_14><E3_15>${impozit}</E3_15><E3_16>${netTax}</E3_16><adaug xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:dataNode="dataGroup"/><E3_40/><E3_39/><E3_38/><E3_37/></sbfrmSectiuneaE3>
<sbfrmSectiuneaE4_ab><ID_E4>1</ID_E4><cnp_ctr/><nr_ctr/><data_ctr/><cota_ctr>0</cota_ctr><suma_ctr>0</suma_ctr><den/><cui/><cota>0</cota><suma>0</suma><adaug xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:dataNode="dataGroup"/></sbfrmSectiuneaE4_ab>
<sbfrmSectiuneaE4_c><Tcota>0.00</Tcota><Tsuma>0</Tsuma><Timp>0</Timp></sbfrmSectiuneaE4_c></sbfrmSectiuneaE>
<sbfrmAllPlus xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:dataNode="dataGroup"/>
</sbfrmPage1Asig>`
    }).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<declaratieUnica xmlns="mfp:anaf:dgti:declaratie_unica:declaratie:v6" luna_r="${dataset.periodMonth}" an_r="${dataset.periodYear}" d_rec="${cs.d112_tip_rec ?? 0}"${(cs.d112_d_rec && cs.d112_d_rec > 0) ? ` tip_rec="${cs.d112_d_rec}"` : ''} nume_declar="${escXml(cs.d112_nume_declar ?? 'NEDEFINIT')}" prenume_declar="${escXml(cs.d112_prenume_declar ?? 'NEDEFINIT')}" functie_declar="${escXml(cs.d112_functie_declar ?? 'Administrator')}">
<angajator cif="${escXml(cs.cif ?? '')}" rgCom="${escXml(cs.reg_com ?? '')}" caen="${caen}" den="${escXml(cs.name ?? '')}" adrSoc="${escXml(adrSoc)}" telSoc="${escXml(cs.phone ?? '')}" faxSoc="${escXml(cs.d112_fax_soc ?? '')}" mailSoc="${escXml(cs.email ?? '')}" adrFisc="${escXml(adrFisc)}" telFisc="${telFisc}" faxFisc="${faxFisc}" mailFisc="${mailFisc}" casaAng="${casaAng}" datCAM="0" bifa_CAM="0" totalPlata_A="${totalImpozit}">
<angajatorA A_codBugetar="5503110" A_codOblig="619" A_datorat="${totalImpozit}" A_deductibil="0" A_scutit="0" A_plata="${totalImpozit}"/>
</angajator>
${d112Asigurati}
<sbfrmAntetAng xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:dataNode="dataGroup"/>
<sbfrmPage1Ang>
<sfmIdentif>
<den>${escXml(cs.name ?? '')}</den><adrFisc>${escXml(adrFisc)}</adrFisc><telFisc>${telFisc}</telFisc><faxFisc>${faxFisc}</faxFisc><mailFisc>${mailFisc}</mailFisc><tRisc>0.000</tRisc><caen1>${caen}</caen1><cif>${escXml(cs.cif ?? '')}</cif><Bifa_FdGar>1</Bifa_FdGar><datCAM>0</datCAM><Bifa_UM>0</Bifa_UM><art90>0</art90><cifS/><RO/><data1/><data2/><d_caen>1</d_caen><caen>${caen}</caen>
</sfmIdentif>
<calcule1/>
<Salt xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:dataNode="dataGroup"/>
<sfmSectAEtich xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:dataNode="dataGroup"/>
<sfmSectAVal><nrcrt>1</nrcrt><A_codOblig>619</A_codOblig><codbuget>5503110</codbuget><a_datorat>${totalImpozit}</a_datorat><a_deductibil>0</a_deductibil><a_scutit>0</a_scutit><a_plata>${totalImpozit}</a_plata></sfmSectAVal>
<sfmSectATotal><totalPlata_A>${totalImpozit}</totalPlata_A></sfmSectATotal>
<sbfrmPrezenta><Salt1 xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:dataNode="dataGroup"/></sbfrmPrezenta>
<sbfrMesajFooter xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:dataNode="dataGroup"/>
<sbfrmFooter><Nr_inreg/><Data_inreg/></sbfrmFooter>
<sfmAnexa12 xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:dataNode="dataGroup"/>
<sfmIdentif2><rgCom>${escXml(cs.reg_com ?? '')}</rgCom><adrSoc>${escXml(adrSoc)}</adrSoc><telSoc>${escXml(cs.phone ?? '')}</telSoc><faxSoc>${escXml(cs.d112_fax_soc ?? '')}</faxSoc><mailSoc>${escXml(cs.email ?? '')}</mailSoc><casaAng>${casaAng}</casaAng><tRisc>0.000</tRisc><datCAM>0</datCAM></sfmIdentif2>
<sfmSectB><B_cnp/><B_sanatate/><B_pensie/><B1_brut_salarii/><B_sal/><T1/><T2/><T3/><T4/><nrSal1_111/><nrSal2_111/><bazaCAS_111/><CAS_111/><nrSal3_111/></sfmSectB>
<sbfrmSectiuneaC><sfmSectC1><c1_11/><c1_21/><c1_31/><c1_T1/><c1_12/><c1_22/><c1_32/><c1_T2/><c1_5/><c1_7/><c1_T/><c1_33/><c1_23/><c1_13/><c1_T3/></sfmSectC1><sfmSectC2><c2_11/><c2_12/><c2_13/><c2_14/><c2_15/><c2_16/><c2_10/><c2_140/><c2_T6/><c2_56/><c2_54/><c2_52/><c2_51/><c2_111/><c2_112/><c2_113/><c2_114/><c2_115/><c2_116/><c2_46/><c2_44/><c2_42/><c2_41/><c2_46a/><c2_44a/><c2_42a/><c2_41a/><c2_32/><c2_36/><c2_34/><c2_31/><c2_216/><c2_215/><c2_214/><c2_213/><c2_212/><c2_211/><c2_26/><c2_25/><c2_24/><c2_23/><c2_22/><c2_21/><c2_126/><c2_125/><c2_124/><c2_123/><c2_122/><c2_121/><c2_131/><c2_136/><c2_135/><c2_134/><c2_133/><c2_132/><c2_142/><c2_146/><c2_145/><c2_144/><c2_143/><c2_141/><tt/><tt/><tt/><tt/><c2_155/><c2_156/></sfmSectC2><sbfrmC345><c3_Suma>0</c3_Suma><c3_Total>0</c3_Total><c3_44/><c3_43/><c3_42/><c3_41/><c3_24/><c3_23/><c3_22/><c3_21/><c3_11/><c3_12/><c3_13/><c3_14/><c3_33/><c3_34/><c3_32/><c3_31/><C4_baza/><C4_ct/></sbfrmC345></sbfrmSectiuneaC>
<sbfrmSectiuneaD><D2/><D3/></sbfrmSectiuneaD>
<sbfrmSectiuneaE><E1_venit/><E1_baza/><E2_11/><E2_12/><E2_14/><E2_16/><E2_21/><E2_22/><E2_24/><E2_26/><E2_41/><E2_42/><E2_44/><E2_46/><E2_51/><E2_52/><E2_54/><E2_56/><E2_66>0</E2_66><E3_11/><E3_21/><E3_31/><E3_41/><E3_12/><E3_22/><E3_32/><E3_42/><E3_13/><E3_23/><E3_33/><E3_43/><E3_total>0</E3_total><E3_14/><E3_24/><E3_34/><E3_44/><E3_suma>0</E3_suma><E2_140/><E2_10/><E2_111/><E2_112/><E2_114/><E2_116/><E2_36/><E2_34/><E2_32/><E2_31/><E2_216/><E2_214/><E2_212/><E2_211/><E2_46a/><E2_44a/><E2_42a/><E2_41a/><E2_146/><E2_144/><E2_142/><E2_141/><E2_136/><E2_134/><E2_132/><E2_131/><E2_126/><E2_124/><E2_122/><E2_121/><E2_151/><E2_152/><E2_154/><E2_156/></sbfrmSectiuneaE>
<sbfrmSectiuneaF><sbfrmF1><F12_suma>0</F12_suma><F12_suma_ded>0</F12_suma_ded><F12_suma_scut>0</F12_suma_scut><F12_deplata>0</F12_deplata><F1_deplata>0</F1_deplata><F1_suma_scut>0</F1_suma_scut><F1_suma_ded>0</F1_suma_ded><F1_suma>0</F1_suma></sbfrmF1><sbfrmF2 xmlns:xfa="http://www.xfa.org/schema/xfa-data/1.0/" xfa:dataNode="dataGroup"/><sbfrmF2btn><tot_F2_suma>0</tot_F2_suma><tot_F2_suma_ded>0</tot_F2_suma_ded><tot_F2_suma_scut>0</tot_F2_suma_scut><tot_F2_deplata>0</tot_F2_deplata></sbfrmF2btn></sbfrmSectiuneaF>
</sbfrmPage1Ang>
${xfaAsigurati}
<Variabile><tfNZL/><tfNZC>${NZC}</tfNZC></Variabile>
<universalCode>D112_A7.2.5</universalCode>
<sbfrmddl><ddl/></sbfrmddl>
</declaratieUnica>`

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `D112_${dataset.periodYear}_${String(dataset.periodMonth).padStart(2, '0')}_DRAFT.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputCls = 'px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="D112 — Impozit retinut la sursa"
        subtitle="Set de date orientativ pentru pregatirea D112 (DRAFT — necesita validare contabil)"
      />

      <div className="mb-4 flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
        <span>
          <strong>DRAFT</strong> — Sistemul genereaza un set de date orientativ. Folositi software-ul oficial
          ANAF D112 pentru transmitere. Nu trimiteti date la ANAF direct din acest sistem.
        </span>
      </div>

      {/* Settings warning / info strip */}
      {settingsMissing.length > 0 ? (
        <div className="mb-4 flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
          <div>
            <p className="font-semibold mb-1">Date firma incomplete — XML-ul nu va fi generat corect</p>
            <ul className="list-disc list-inside text-xs space-y-0.5">
              {settingsMissing.map(m => <li key={m}>{m}</li>)}
            </ul>
            <Link href="/setari" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline">
              <Settings className="w-3 h-3" /> Configureaza in Setari →
            </Link>
          </div>
        </div>
      ) : cs ? (
        <div className="mb-4 flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
          <span>
            <strong>Platitor:</strong> {cs.name} | CIF: {cs.cif} | Declarant: {cs.d112_prenume_declar} {cs.d112_nume_declar} ({cs.d112_functie_declar})
          </span>
          <Link href="/setari" className="flex items-center gap-1 text-green-700 hover:underline font-medium">
            <Settings className="w-3 h-3" /> Editeaza in Setari →
          </Link>
        </div>
      ) : null}

      {/* Period selector */}
      <div className="mb-6 flex flex-wrap items-end gap-3 p-4 bg-white border border-gray-200 rounded-lg">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">An</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={inputCls}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Lună</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className={inputCls}>
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded font-medium"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {loading ? 'Generez...' : 'Generează set de date'}
        </button>
        {dataset && (
          <>
            <button
              onClick={downloadCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 hover:bg-gray-50 rounded font-medium"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={downloadXml}
              disabled={settingsMissing.length > 0}
              title={settingsMissing.length > 0 ? 'Completează datele firmei în Setări înainte de export' : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-blue-400 text-blue-700 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed rounded font-medium"
            >
              <FileCode className="w-4 h-4" />
              Export XML (ANAF D112)
            </button>

            <button
              onClick={runValidation}
              disabled={validating || settingsMissing.length > 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-green-500 text-green-700 hover:bg-green-50 disabled:opacity-50 rounded font-medium"
            >
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Validare ANAF
            </button>
          </>
        )}
      </div>


      {/* Validation results panel */}
      {validationMsgs !== null && (() => {
        const errors = validationMsgs.filter(m => m.level === 'ERR')
        const warns  = validationMsgs.filter(m => m.level === 'ATT')
        const isOk   = errors.length === 0
        return (
          <div className={`mb-4 rounded-lg border overflow-hidden ${
            isOk ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-2.5 ${
              isOk ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <span className="flex items-center gap-2 text-sm font-semibold">
                {isOk
                  ? <><ShieldCheck className="w-4 h-4 text-green-600" /><span className="text-green-800">Validare ANAF — nicio eroare fatală</span></>
                  : <><ShieldAlert className="w-4 h-4 text-red-600" /><span className="text-red-800">Validare ANAF — {errors.length} erori fatale (ERR)</span></>}
              </span>
              <span className="text-xs text-gray-500">
                {errors.length} ERR &bull; {warns.length} ATT &bull; DUKValidator J26.0.3
              </span>
            </div>
            {/* Messages */}
            {validationMsgs.length > 0 && (
              <div className="divide-y divide-gray-200 max-h-72 overflow-y-auto">
                {validationMsgs.map((m, i) => (
                  <div key={i} className={`flex gap-2 px-4 py-2 text-xs ${
                    m.level === 'ERR' ? 'bg-red-50 text-red-800'
                    : 'bg-amber-50 text-amber-800'
                  }`}>
                    {m.level === 'ERR'
                      ? <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-500" />
                      : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />}
                    <div>
                      <span className="font-mono font-bold mr-1.5">[{m.code}]</span>
                      {m.msg}
                      {m.cnp && !m.cnp.startsWith('NECNP') && (
                        <span className="ml-1.5 font-mono text-gray-500">CNP: {m.cnp}</span>
                      )}
                    </div>
                  </div>
                ))}
                {errors.length === 0 && warns.length === 0 && (
                  <div className="px-4 py-2 text-xs text-green-700">
                    Toate verificările au trecut. Fișierul XML poate fi importat în aplicația ANAF D112.
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Results */}
      {dataset && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Înregistrări', value: dataset.rows.length },
              { label: 'Total brut (RON)', value: dataset.totalGrossRon.toFixed(2) },
              { label: 'Total impozit reținut (RON)', value: dataset.totalWithholdingTaxRon.toFixed(2) },
              { label: 'Cu avertizări', value: dataset.rowsWithWarnings, warn: dataset.rowsWithWarnings > 0 },
            ].map(card => (
              <div key={card.label} className={`p-3 rounded-lg border ${card.warn ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200 bg-white'}`}>
                <div className="text-lg font-semibold">{card.value}</div>
                <div className="text-xs text-gray-500">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Applicability notes */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-700 mb-1">Note de aplicabilitate</p>
            <ul className="text-xs text-blue-700 space-y-0.5">
              {dataset.applicabilityNotes.map((n, i) => <li key={i}>• {n}</li>)}
            </ul>
          </div>

          {/* Warnings */}
          {dataset.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              {dataset.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-800">{w}</p>
              ))}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse bg-white border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  {['CNP', 'Arendator', 'Tip plată', 'Brut (RON)', 'Deducere (RON)', 'Net impozabil (RON)', 'Impozit reținut (RON)', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b border-gray-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dataset.rows.map((row, i) => (
                  <tr key={i} className={row.warnings.length > 0 ? 'bg-yellow-50' : ''}>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{row.lessorCnp}</td>
                    <td className="px-3 py-2 text-xs">{row.lessorLastName} {row.lessorFirstName}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${row.paymentType === 'IN_KIND' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {row.paymentType === 'IN_KIND' ? 'Natură' : 'Numerar'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-right">{row.grossAmountRon.toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-right text-gray-500">{row.flatDeductionRon.toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-right">{row.netTaxableRon.toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-right font-semibold">{row.withholdingTaxRon.toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.isComplete && row.warnings.length === 0 ? (
                        <span className="flex items-center gap-1 text-green-600"><Check className="w-3 h-3" /> OK</span>
                      ) : (
                        <span className="text-yellow-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Avertizare
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-xs text-right">TOTAL</td>
                  <td className="px-3 py-2 text-xs text-right">{dataset.totalGrossRon.toFixed(2)}</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-500">—</td>
                  <td className="px-3 py-2 text-xs text-right">—</td>
                  <td className="px-3 py-2 text-xs text-right">{dataset.totalWithholdingTaxRon.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 text-center">
        <span className="text-xs text-gray-400">Setul generat este DRAFT — validați cu contabilul înainte de depunere la ANAF.</span>
      </div>
    </div>
  )
}
