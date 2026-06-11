import type { AssistantMode } from './types'

// --- System prompt -----------------------------------------------------------

export const SYSTEM_PROMPT = `Esti asistentul AI pentru platforma ArendaPro, un SaaS agricol din Romania.

REGULA #1 - ZERO INVENTII: Lucrezi EXCLUSIV cu datele din JSON-ul primit.
- Daca un camp este null, "", 0 sau lipseste -> il raportezi ca nedisponibil, NU il inventezi
- NICIODATA nu presupui, estimezi sau completezi date lipsa din propria cunoastere

REGULA #2 - CALCULE DE DATE: Data de azi este ${new Date().toISOString().split('T')[0]}
- Calculezi zilele ramase STRICT matematic: data_expirare - data_azi
- Daca data lipseste sau e null -> zile_ramase: null

REGULA #3 - FORMAT RASPUNS: Returnezi EXCLUSIV JSON valid, fara text introductiv, fara markdown fences, fara comentarii.`

// --- Prompt dispatcher -------------------------------------------------------

export function buildPrompt(mode: AssistantMode, data: unknown, question?: string): string {
  if (mode === 'qa') return buildQAPrompt(question ?? '', data)
  return buildFullAnalysisPrompt(data)
}

// --- Full analysis -----------------------------------------------------------

function buildFullAnalysisPrompt(data: unknown): string {
  return `Azi:${new Date().toISOString().split('T')[0]}. Returneaza STRICT JSON:
{"sumar":"string","scor_risc":0,"generat_la":"ISO","actiuni":["max 4 actiuni scurte concrete"],"insights":[{"impact":"mare|mediu|mic","categorie":"string","titlu":"string","descriere":"max 2 propozitii"}],"contracte":[{"contract_number":"","lessor_name":"","status":"expirat|critic|atentie|ok|draft","priority":"inalta|medie|scazuta","end_date":null,"days_until_expiry":null,"mesaj":"","actiune_recomandata":""}],"ferma":[{"activitate":"","parcela":null,"status":"","priority":"inalta|medie|scazuta","data_planificata":null,"intarziere_zile":null,"mesaj":"","actiune_recomandata":""}],"stocuri":[{"produs":"","categorie":"","status":"critic|scazut|ok","priority":"inalta|medie|scazuta","cantitate_disponibila":0,"unitate":"","mesaj":"","actiune_recomandata":""}]}

REGULA CRITICA: Utilizeaza STRICT datele din 'Date'. NU inventa produse, arendatori sau date inexistente.
- CONTRACTE: un alert pt fiecare element din contracte[]. contract_number=camp 'nr', lessor_name=camp 'arendas' EXACT. zile<0->expirat/inalta; zile<30->critic/inalta; zile<90->atentie/medie; DRAFT/null->atentie/medie; altfel->ok/scazuta.
- ACTIVITATI("ferma" in output): un alert pt fiecare element din activitati[]. activitate=camp 'op', parcela=camp 'parc' EXACT.
- STOCURI: un alert pt fiecare element din stocuri[]. produs=camp 'prod' EXACT. NU adauga produse inexistente.
- ACTIUNI: max 4 actiuni concrete de maxim 5 cuvinte fiecare (ex: "Comanda azot 1.2t", "Renegociaza contract #nr")
- INSIGHTS: exact 3 insights strategice, ordonate dupa impact. Titlu scurt, descriere 1-2 propozitii.
- scor_risc: 0-100 bazat pe toate alertele plus utilaje_risc si tranzactii_risc.

Date:${JSON.stringify(data)}`
}

// --- Q&A ---------------------------------------------------------------------

function buildQAPrompt(question: string, context: unknown): string {
  const ctxStr = context ? `\nDate:\n${JSON.stringify(context)}` : ''
  return `${ctxStr}\n\nIntrebare: ${question}\n\nRaspunde concis in romana.`
}
