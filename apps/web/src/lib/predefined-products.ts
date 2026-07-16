// Shared predefined products list — used for auto-seeding and dropdowns
// Used in: setari/page.tsx, configureaza-ferma/page.tsx, contracte/nou/page.tsx, arendatori/nou/page.tsx

export interface PredefinedProduct { name: string; cat: string; unit: string }

export const PREDEFINED_PRODUCTS: PredefinedProduct[] = [
  // Cereale
  { name: 'GRÂU COMUN de toamnă',     cat: 'Cereale',       unit: 'kg' },
  { name: 'GRÂU dur de toamnă',       cat: 'Cereale',       unit: 'kg' },
  { name: 'GRÂU de primăvară',        cat: 'Cereale',       unit: 'kg' },
  { name: 'ORZ de toamnă',            cat: 'Cereale',       unit: 'kg' },
  { name: 'ORZ de primăvară',         cat: 'Cereale',       unit: 'kg' },
  { name: 'ORZOAICĂ de toamnă',       cat: 'Cereale',       unit: 'kg' },
  { name: 'ORZOAICĂ de primăvară',    cat: 'Cereale',       unit: 'kg' },
  { name: 'TRITICALE de toamnă',      cat: 'Cereale',       unit: 'kg' },
  { name: 'SECARĂ de toamnă',         cat: 'Cereale',       unit: 'kg' },
  { name: 'OVĂZ',                     cat: 'Cereale',       unit: 'kg' },
  { name: 'OREZ',                     cat: 'Cereale',       unit: 'kg' },
  // Prășitoare
  { name: 'PORUMB',                   cat: 'Prășitoare',    unit: 'kg' },
  { name: 'SFECLĂ DE ZAHĂR',          cat: 'Prășitoare',    unit: 'kg' },
  { name: 'CARTOF',                   cat: 'Prășitoare',    unit: 'kg' },
  // Oleaginoase
  { name: 'FLOAREA SOARELUI',         cat: 'Oleaginoase',   unit: 'kg' },
  { name: 'RAPIȚĂ de toamnă',         cat: 'Oleaginoase',   unit: 'kg' },
  { name: 'SOIA',                     cat: 'Oleaginoase',   unit: 'kg' },
  { name: 'IN pentru semințe',        cat: 'Oleaginoase',   unit: 'kg' },
  { name: 'CÂNEPĂ',                   cat: 'Oleaginoase',   unit: 'kg' },
  // Leguminoase
  { name: 'MAZĂRE de câmp',           cat: 'Leguminoase',   unit: 'kg' },
  { name: 'FASOLE',                   cat: 'Leguminoase',   unit: 'kg' },
  { name: 'BOB de câmp',              cat: 'Leguminoase',   unit: 'kg' },
  // Furaje
  { name: 'LUCERNĂ',                  cat: 'Furaje',        unit: 'kg' },
  { name: 'LUCERNĂ AMESTEC',          cat: 'Furaje',        unit: 'kg' },
  { name: 'PLANTE DE NUTREȚ',         cat: 'Furaje',        unit: 'kg' },
  { name: 'TRIFOI',                   cat: 'Furaje',        unit: 'kg' },
  { name: 'IARBĂ',                    cat: 'Furaje',        unit: 'kg' },
  // Alte culturi
  { name: 'LEGUME diverse',           cat: 'Alte culturi',  unit: 'kg' },
  { name: 'LIVADĂ / POMI FRUCTIFERI', cat: 'Alte culturi',  unit: 'buc' },
  { name: 'VIE',                      cat: 'Alte culturi',  unit: 'kg' },
  { name: 'TEREN NECULTIVAT',         cat: 'Alte culturi',  unit: 'ha' },
  { name: 'ZONE TAMPON',              cat: 'Alte culturi',  unit: 'ha' },
  { name: 'PĂȘUNE',                   cat: 'Alte culturi',  unit: 'ha' },
  { name: 'FÂNEAȚĂ',                  cat: 'Alte culturi',  unit: 'kg' },
  // Monetar
  { name: 'RON',                      cat: 'Monetar',       unit: 'ron' },
  { name: 'EUR',                      cat: 'Monetar',       unit: 'eur' },
]

export const PRODUCT_CATEGORIES = Array.from(new Set(PREDEFINED_PRODUCTS.map(p => p.cat)))

/** Map from product name → category (for grouping DB products in dropdowns) */
export const PRODUCT_CAT_MAP = new Map(PREDEFINED_PRODUCTS.map(p => [p.name, p.cat]))

/** Get category for a product name — returns 'Alte culturi' for unknown names */
export function productCategory(name: string): string {
  return PRODUCT_CAT_MAP.get(name) ?? 'Altele'
}
