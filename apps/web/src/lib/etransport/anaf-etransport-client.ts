/**
 * ANAF e-Transport API client v2.
 *
 * Docs: https://mfinante.gov.ro/ro/web/etransport/informatii-tehnice
 *
 * Upload endpoint (official):
 *   POST /test/ETRANSPORT/ws/v1/upload/ETRANSP/{cif}/{versiune}
 *   versiune = 2 (XML v2, recomandat)
 *
 * Stare endpoint:
 *   GET /test/ETRANSPORT/ws/v1/stare/{cif}/{uploadIndex}
 *
 * Auth: Bearer token din anaf_oauth_tokens (același ca e-Factura).
 */

import type { ETransportUploadResponse, ETransportDeleteResponse, ETransportStatusResponse } from './types'

export type AnafEnv = 'test' | 'prod'

const BASE: Record<AnafEnv, string> = {
  test: 'https://api.anaf.ro/test/ETRANSPORT/ws/v1',
  prod: 'https://api.anaf.ro/prod/ETRANSPORT/ws/v1',
}

function stripRo(cif: string) {
  return cif.replace(/\s/g, '').replace(/^RO/i, '')
}

export class AnafETransportClient {
  private readonly baseUrl: string

  constructor(
    private readonly token: string,
    env: AnafEnv = 'test',
  ) {
    this.baseUrl = BASE[env]
  }

  /**
   * Upload XML v2 to ANAF.
   * URL: POST /upload/ETRANSP/{cif}/2
   */
  async declare(xml: string, cif: string): Promise<{ cod_uit: string; upload_index: number | null; raw: ETransportUploadResponse }> {
    const cifNum = stripRo(cif)
    const url = `${this.baseUrl}/upload/ETRANSP/${encodeURIComponent(cifNum)}/2`

    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 15000)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          Authorization: `Bearer ${this.token}`,
        },
        body: xml,
        signal: ctrl.signal,
      })
    } finally {
      clearTimeout(t)
    }

    const rawText = await res.text()
    if (!res.ok) {
      throw new Error(`ANAF e-Transport upload HTTP ${res.status}: ${rawText.slice(0, 400)}`)
    }

    let body: ETransportUploadResponse
    try {
      body = JSON.parse(rawText) as ETransportUploadResponse
    } catch {
      throw new Error(`ANAF e-Transport: răspuns JSON invalid: ${rawText.slice(0, 200)}`)
    }

    if (body.ExecutionStatus !== '0' && body.ExecutionStatus !== undefined) {
      const errs = body.Errors?.map(e => e.errorMessage).join('; ') ?? 'Eroare necunoscută ANAF'
      throw new Error(`ANAF e-Transport respins: ${errs}`)
    }

    const cod_uit = body.cod_UIT ?? ''
    if (!cod_uit) throw new Error('ANAF e-Transport: lipsă cod_UIT în răspuns')

    return { cod_uit, upload_index: body.index_incarcare ?? null, raw: body }
  }

  /**
   * Poll status. URL: GET /stare/{cif}/{uploadIndex}
   */
  async getStatus(cif: string, uploadIndex: number): Promise<ETransportStatusResponse> {
    const cifNum = stripRo(cif)
    const url = `${this.baseUrl}/stare/${encodeURIComponent(cifNum)}/${uploadIndex}`

    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10000)
    let res: Response
    try {
      res = await fetch(url, { headers: { Authorization: `Bearer ${this.token}` }, signal: ctrl.signal })
    } finally {
      clearTimeout(t)
    }

    const rawText = await res.text()
    if (!res.ok) throw new Error(`ANAF stare HTTP ${res.status}: ${rawText.slice(0, 400)}`)
    try { return JSON.parse(rawText) as ETransportStatusResponse } catch {
      throw new Error(`ANAF stare JSON invalid: ${rawText.slice(0, 200)}`)
    }
  }

  /**
   * Cancel a UIT by sending a DEL operation XML.
   */
  async cancel(cod_uit: string, cif: string): Promise<ETransportDeleteResponse> {
    const cifNum = stripRo(cif)
    const today = new Date().toISOString().split('T')[0]
    const delXml = `<?xml version="1.0" encoding="UTF-8"?>
<E_Transport xmlns="mfp:anaf:dgti:etransport:declaratie:v2"
  codUnic="${cod_uit}" dataCreeareDocument="${today}"
  tipDeclarant="2" codDeclarant="${cifNum}" denumireDeclarant="">
  <Operatiune codTipOp="DEL" codUIT="${cod_uit}"/>
</E_Transport>`
    const url = `${this.baseUrl}/upload/ETRANSP/${encodeURIComponent(cifNum)}/2`

    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 10000)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml', Authorization: `Bearer ${this.token}` },
        body: delXml,
        signal: ctrl.signal,
      })
    } finally {
      clearTimeout(t)
    }

    const rawText = await res.text()
    if (!res.ok) throw new Error(`ANAF stergere HTTP ${res.status}: ${rawText.slice(0, 400)}`)
    try { return JSON.parse(rawText) as ETransportDeleteResponse } catch { return {} }
  }
}
