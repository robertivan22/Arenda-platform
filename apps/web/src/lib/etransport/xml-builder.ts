/**
 * ANAF e-Transport XML builder.
 *
 * Schema: mfp:anaf:dgti:etransport:declaratie:v2
 * Edge-compatible: pure string concatenation, no DOM.
 */

import type { ETransportDeclaratie } from './types'

function xe(v: string | number | null | undefined): string {
  if (v == null) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function m2(n: number): string {
  return n.toFixed(2)
}

export function buildETransportXml(d: ETransportDeclaratie): string {
  const bunuri = d.bunuri.map(b => `
    <LinieIncarcare
      nrCrt="${b.nrCrt}"
      denumire="${xe(b.denumire)}"
      cantitate="${m2(b.cantitate)}"
      unitateMasura="${xe(b.unitateMasura)}"
      valoareLeiFaraTva="${m2(b.valoareLeiFaraTva)}"${b.codTarifar ? `
      codTarifar="${xe(b.codTarifar)}"` : ''}
    />`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<E_Transport
  xmlns="mfp:anaf:dgti:etransport:declaratie:v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  codUnic="${xe(d.codUnic)}"
  dataCreeareDocument="${xe(d.dataCreeareDocument)}"
  tipDeclarant="${d.declarant.tipDeclarant}"
  codDeclarant="${xe(d.declarant.codDeclarant)}"
  denumireDeclarant="${xe(d.declarant.denumireDeclarant)}">
  <Operatiune
    codTipOp="${d.codTipOp}"
    codScopOp="${d.codScopOp}">
    <Furnizor
      codfiscal="${xe(d.furnizor.codfiscal)}"
      denumire="${xe(d.furnizor.denumire)}"
      codJudet="${xe(d.furnizor.codJudet)}"
      localitate="${xe(d.furnizor.localitate)}"${d.furnizor.codTara ? `
      codTara="${xe(d.furnizor.codTara)}"` : ''}
    />
    <Cumparator
      codfiscal="${xe(d.cumparator.codfiscal)}"
      denumire="${xe(d.cumparator.denumire)}"
      codJudet="${xe(d.cumparator.codJudet)}"
      localitate="${xe(d.cumparator.localitate)}"${d.cumparator.codTara ? `
      codTara="${xe(d.cumparator.codTara)}"` : ''}
    />
    <LiniiBunuri>${bunuri}
    </LiniiBunuri>
    <DateTransport
      codJudetCuTransp="${xe(d.codJudetIncarcare)}"
      localCuTransp="${xe(d.locIncarcare)}"
      codJudetDestTransp="${xe(d.codJudetDescarcare)}"
      localDestTransp="${xe(d.locDescarcare)}"
      dataTransport="${xe(d.dataTransport)}"
    />
    <Vehicul nrVehicul="${xe(d.nrVehicul)}" tipVehicul="${d.tipVehicul}"/>
  </Operatiune>
</E_Transport>`
}
