import type { AssistantMode } from './types'

// ─── System prompt (Romanian, agricultural domain) ────────────────────────────

export const SYSTEM_PROMPT = `Ești ArendaAI, asistentul inteligent al platformei ArendaPro — un sistem de management agricol românesc.

Rolul tău:
- Analizezi date despre contracte de arendă, operațiuni agricole și stocuri de inputuri
- Răspunzi exclusiv în limba română
- Ești concis, precis și orientat spre acțiune
- Prioritizezi termenele limită, riscurile și acțiunile recomandate
- Nu inventezi date lipsă — menționezi clar când informațiile sunt incomplete
- Când ești instruit explicit să produci JSON, returnezi STRICT JSON valid, fără text suplimentar, fără marcaje markdown

Domeniu:
- Contracte de arendă (termene, suprafețe, arendatori, tarife)
- Operațiuni agricole pe câmp (semănat, fertilizat, erbicidat, recoltat)
- Gestionarea stocurilor de semințe, îngrășăminte, pesticide și carburant
- Alertare proactivă și recomandări de prioritizare

Reguli:
- Dacă datele sunt insuficiente, spune "Date insuficiente pentru această analiză."
- Nu specula dincolo de datele furnizate
- Scorul de risc este un număr întreg de la 0 (fără risc) la 100 (risc maxim)`

// ─── Prompt builders ──────────────────────────────────────────────────────────

export function buildPrompt(mode: AssistantMode, data: unknown, question?: string): string {
  switch (mode) {
    case 'full_analysis':
      return buildFullAnalysisPrompt(data)
    case 'contract_alerts':
      return buildContractAlertsPrompt(data)
    case 'farm_alerts':
      return buildFarmAlertsPrompt(data)
    case 'inventory_alerts':
      return buildInventoryAlertsPrompt(data)
    case 'qa':
      return buildQAPrompt(question ?? '', data)
    default:
      return buildFullAnalysisPrompt(data)
  }
}

// ─── Full analysis ────────────────────────────────────────────────────────────

function buildFullAnalysisPrompt(data: unknown): string {
  return `Analizează datele de mai jos și returnează STRICT un obiect JSON valid cu această structură exactă:
{
  "sumar": "string — rezumat executiv în 2-3 propoziții",
  "scor_risc": number (0-100),
  "generat_la": "ISO timestamp",
  "contracte": [ ...ContractAlert ],
  "ferma": [ ...FarmAlert ],
  "stocuri": [ ...StockAlert ]
}

Fiecare ContractAlert:
{ "contract_number": string, "lessor_name": string, "status": "expirat"|"critic"|"atentie"|"ok",
  "priority": "inalta"|"medie"|"scazuta", "end_date": string|null, "days_until_expiry": number|null,
  "suprafata_ha": number|null, "mesaj": string, "actiune_recomandata": string }

Fiecare FarmAlert:
{ "activitate": string, "parcela": string|null, "status": string, "priority": "inalta"|"medie"|"scazuta",
  "data_planificata": string|null, "intarziere_zile": number|null, "mesaj": string, "actiune_recomandata": string }

Fiecare StockAlert:
{ "produs": string, "categorie": string, "status": "critic"|"scazut"|"ok", "priority": "inalta"|"medie"|"scazuta",
  "cantitate_disponibila": number, "unitate": string, "valoare_estimata": number|null,
  "mesaj": string, "actiune_recomandata": string }

Date fermă:
${JSON.stringify(data, null, 2)}

Returnează NUMAI JSON, fără comentarii sau text suplimentar.`
}

// ─── Contract alerts ──────────────────────────────────────────────────────────

function buildContractAlertsPrompt(data: unknown): string {
  return `Analizează contractele de arendă de mai jos și returnează STRICT JSON:
{
  "sumar": string,
  "scor_risc": number,
  "generat_la": string,
  "contracte": [ ...ContractAlert ],
  "ferma": [],
  "stocuri": []
}

Priorități pentru contracte:
- "expirat": contract deja expirat → prioritate "inalta"
- "critic": expiră în < 30 zile → prioritate "inalta"  
- "atentie": expiră în 30-90 zile → prioritate "medie"
- "ok": > 90 zile sau nedeterminat → prioritate "scazuta"

Date contracte:
${JSON.stringify(data, null, 2)}

Returnează NUMAI JSON.`
}

// ─── Farm alerts ──────────────────────────────────────────────────────────────

function buildFarmAlertsPrompt(data: unknown): string {
  const today = new Date().toISOString().split('T')[0]
  return `Data de azi: ${today}

Analizează activitățile agricole de mai jos și returnează STRICT JSON:
{
  "sumar": string,
  "scor_risc": number,
  "generat_la": string,
  "contracte": [],
  "ferma": [ ...FarmAlert ],
  "stocuri": []
}

Identifică:
- activități întârziate (data planificată a trecut, status PLANIFICAT)
- activități în execuție de prea mult timp (> 7 zile)
- parcele fără activitate planificată în sezon curent

Date activități:
${JSON.stringify(data, null, 2)}

Returnează NUMAI JSON.`
}

// ─── Inventory alerts ─────────────────────────────────────────────────────────

function buildInventoryAlertsPrompt(data: unknown): string {
  return `Analizează stocurile de inputuri agricole de mai jos și returnează STRICT JSON:
{
  "sumar": string,
  "scor_risc": number,
  "generat_la": string,
  "contracte": [],
  "ferma": [],
  "stocuri": [ ...StockAlert ]
}

Criterii de alertă:
- "critic": cantitate_disponibila = 0 sau produs expirat → prioritate "inalta"
- "scazut": stoc < 20% din cantitate inițiala sau dată expirare < 30 zile → prioritate "medie"
- "ok": stoc suficient → prioritate "scazuta"

Date stocuri:
${JSON.stringify(data, null, 2)}

Returnează NUMAI JSON.`
}

// ─── Q&A ─────────────────────────────────────────────────────────────────────

function buildQAPrompt(question: string, context: unknown): string {
  const ctxStr = context ? `\nContext disponibil:\n${JSON.stringify(context, null, 2)}` : ''
  return `${ctxStr ? ctxStr + '\n\n' : ''}Întrebare utilizator: ${question}

Răspunde concis și util în română. Dacă nu ai suficiente date, spune clar.`
}
