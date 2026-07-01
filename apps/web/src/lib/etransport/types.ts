// ─── RO e-Transport domain types ─────────────────────────────────────────────
// Based on ANAF e-Transport schema v2 (mfp:anaf:dgti:etransport:declaratie:v2)

/** Tip operațiune ANAF */
export type TipOperatiuneAnaf = 20 | 40 | 41 | 50 | 51
// 20 = transport național
// 40 = achiziție intracomunitară (import UE)
// 41 = livrare intracomunitară (export UE)
// 50 = import (extra-UE)
// 51 = export (extra-UE)

export type TipVehicul = 1 | 2 | 3 | 4
// 1 = auto, 2 = naval, 3 = feroviar, 4 = aerian

export interface ETransportDeclarant {
  /** 1 = persoană fizică, 2 = persoană juridică */
  tipDeclarant: 1 | 2
  /** CIF fără prefix "RO" */
  codDeclarant: string
  denumireDeclarant: string
}

export interface ETransportPartener {
  codfiscal: string
  denumire: string
  codJudet: string
  localitate: string
  /** ISO 3166-1 alpha-2 country code (RO for domestic) */
  codTara?: string
}

export interface ETransportBun {
  nrCrt: number
  denumire: string
  cantitate: number
  unitateMasura: string   // KGM, TNE, C62, ...
  valoareLeiFaraTva: number
  codTarifar?: string     // TARIC code (optional)
}

export interface ETransportDeclaratie {
  /** Reference unic intern — UUIDs work fine */
  codUnic: string
  dataCreeareDocument: string   // YYYY-MM-DD
  declarant: ETransportDeclarant
  codTipOp: TipOperatiuneAnaf
  /** 10 = comercial, 20 = execuție lucrări, 30 = altele */
  codScopOp: 10 | 20 | 30
  furnizor: ETransportPartener
  cumparator: ETransportPartener
  bunuri: ETransportBun[]
  dataTransport: string   // YYYY-MM-DD
  codJudetIncarcare: string
  locIncarcare: string
  codJudetDescarcare: string
  locDescarcare: string
  nrVehicul: string
  tipVehicul: TipVehicul
}

export interface ETransportUploadResponse {
  cod_UIT?: string
  ExecutionStatus?: string
  Errors?: Array<{ errorMessage: string }>
  index_incarcare?: number
}

export interface ETransportDeleteResponse {
  ExecutionStatus?: string
  Errors?: Array<{ errorMessage: string }>
}
