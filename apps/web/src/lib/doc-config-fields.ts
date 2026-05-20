export type DocType = 'CONTRACT' | 'FACTURA' | 'AVIZ'

export interface ConfigField {
  key: string
  label: string
  defaultValue: string
  multiline?: boolean
}

export const CONFIG_FIELDS: Record<DocType, ConfigField[]> = {
  FACTURA: [
    { key: 'doc_title',        label: 'Titlu document',   defaultValue: 'FACTURĂ FISCALĂ' },
    { key: 'label_furnizor',   label: 'Etichetă furnizor', defaultValue: 'Furnizor:' },
    { key: 'label_client',     label: 'Etichetă client',   defaultValue: 'Client:' },
    { key: 'footer_note',      label: 'Notă subsol',       defaultValue: 'TVA la încasare' },
  ],
  AVIZ: [
    { key: 'doc_title',        label: 'Titlu document',         defaultValue: 'AVIZ DE ÎNSOȚIRE A MĂRFII' },
    { key: 'label_furnizor',   label: 'Etichetă furnizor',      defaultValue: 'Furnizor:' },
    { key: 'label_client',     label: 'Etichetă client',        defaultValue: 'Client (Primitor):' },
    { key: 'label_predat',     label: 'Etichetă predare',       defaultValue: 'Am predat,' },
    { key: 'label_primit',     label: 'Etichetă primire',       defaultValue: 'Am primit,' },
    { key: 'sig_expeditor',    label: 'Semnătură expeditor',    defaultValue: 'Semnătură expeditor' },
    { key: 'sig_primitor',     label: 'Semnătură primitor',     defaultValue: 'Semnătură primitor' },
  ],
  CONTRACT: [
    { key: 'intro_clause',  label: 'Clauza introductivă (Secț. I)', multiline: true,
      defaultValue: 'Ambele părți au convenit să încheie prezentul contract de arendare, în temeiul Legii arendării nr. 16/1994, republicată, cu modificările și completările ulterioare, și ale Codului civil, în următoarele condiții:' },
    { key: 's3_renewal',   label: 'Clauza reînnoire (Secț. III)', multiline: true,
      defaultValue: 'La expirarea termenului, contractul poate fi reînnoit prin acordul scris al ambelor părți, cu cel puțin 30 de zile înainte de data expirării.' },
    { key: 's4_payment',   label: 'Modalitate plată arendă (Secț. IV)', multiline: true,
      defaultValue: 'Arenda se plătește anual, prin acordul direct al părților.' },
    { key: 's6_1_a',       label: 'Obligație arendator a)',  multiline: true,
      defaultValue: 'să predea terenul arendat în stare corespunzătoare destinației agricole;' },
    { key: 's6_1_b',       label: 'Obligație arendator b)',  multiline: true,
      defaultValue: 'să garanteze liniștita posesie și folosință a terenului pe toată durata contractului;' },
    { key: 's6_1_c',       label: 'Obligație arendator c)',  multiline: true,
      defaultValue: 'să achite toate taxele și impozitele legale aferente proprietății, cu excepțiile prevăzute de lege.' },
    { key: 's6_2_a',       label: 'Obligație arendaș a)',    multiline: true,
      defaultValue: 'să folosească terenul arendat ca un bun proprietar și potrivit destinației sale agricole;' },
    { key: 's6_2_b',       label: 'Obligație arendaș b)',    multiline: true,
      defaultValue: 'să mențină potențialul productiv al terenului și să execute lucrările de îmbunătățiri funciare;' },
    { key: 's6_2_c',       label: 'Obligație arendaș c)',    multiline: true,
      defaultValue: 'să plătească arenda la termenele și în condițiile stabilite prin prezentul contract;' },
    { key: 's6_2_d',       label: 'Obligație arendaș d)',    multiline: true,
      defaultValue: 'să nu subînchirieze terenul fără acordul scris al arendatorului;' },
    { key: 's6_2_e',       label: 'Obligație arendaș e)',    multiline: true,
      defaultValue: 'să restituie terenul la expirarea contractului în starea în care l-a primit.' },
    { key: 's7_body',      label: 'Forța majoră (Secț. VII)', multiline: true,
      defaultValue: 'Niciuna din părți nu va fi răspunzătoare pentru neexecutarea obligațiilor sale contractuale, dacă aceasta se datorează unui caz de forță majoră. Partea care invocă forța majoră este obligată să notifice celeilalte părți, în termen de 5 zile, producerea evenimentului.' },
    { key: 's8_body',      label: 'Clauze finale (Secț. VIII)', multiline: true,
      defaultValue: 'Prezentul contract a fost încheiat cu respectarea dispozițiilor Legii nr. 16/1994 a arendării și ale Codului civil, în 3 (trei) exemplare originale, câte unul pentru fiecare parte contractantă și unul pentru înregistrarea la primăria comunei/orașului.' },
    { key: 'sig_arrendator', label: 'Titlu semnătură stânga',   defaultValue: 'ARENDATOR' },
    { key: 'sig_arrendas',   label: 'Titlu semnătură dreapta',  defaultValue: 'ARENDAȘ' },
    { key: 'sig_footnote',   label: 'Text sub semnătură',       defaultValue: 'Semnătura și ștampila' },
  ],
}

export type DocConfig = Record<string, string>

export function getDefaults(docType: DocType): DocConfig {
  return Object.fromEntries(CONFIG_FIELDS[docType].map(f => [f.key, f.defaultValue]))
}

export function cfg(config: DocConfig, key: string, fallback: string): string {
  return config[key] !== undefined && config[key] !== '' ? config[key] : fallback
}
