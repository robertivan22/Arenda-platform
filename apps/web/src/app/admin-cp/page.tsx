'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Save, ChevronDown, ChevronRight, Shield, FileText, Users } from 'lucide-react'
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
  can_setari: boolean
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
  { key: 'can_dashboard',  label: 'Dashboard' },
  { key: 'can_arendasi',   label: 'Arendași' },
  { key: 'can_contracte',  label: 'Contracte' },
  { key: 'can_parcele',    label: 'Parcele' },
  { key: 'can_tranzactii', label: 'Tranzacții' },
  { key: 'can_facturi',    label: 'Facturi & Avize' },
  { key: 'can_rapoarte',   label: 'Rapoarte' },
  { key: 'can_declaratii', label: 'Declarații' },
  { key: 'can_setari',     label: 'Setări' },
]

const DEFAULT_PERMS: Omit<Permissions, 'user_id'> = {
  can_dashboard: true, can_arendasi: true, can_contracte: true,
  can_parcele: true, can_tranzactii: true, can_facturi: true,
  can_rapoarte: true, can_declaratii: true, can_setari: true,
}

// (PLACEHOLDERS and STARTER_HTML removed — templates now use form-based JSON config)
// ─── Config stub ─────────────────────────────────────────────────────────────
const PLACEHOLDERS: Record<DocType, string[]> = {
  FACTURA: [
    '{{company_logo}}',
    '{{invoice_number}}', '{{invoice_series}}', '{{invoice_date}}', '{{due_date}}', '{{tva_rate}}',
    '{{company_name}}', '{{company_cif}}', '{{company_reg_com}}', '{{company_address}}',
    '{{company_iban}}', '{{company_bank}}', '{{company_phone}}', '{{company_email}}',
    '{{client_name}}', '{{client_cnp}}', '{{client_address}}', '{{client_iban}}',
    '{{client_bank}}', '{{client_phone}}', '{{client_email}}',
    '{{products_table}}', '{{total_fara_tva}}', '{{tva_amount}}', '{{total_cu_tva}}',
  ],
  AVIZ: [
    '{{company_logo}}',
    '{{aviz_number}}', '{{aviz_series}}', '{{aviz_date}}',
    '{{company_name}}', '{{company_cif}}', '{{company_address}}', '{{company_iban}}', '{{company_bank}}', '{{company_phone}}',
    '{{client_name}}', '{{client_cnp}}', '{{client_address}}',
    '{{products_table}}', '{{total_kg}}',
  ],
  CONTRACT: [
    '{{company_logo}}',
    '{{contract_number}}', '{{sign_date}}', '{{start_date}}', '{{end_date}}', '{{contract_years}}',
    '{{primarie_nr}}', '{{primarie_date}}', '{{localities}}', '{{total_ha}}', '{{tax_method}}',
    '{{contract_type}}',
    '{{company_name}}', '{{company_cif}}', '{{company_reg_com}}', '{{company_address}}',
    '{{company_iban}}', '{{company_bank}}', '{{company_phone}}',
    '{{lessor_name}}', '{{lessor_id_label}}', '{{lessor_cnp}}', '{{lessor_address}}',
    '{{lessor_locality}}', '{{lessor_county}}', '{{lessor_phone}}',
    '{{lessor_iban}}', '{{lessor_bank}}',
    '{{rent_table}}', '{{parcels_table}}',
  ],
}

const STARTER_HTML: Record<DocType, string> = {
  FACTURA: `<style>
  @media print { body { margin: 0; } .page { box-shadow: none !important; margin: 0 !important; } }
  body { background: #f3f4f6; font-family: Arial, sans-serif; }
  .page { background: white; max-width: 210mm; margin: 20px auto; padding: 20mm; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
</style>
<div class="page">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;gap:8px">
    <div style="min-width:170px;max-width:200px">{{company_logo}}</div>
    <div style="flex:1;text-align:center">
      <h1 style="font-size:18pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin:0;font-family:Arial,sans-serif">FACTURĂ FISCALĂ</h1>
    </div>
    <div style="min-width:180px">
      <table style="border-collapse:collapse;margin-left:auto;font-size:11pt">
        <tr><td style="padding:4px 10px;font-weight:bold;background:#f9fafb;border:1px solid #d1d5db">Nr.</td><td style="padding:4px 10px;border:1px solid #d1d5db">{{invoice_number}}</td></tr>
        <tr><td style="padding:4px 10px;font-weight:bold;background:#f9fafb;border:1px solid #d1d5db">Serie</td><td style="padding:4px 10px;border:1px solid #d1d5db">{{invoice_series}}</td></tr>
        <tr><td style="padding:4px 10px;font-weight:bold;background:#f9fafb;border:1px solid #d1d5db">Data</td><td style="padding:4px 10px;border:1px solid #d1d5db">{{invoice_date}}</td></tr>
        <tr><td style="padding:4px 10px;font-weight:bold;background:#f9fafb;border:1px solid #d1d5db">Scadența</td><td style="padding:4px 10px;border:1px solid #d1d5db">{{due_date}}</td></tr>
        <tr><td style="padding:4px 10px;font-weight:bold;background:#f9fafb;border:1px solid #d1d5db">Cota TVA</td><td style="padding:4px 10px;border:1px solid #d1d5db">{{tva_rate}}% Redus</td></tr>
      </table>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:20px;font-size:11pt">
    <div>
      <p style="font-weight:bold;color:#6b7280;font-size:9pt;text-transform:uppercase;margin-bottom:6px">Furnizor:</p>
      <p style="font-weight:bold;color:#1d4ed8;font-size:13pt;margin:0">{{company_name}}</p>
      <p style="margin:2px 0">CIF: {{company_cif}}</p>
      <p style="margin:2px 0">Reg. com.: {{company_reg_com}}</p>
      <p style="margin:2px 0">Adresa: {{company_address}}</p>
      <p style="margin:2px 0">IBAN: {{company_iban}}</p>
      <p style="margin:2px 0">Bancă: {{company_bank}}</p>
      <p style="margin:2px 0">Tel.: {{company_phone}}</p>
      <p style="margin:2px 0">Email: {{company_email}}</p>
    </div>
    <div>
      <p style="font-weight:bold;color:#6b7280;font-size:9pt;text-transform:uppercase;margin-bottom:6px">Client:</p>
      <p style="font-weight:bold;color:#1d4ed8;font-size:13pt;margin:0">{{client_name}}</p>
      <p style="margin:2px 0">CNP: {{client_cnp}}</p>
      <p style="margin:2px 0">Adresa: {{client_address}}</p>
      <p style="margin:2px 0">IBAN: {{client_iban}}</p>
      <p style="margin:2px 0">Bancă: {{client_bank}}</p>
      <p style="margin:2px 0">Tel.: {{client_phone}}</p>
      <p style="margin:2px 0">Email: {{client_email}}</p>
    </div>
  </div>
  {{products_table}}
  <div style="display:flex;justify-content:flex-end;margin-top:8px">
    <table style="font-size:11pt;border-collapse:collapse">
      <tr><td style="padding:3px 32px 3px 0;color:#6b7280;border:none">Total fără TVA</td><td style="font-weight:bold;text-align:right;border:none">{{total_fara_tva}} RON</td></tr>
      <tr><td style="padding:3px 32px 3px 0;color:#6b7280;border:none">TVA {{tva_rate}}%</td><td style="font-weight:bold;text-align:right;border:none">{{tva_amount}} RON</td></tr>
      <tr style="border-top:1px solid #9ca3af"><td style="padding:6px 32px 3px 0;font-weight:bold;border:none">Total plată</td><td style="font-weight:bold;text-align:right;font-size:14pt;border:none">{{total_cu_tva}} RON</td></tr>
    </table>
  </div>
  <p style="font-size:9pt;color:#9ca3af;text-align:center;margin-top:20px">TVA la încasare</p>
</div>`,
  AVIZ: `<style>
  @media print { body { margin: 0; } .page { box-shadow: none !important; margin: 0 !important; } }
  body { background: #f3f4f6; font-family: Arial, sans-serif; }
  .page { background: white; max-width: 210mm; margin: 20px auto; padding: 20mm; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
</style>
<div class="page">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;gap:8px">
    <div style="min-width:170px;max-width:200px">{{company_logo}}</div>
    <div style="flex:1;text-align:center">
      <h1 style="font-size:18pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin:0;font-family:Arial,sans-serif">AVIZ DE \u00ceNSO\u021aIRE A M\u0102RFII</h1>
    </div>
    <div style="min-width:180px">
      <table style="border-collapse:collapse;margin-left:auto;font-size:11pt">
        <tr><td style="padding:4px 10px;font-weight:bold;background:#f9fafb;border:1px solid #d1d5db">Nr.</td><td style="padding:4px 10px;border:1px solid #d1d5db">{{aviz_number}}</td></tr>
        <tr><td style="padding:4px 10px;font-weight:bold;background:#f9fafb;border:1px solid #d1d5db">Serie</td><td style="padding:4px 10px;border:1px solid #d1d5db">{{aviz_series}}</td></tr>
        <tr><td style="padding:4px 10px;font-weight:bold;background:#f9fafb;border:1px solid #d1d5db">Data</td><td style="padding:4px 10px;border:1px solid #d1d5db">{{aviz_date}}</td></tr>
      </table>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:20px;font-size:11pt">
    <div>
      <p style="font-weight:bold;color:#6b7280;font-size:9pt;text-transform:uppercase;margin-bottom:6px">Furnizor:</p>
      <p style="font-weight:bold;color:#1d4ed8;font-size:13pt;margin:0">{{company_name}}</p>
      <p style="margin:2px 0">CIF: {{company_cif}}</p>
      <p style="margin:2px 0">Adresa: {{company_address}}</p>
      <p style="margin:2px 0">IBAN: {{company_iban}} \u2014 {{company_bank}}</p>
      <p style="margin:2px 0">Tel.: {{company_phone}}</p>
    </div>
    <div>
      <p style="font-weight:bold;color:#6b7280;font-size:9pt;text-transform:uppercase;margin-bottom:6px">Client (Primitor):</p>
      <p style="font-weight:bold;color:#1d4ed8;font-size:13pt;margin:0">{{client_name}}</p>
      <p style="margin:2px 0">CNP: {{client_cnp}}</p>
      <p style="margin:2px 0">Adresa: {{client_address}}</p>
    </div>
  </div>
  {{products_table}}
  <div style="display:flex;justify-content:space-between;margin-top:36px;font-size:11pt">
    <div>
      <strong>Am predat,</strong>
      <div style="border-top:1px solid #000;width:180px;margin-top:48px;padding-top:4px;font-size:9pt;color:#555">Semn\u0103tur\u0103 expeditor</div>
    </div>
    <div>
      <strong>Am primit,</strong>
      <div style="border-top:1px solid #000;width:180px;margin-top:48px;padding-top:4px;font-size:9pt;color:#555">Semn\u0103tur\u0103 primitor</div>
    </div>
  </div>
</div>`,
  CONTRACT: `<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f0f0f0; }
  .print-page { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.6; color: #000; background: #fff; max-width: 210mm; min-height: 297mm; margin: 0 auto; padding: 20mm 22mm 20mm 28mm; }
  .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 8pt; margin-bottom: 12pt; }
  .company-logo { max-height: 110px; max-width: 260px; object-fit: contain; margin-bottom: 6pt; display: block; }
  .company-info { font-size: 9pt; line-height: 1.4; }
  .company-name { font-weight: bold; font-size: 11pt; }
  .doc-ref { text-align: right; font-size: 9pt; line-height: 1.6; }
  h1 { font-size: 14pt; text-align: center; text-transform: uppercase; font-weight: bold; margin: 8pt 0 2pt; letter-spacing: 1px; }
  .subtitle { text-align: center; font-size: 10pt; margin: 0 0 14pt; }
  h2 { font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 12pt 0 4pt; border-bottom: 1px solid #ccc; padding-bottom: 2pt; }
  p { margin: 4pt 0; text-align: justify; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0; font-size: 10pt; }
  th { border: 1px solid #333; padding: 4pt 6pt; background: #f0f0f0; font-weight: bold; text-align: center; font-size: 9pt; }
  td { border: 1px solid #333; padding: 3pt 6pt; }
  .right { text-align: right; } .center { text-align: center; }
  .total-row td { font-weight: bold; background: #f9f9f9; }
  .signatures { display: flex; justify-content: space-between; margin-top: 36pt; gap: 20pt; }
  .sig-block { flex: 1; } .sig-title { font-weight: bold; font-size: 11pt; margin-bottom: 4pt; }
  .sig-line { border-bottom: 1px solid #000; margin-top: 28pt; }
  .sig-label { font-size: 9pt; color: #555; margin-top: 2pt; }
  @media print { body { background: #fff; } .print-page { margin: 0; box-shadow: none; } @page { size: A4 portrait; margin: 0; } }
  @media screen { .print-page { box-shadow: 0 0 20px rgba(0,0,0,.15); margin: 24px auto; } }
</style>
<div class="print-page">
  <div class="doc-header">
    <div>
      {{company_logo}}
      <div class="company-name">{{company_name}}</div>
      <div class="company-info">
        <div>CIF: {{company_cif}} | Reg. Com.: {{company_reg_com}}</div>
        <div>{{company_address}}</div>
        <div>IBAN: {{company_iban}} \u2014 {{company_bank}}</div>
        <div>Tel: {{company_phone}}</div>
      </div>
    </div>
    <div class="doc-ref">
      <div><strong>Nr. contract:</strong> {{contract_number}}</div>
      <div><strong>Data:</strong> {{sign_date}}</div>
      <div><strong>Nr. Prim\u0103rie:</strong> {{primarie_nr}}</div>
      <div><strong>Data prim\u0103rie:</strong> {{primarie_date}}</div>
    </div>
  </div>

  <h1>CONTRACT DE {{contract_type}}</h1>
  <div class="subtitle">Nr. {{contract_number}} / {{sign_date}}</div>

  <h2>I. P\u0103r\u021bile Contractante</h2>
  <p><strong>1.1. Arendatorul:</strong> {{lessor_name}}, {{lessor_id_label}}: {{lessor_cnp}}, domiciliat(\u0103) \u00een {{lessor_address}}, {{lessor_locality}}, {{lessor_county}}, tel: {{lessor_phone}}, IBAN: {{lessor_iban}} ({{lessor_bank}}), denumit(\u0103) \u00een continuare <strong>Arendator</strong>.</p>
  <p><strong>1.2. Arenda\u015ful:</strong> {{company_name}}, CIF {{company_cif}}, Nr. Reg. Com. {{company_reg_com}}, cu sediul \u00een {{company_address}}, IBAN: {{company_iban}} ({{company_bank}}), tel: {{company_phone}}, denumit(\u0103) \u00een continuare <strong>Arenda\u015f</strong>.</p>
  <p>Ambele p\u0103r\u021bi au convenit s\u0103 \u00eencheie prezentul contract de arendare, \u00een temeiul Legii arend\u0103rii nr. 16/1994, republicat\u0103, cu modific\u0103rile \u015fi complet\u0103rile ulterioare, \u015fi ale Codului civil, \u00een urm\u0103toarele condi\u021bii:</p>

  <h2>II. Obiectul Contractului</h2>
  <p>Arendatorul transmite arenda\u015fului, spre folosin\u021b\u0103 temporar\u0103 pe durata prezentului contract, terenuri agricole situate \u00een <strong>{{localities}}</strong>, \u00een suprafa\u021b\u0103 total\u0103 de <strong>{{total_ha}} ha</strong>, identificate conform Sec\u021biunii V de mai jos.</p>

  <h2>III. Durata Contractului</h2>
  <p>Contractul se \u00eencheie pe o perioad\u0103 de <strong>{{contract_years}} ani</strong>, \u00eencep\u00e2nd cu data de <strong>{{start_date}}</strong> \u015fi expir\u00e2nd la data de <strong>{{end_date}}</strong>.</p>
  <p>La expirarea termenului, contractul poate fi re\u00eennoit prin acordul scris al ambelor p\u0103r\u021bi, cu cel pu\u021bin 30 de zile \u00eenainte de data expir\u0103rii.</p>

  <h2>IV. Arenda (Chiria)</h2>
  <p>Arenda convenit\u0103 de p\u0103r\u021bi, pentru \u00eentreaga suprafa\u021b\u0103 de <strong>{{total_ha}} ha</strong>, este:</p>
  {{rent_table}}
  <p>Arenda se pl\u0103te\u015fte anual, prin acordul direct al p\u0103r\u021bilor. Metoda de plat\u0103 a impozitului: <strong>{{tax_method}}</strong>.</p>

  <h2>V. Terenurile Arendate</h2>
  {{parcels_table}}

  <h2>VI. Obliga\u021biile P\u0103r\u021bilor</h2>
  <p><strong>6.1. Arendatorul se oblig\u0103:</strong></p>
  <p>a) s\u0103 predea terenul arendat \u00een stare corespunz\u0103toare destina\u021biei agricole;</p>
  <p>b) s\u0103 garanteze lini\u015ftita posesie \u015fi folosin\u021b\u0103 a terenului pe toat\u0103 durata contractului;</p>
  <p>c) s\u0103 achite toate taxele \u015fi impozitele legale aferente propriet\u0103\u021bii, cu excep\u021biile prev\u0103zute de lege.</p>
  <p style="margin-top:6pt"><strong>6.2. Arenda\u015ful se oblig\u0103:</strong></p>
  <p>a) s\u0103 foloseasc\u0103 terenul arendat ca un bun proprietar \u015fi potrivit destina\u021biei sale agricole;</p>
  <p>b) s\u0103 men\u021bin\u0103 poten\u021bialul productiv al terenului \u015fi s\u0103 execute lucr\u0103rile de \u00eembun\u0103t\u0103\u021biri funciare;</p>
  <p>c) s\u0103 pl\u0103teasc\u0103 arenda la termenele \u015fi \u00een condi\u021biile stabilite prin prezentul contract;</p>
  <p>d) s\u0103 nu sub\u00eenchirieze terenul f\u0103r\u0103 acordul scris al arendatorului;</p>
  <p>e) s\u0103 restituie terenul la expirarea contractului \u00een starea \u00een care l-a primit.</p>

  <h2>VII. For\u021ba Major\u0103 \u015fi Cazul Fortuit</h2>
  <p>Niciuna din p\u0103r\u021bi nu va fi r\u0103spunz\u0103toare pentru neexecutarea obliga\u021biilor sale contractuale, dac\u0103 aceasta se datoreaz\u0103 unui caz de for\u021b\u0103 major\u0103. Partea care invoc\u0103 for\u021ba major\u0103 este obligat\u0103 s\u0103 notifice celeilalte p\u0103r\u021bi, \u00een termen de 5 zile, producerea evenimentului.</p>

  <h2>VIII. Clauze Finale</h2>
  <p>Prezentul contract a fost \u00eencheiat cu respectarea dispozi\u021biilor Legii nr. 16/1994 a arend\u0103rii \u015fi ale Codului civil, \u00een <strong>3 (trei) exemplare originale</strong>, c\u00e2te unul pentru fiecare parte contractant\u0103 \u015fi unul pentru \u00eenregistrarea la prim\u0103ria comunei/ora\u015fului {{localities}}.</p>
  <p>\u00cenregistrat la Prim\u0103rie cu nr. <strong>{{primarie_nr}}</strong> din data de {{primarie_date}}.</p>

  <div class="signatures">
    <div class="sig-block">
      <div class="sig-title">ARENDATOR</div>
      <p>{{lessor_name}}</p>
      <p style="font-size:9pt;color:#555">{{lessor_address}}, {{lessor_locality}}, {{lessor_county}}</p>
      <div class="sig-line"></div>
      <div class="sig-label">Semn\u0103tura \u015fi \u015ftampila</div>
    </div>
    <div class="sig-block" style="text-align:right">
      <div class="sig-title">ARENDA\u0218</div>
      <p>{{company_name}}</p>
      <p style="font-size:9pt;color:#555">CIF: {{company_cif}}</p>
      <div class="sig-line"></div>
      <div class="sig-label">Semn\u0103tura \u015fi \u015ftampila</div>
    </div>
  </div>
</div>`,
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50'
const tdCls = 'px-3 py-2 text-sm text-gray-800'

// ─── Component ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [tab, setTab] = useState<'users' | 'templates'>('users')

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
    const [{ data: profs }, { data: perms }, { data: tmpls }] = await Promise.all([
      db.from('profiles').select('id, email, display_name, is_admin').order('email'),
      db.from('user_permissions').select('*'),
      db.from('document_templates').select('*'),
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
          {([['users', 'Utilizatori'], ['templates', 'Template-uri']] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === k ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >{l}</button>
          ))}
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
      </div>
    </div>
  )
}
