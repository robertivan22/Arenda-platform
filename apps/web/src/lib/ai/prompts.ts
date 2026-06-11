import type { AssistantMode } from './types'

// --- System prompt -----------------------------------------------------------

export const SYSTEM_PROMPT = `Esti ArendaAI. Analizezi date agricole si produci alerte JSON. Raspunde in romana. Returneaza STRICT JSON valid fara markdown cand esti instruit sa faci analiza.`

// --- Prompt dispatcher -------------------------------------------------------

export function buildPrompt(mode: AssistantMode, data: unknown, question?: string): string {
  if (mode === 'qa') return buildQAPrompt(question ?? '', data)
  return buildFullAnalysisPrompt(data)
}

// --- Full analysis -----------------------------------------------------------

function buildFullAnalysisPrompt(data: unknown): string {
  return `Azi:${new Date().toISOString().split('T')[0]}. Returneaza STRICT JSON:
{"sumar":"string","scor_risc":0,"generat_la":"ISO","contracte":[{"contract_number":"","lessor_name":"","status":"expirat|critic|atentie|ok|draft","priority":"inalta|medie|scazuta","end_date":null,"days_until_expiry":null,"mesaj":"","actiune_recomandata":""}],"ferma":[{"activitate":"","parcela":null,"status":"","priority":"inalta|medie|scazuta","data_planificata":null,"intarziere_zile":null,"mesaj":"","actiune_recomandata":""}],"stocuri":[{"produs":"","categorie":"","status":"critic|scazut|ok","priority":"inalta|medie|scazuta","cantitate_disponibila":0,"unitate":"","mesaj":"","actiune_recomandata":""}]}

REGULA CRITICA: Utilizeaza STRICT datele din 'Date'. NU inventa produse, arendatori sau orice date inexistente.
- CONTRACTE: un alert pt fiecare element din contracte[]. contract_number=camp 'nr', lessor_name=camp 'arendas' EXACT. zile<0->expirat/inalta; zile<30->critic/inalta; zile<90->atentie/medie; DRAFT/null->atentie/medie; altfel->ok/scazuta.
- ACTIVITATI("ferma" in output): un alert pt fiecare element din activitati[]. activitate=camp 'op', parcela=camp 'parc' EXACT. intarziat->inalta; executie->medie; planificat->scazuta.
- STOCURI: un alert pt fiecare element din stocuri[]. produs=camp 'prod' EXACT. NU adauga produse inexistente. disp=0->critic/inalta; disp<20%ini->scazut/medie; altfel->ok/scazuta.
- scor_risc: 0-100 bazat pe toate alertele (contracte+ferma+stocuri) plus utilaje_risc si tranzactii_risc din date.

Date:${JSON.stringify(data)}`
}

// --- Q&A ---------------------------------------------------------------------

function buildQAPrompt(question: string, context: unknown): string {
  const ctxStr = context ? `\nDate:\n${JSON.stringify(context)}` : ''
  return `${ctxStr}\n\nIntrebare: ${question}\n\nRaspunde concis in romana.`
}
