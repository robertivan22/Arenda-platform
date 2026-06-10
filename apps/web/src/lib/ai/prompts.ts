import type { AssistantMode } from './types'

// --- System prompt -----------------------------------------------------------

export const SYSTEM_PROMPT = `Esti ArendaAI, asistentul inteligent al platformei ArendaPro.

Rolul tau:
- Analizezi date complete din toata baza de date a fermei: contracte, operatiuni, stocuri, utilaje, facturi, APIA, fitosanitar
- Raspunzi exclusiv in limba romana
- Esti concis, precis si orientat spre actiune
- Prioritizezi termenele limita, riscurile si actiunile recomandate
- Nu inventezi date lipsa - mentionezi clar cand informatiile sunt incomplete
- Cand esti instruit explicit sa produci JSON, returnezi STRICT JSON valid, fara text suplimentar, fara marcaje markdown

Reguli:
- Daca datele sunt insuficiente, spune "Date insuficiente pentru aceasta analiza."
- Nu specula dincolo de datele furnizate
- Scorul de risc este un numar intreg de la 0 (fara risc) la 100 (risc maxim)
- Alertele goale sunt permise (array vid [] daca nu exista probleme)`

// --- Prompt dispatcher -------------------------------------------------------

export function buildPrompt(mode: AssistantMode, data: unknown, question?: string): string {
  if (mode === 'qa') return buildQAPrompt(question ?? '', data)
  return buildFullAnalysisPrompt(data)
}

// --- Full analysis -----------------------------------------------------------

function buildFullAnalysisPrompt(data: unknown): string {
  return `Data de azi: ${new Date().toISOString().split('T')[0]}

Analizeaza TOATE datele de mai jos din baza de date a fermei si returneaza STRICT un obiect JSON valid cu aceasta structura:

{
  "sumar": "rezumat executiv 3-4 propozitii care acopera starea generala a fermei",
  "scor_risc": number,
  "generat_la": "ISO timestamp",
  "contracte": [
    { "contract_number": string, "lessor_name": string, "status": "expirat"|"critic"|"atentie"|"ok",
      "priority": "inalta"|"medie"|"scazuta", "end_date": string|null, "days_until_expiry": number|null,
      "suprafata_ha": number|null, "mesaj": string, "actiune_recomandata": string }
  ],
  "ferma": [
    { "activitate": string, "parcela": string|null, "status": string,
      "priority": "inalta"|"medie"|"scazuta", "data_planificata": string|null,
      "intarziere_zile": number|null, "mesaj": string, "actiune_recomandata": string }
  ],
  "stocuri": [
    { "produs": string, "categorie": string, "status": "critic"|"scazut"|"ok",
      "priority": "inalta"|"medie"|"scazuta", "cantitate_disponibila": number, "unitate": string,
      "valoare_estimata": number|null, "mesaj": string, "actiune_recomandata": string }
  ],
  "utilaje": [
    { "utilaj": string, "tip": string, "status": "critic"|"atentie"|"ok",
      "priority": "inalta"|"medie"|"scazuta", "rca_expiry": string|null,
      "mesaj": string, "actiune_recomandata": string }
  ],
  "facturi": [
    { "invoice_number": string, "status": string, "priority": "inalta"|"medie"|"scazuta",
      "total_amount": number, "due_date": string|null, "mesaj": string, "actiune_recomandata": string }
  ],
  "apia": [
    { "campaign_year": number, "status": string, "priority": "inalta"|"medie"|"scazuta",
      "total_declared_ha": number, "mesaj": string, "actiune_recomandata": string }
  ],
  "fitosanitar": [
    { "produs": string, "parcela": string|null, "priority": "inalta"|"medie"|"scazuta",
      "data_aplicarii": string|null, "mesaj": string, "actiune_recomandata": string }
  ],
  "arendasi_sumar": { "total": number, "total_suprafata_ha": number }
}

Reguli de prioritizare:
- Contracte: expirat->inalta, <30 zile->inalta, 30-90 zile->medie, >90 zile->scazuta
- Ferma: intarziat + neexecutat->inalta, in executie->medie, planificat viitor->scazuta
- Stocuri: 0 cantitate sau expirat->critic/inalta, <20% din initial->scazut/medie
- Utilaje: RCA expirat sau expira <30 zile->critic/inalta, 30-60 zile->atentie/medie
- Facturi: scadente depasite->inalta, scadente in <7 zile->medie
- APIA: dosar DRAFT aproape de deadline->inalta

Date complete ferma:
${JSON.stringify(data, null, 2)}

Returneaza NUMAI JSON, fara comentarii, fara markdown.`
}

// --- Q&A ---------------------------------------------------------------------

function buildQAPrompt(question: string, context: unknown): string {
  const ctxStr = context ? `\nDate disponibile din baza de date:\n${JSON.stringify(context, null, 2)}` : ''
  return `${ctxStr}\n\nIntrebare: ${question}\n\nRaspunde concis si util in romana. Daca nu ai suficiente date, spune clar.`
}
