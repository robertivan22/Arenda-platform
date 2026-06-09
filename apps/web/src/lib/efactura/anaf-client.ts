/**
 * ANAF e-Factura API client (Romania).
 *
 * Docs: https://mfinante.gov.ro/ro/web/efactura/informatii-tehnice
 * API base:
 *   test → https://api.anaf.ro/test/FCTEL/rest
 *   prod → https://api.anaf.ro/prod/FCTEL/rest
 *
 * Auth: Bearer token obtained via ANAF OAuth2 / SPV digital certificate.
 * Upload: POST /upload?standard=UBL&cif={cif}  (body = ZIP, Content-Type: application/zip)
 * Status: GET  /stareMesaj?id_incarcare={id}
 * Download: GET /descarcare?id_descarcare={id}
 */

import type { AnafUploadResponse, AnafStatusResponse } from './types'
import { packZip } from './zip'

export type AnafEnv = 'test' | 'prod'

const BASE: Record<AnafEnv, string> = {
  test: 'https://api.anaf.ro/test/FCTEL/rest',
  prod: 'https://api.anaf.ro/prod/FCTEL/rest',
}

export interface UploadResult {
  upload_id: string
  raw: AnafUploadResponse
}

export interface StatusResult {
  /** ANAF canonical state: 'ok', 'nok', 'in prelucrare', etc. */
  anaf_state: string
  download_id: string | null
  errors: string[]
  raw: AnafStatusResponse
}

export class AnafClient {
  private readonly baseUrl: string

  constructor(
    private readonly token: string,
    env: AnafEnv = 'test',
  ) {
    this.baseUrl = BASE[env]
  }

  /**
   * Upload an XML string as a ZIP archive to ANAF e-Factura.
   *
   * @param xml       UBL 2.1 Invoice XML content (UTF-8 string)
   * @param cif       Supplier CUI (with or without "RO" prefix — we strip it)
   * @param filename  Suggested XML filename inside the ZIP (e.g. "FCT-001.xml")
   */
  async uploadInvoice(xml: string, cif: string, filename: string): Promise<UploadResult> {
    const enc = new TextEncoder()
    const xmlBytes = enc.encode(xml)
    const zipBytes = packZip(filename, xmlBytes)

    // ANAF requires only the numeric part of the CUI (no "RO" prefix) in the URL
    const cifNum = cif.replace(/\s/g, '').replace(/^RO/i, '')

    const url = `${this.baseUrl}/upload?standard=UBL&cif=${encodeURIComponent(cifNum)}`

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/zip',
          Authorization: `Bearer ${this.token}`,
        },
        body: zipBytes.buffer as ArrayBuffer,
      })
    } catch (err) {
      throw new Error(`ANAF upload network error: ${String(err)}`)
    }

    const rawText = await res.text()

    if (!res.ok) {
      throw new Error(`ANAF upload HTTP ${res.status}: ${rawText.slice(0, 400)}`)
    }

    let body: AnafUploadResponse
    try {
      body = JSON.parse(rawText) as AnafUploadResponse
    } catch {
      throw new Error(`ANAF upload: invalid JSON response: ${rawText.slice(0, 200)}`)
    }

    if (body.dateResponse?.ExecutionStatus !== '0') {
      const errs = body.Errors?.map(e => e.errorMessage).join('; ') ?? 'Eroare necunoscută ANAF'
      throw new Error(`ANAF upload respins: ${errs}`)
    }

    const upload_id = String(body.dateResponse?.id_incarcare ?? '')
    if (!upload_id) throw new Error('ANAF upload: lipsă id_incarcare în răspuns')

    return { upload_id, raw: body }
  }

  /**
   * Poll the processing status of a previously uploaded invoice.
   */
  async getStatus(upload_id: string): Promise<StatusResult> {
    const url = `${this.baseUrl}/stareMesaj?id_incarcare=${encodeURIComponent(upload_id)}`

    let res: Response
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.token}` },
      })
    } catch (err) {
      throw new Error(`ANAF status network error: ${String(err)}`)
    }

    const rawText = await res.text()
    if (!res.ok) throw new Error(`ANAF status HTTP ${res.status}: ${rawText.slice(0, 400)}`)

    let body: AnafStatusResponse
    try {
      body = JSON.parse(rawText) as AnafStatusResponse
    } catch {
      throw new Error(`ANAF status: invalid JSON: ${rawText.slice(0, 200)}`)
    }

    const anaf_state = body.stare ?? 'unknown'
    const download_id = body.id_descarcare != null ? String(body.id_descarcare) : null
    const errors = body.Errors?.map(e => e.errorMessage) ?? []

    return { anaf_state, download_id, errors, raw: body }
  }

  /**
   * Download the signed XML/ZIP artifact returned by ANAF after acceptance.
   */
  async downloadArtifact(download_id: string): Promise<Uint8Array> {
    const url = `${this.baseUrl}/descarcare?id_descarcare=${encodeURIComponent(download_id)}`

    let res: Response
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.token}` },
      })
    } catch (err) {
      throw new Error(`ANAF download network error: ${String(err)}`)
    }

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`ANAF download HTTP ${res.status}: ${text.slice(0, 400)}`)
    }

    return new Uint8Array(await res.arrayBuffer())
  }
}

/**
 * Map the ANAF canonical state string to our internal EFacturaStatus.
 */
export function anafStateToStatus(
  state: string,
): 'SUBMITTED' | 'PROCESSING' | 'ACCEPTED' | 'REJECTED' {
  switch (state.toLowerCase()) {
    case 'ok':
      return 'ACCEPTED'
    case 'nok':
      return 'REJECTED'
    case 'in prelucrare':
    case 'in_prelucrare':
      return 'PROCESSING'
    default:
      return 'SUBMITTED'
  }
}
