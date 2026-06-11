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
{"sumar":"string","scor_risc":0,"generat_la":"ISO","contracte":[{"contract_number":"","lessor_name":"","status":"expirat|critic|atentie|ok|draft","priority":"inalta|medie|scazuta","end_date":null,"days_until_expiry":null,"mesaj":"","actiune_recomandata":""}],"ferma":[{"activitate":"","parcela":null,"status":"","priority":"inalta|medie|scazuta","data_planificata":null,"intarziere_zile":null,"mesaj":"","actiune_recomandata":""}],"stocuri":[{"produs":"","categorie":"","status":"critic|scazut|ok","priority":"inalta|medie|scazuta","cantitate_disponibila":0,"unitate":"","mesaj":"","actiune_recomandata":""}],"utilaje":[{"utilaj":"","tip":"","status":"critic|atentie|ok|necunoscut","priority":"inalta|medie|scazuta","rca_expiry":null,"mentenanta_pending":null,"mesaj":"","actiune_recomandata":""}],"facturi":[{"invoice_number":"","status":"","priority":"inalta|medie|scazuta","total_amount":0,"due_date":null,"mesaj":"","actiune_recomandata":""}],"tranzactii":[{"lessor_name":"","status":"neplatita|platita_recent","priority":"inalta|medie|scazuta","suma_ron":0,"campanie":0,"produs":"","mesaj":"","actiune_recomandata":""}]}

Reguli:
- CONTRACTE: alerta pt fiecare contract. DRAFT/null exp->atentie/medie; expirat->expirat/inalta; <30z->critic/inalta; 30-90z->atentie/medie; >90z->ok/scazuta
- ACTIVITATI("ferma" in output): alerta pt fiecare activitate necompletata. intarziat->inalta; executie->medie; planificat->scazuta
- STOCURI: disp=0->critic/inalta; disp<20%ini->scazut/medie; ok->ok/scazuta
- UTILAJE: alerta pt FIECARE utilaj. rca=EXPIRAT->critic/inalta; EXPIRA_CURAND->atentie/inalta; ATENTIE->atentie/medie; NECUNOSCUT->atentie/medie("RCA nedocumentat"); OK->ok/scazuta. Verifica mentenanta[]: cauta tasks cu masina=utilaj.utilaj; overdue(scad<azi)->inalta; scad<30z->medie; seteaza mentenanta_pending="titlu(tip,scad)"
- FACTURI: alerta pt fiecare cu unpaid=true. dep>0->inalta; scad<30z->medie; altfel->scazuta
- TRANZACTII: alerta pt fiecare cu paid=false. suma>1000->inalta; suma>200->medie; altfel->scazuta. status="neplatita"
- Campurile pre-calc(rca,dep) sunt corecte. Nu inventa date.

Date:${JSON.stringify(data)}`
}

// --- Q&A ---------------------------------------------------------------------

function buildQAPrompt(question: string, context: unknown): string {
  const ctxStr = context ? `\nDate:\n${JSON.stringify(context)}` : ''
  return `${ctxStr}\n\nIntrebare: ${question}\n\nRaspunde concis in romana.`
}
