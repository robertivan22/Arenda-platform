// Deterministic TARIC classifier for agricultural machinery
// Based on HS chapter 8432 (soil/cultivation), 8433 (harvesting), 8701 (tractors)

export interface TaricCandidate {
  code: string
  description: string
  confidence: number
  requiresManualReview: boolean
  reason: string
}

// HP to kW conversion
function hpToKw(hp: number): number {
  return hp * 0.7457
}

export function classifyMachine(params: {
  type: string
  engine_hp?: number | null
  brand?: string | null
  model?: string | null
  name?: string | null
}): TaricCandidate {
  const { type, engine_hp } = params
  const name = (params.name ?? '').toLowerCase()
  const model = (params.model ?? '').toLowerCase()

  // ── Tractors ──────────────────────────────────────────────────────────────
  if (type === 'TRACTOR') {
    const kw = engine_hp ? hpToKw(engine_hp) : null

    // Tracked tractor keywords
    if (name.includes('senilă') || name.includes('senile') || model.includes('track') || model.includes('crawler')) {
      return { code: '8701300000', description: 'Tractoare cu șenile', confidence: 0.85, requiresManualReview: false, reason: 'Tracked tractor detected from name/model.' }
    }

    if (kw !== null) {
      if (kw <= 18)  return { code: '8701911000', description: 'Tractoare agricole cu roți ≤ 18 kW',       confidence: 0.92, requiresManualReview: false, reason: `Engine power ${engine_hp} CP = ${kw.toFixed(1)} kW ≤ 18 kW.` }
      if (kw <= 37)  return { code: '8701921000', description: 'Tractoare agricole cu roți > 18 și ≤ 37 kW', confidence: 0.92, requiresManualReview: false, reason: `Engine power ${engine_hp} CP = ${kw.toFixed(1)} kW, band 18–37 kW.` }
      if (kw <= 75)  return { code: '8701931000', description: 'Tractoare agricole cu roți > 37 și ≤ 75 kW', confidence: 0.92, requiresManualReview: false, reason: `Engine power ${engine_hp} CP = ${kw.toFixed(1)} kW, band 37–75 kW.` }
      if (kw <= 130) return { code: '8701941000', description: 'Tractoare agricole cu roți > 75 și ≤ 130 kW', confidence: 0.92, requiresManualReview: false, reason: `Engine power ${engine_hp} CP = ${kw.toFixed(1)} kW, band 75–130 kW.` }
      return { code: '8701951000', description: 'Tractoare agricole cu roți > 130 kW', confidence: 0.92, requiresManualReview: false, reason: `Engine power ${engine_hp} CP = ${kw.toFixed(1)} kW > 130 kW.` }
    }

    // No HP — can't determine band
    return { code: '8701941000', description: 'Tractoare agricole cu roți (bandă kW necunoscută)', confidence: 0.45, requiresManualReview: true, reason: 'Tractor type but engine power not specified. Verify kW band manually.' }
  }

  // ── Combine harvesters ────────────────────────────────────────────────────
  if (type === 'COMBINA') {
    return { code: '8433510000', description: 'Combine harvester / Combină pentru recoltat cereale', confidence: 0.88, requiresManualReview: false, reason: 'Combine harvester type.' }
  }

  // ── Seeders / planters ────────────────────────────────────────────────────
  if (type === 'SEMANATOARE') {
    if (name.includes('precizie') || model.includes('precisie') || model.includes('precision')) {
      return { code: '8432391100', description: 'Semănătoare de precizie', confidence: 0.85, requiresManualReview: false, reason: 'Precision seeder detected from name/model.' }
    }
    if (name.includes('no-till') || name.includes('directă') || name.includes('direct')) {
      return { code: '8432310000', description: 'Semănătoare directă (no-till)', confidence: 0.88, requiresManualReview: false, reason: 'No-till seeder detected.' }
    }
    return { code: '8432399000', description: 'Semănătoare / Plantatoare', confidence: 0.80, requiresManualReview: false, reason: 'Generic seeder type.' }
  }

  // ── Sprayers / fertilizer equipment ──────────────────────────────────────
  if (type === 'STROPITOARE') {
    if (name.includes('fertiliz') || name.includes('îngrășă') || name.includes('ingrasam')) {
      return { code: '8432420000', description: 'Distribuitor de îngrășăminte', confidence: 0.82, requiresManualReview: false, reason: 'Fertilizer spreader detected from name.' }
    }
    return { code: '8432420000', description: 'Mașină de stropit / distribuit', confidence: 0.75, requiresManualReview: false, reason: 'Sprayer/distributor type.' }
  }

  // ── Trailers ─────────────────────────────────────────────────────────────
  if (type === 'REMORCA') {
    return { code: '8716390000', description: 'Remorcă agricolă', confidence: 0.82, requiresManualReview: false, reason: 'Agricultural trailer type.' }
  }

  // ── Other — try keyword matching ─────────────────────────────────────────
  const keywords: Array<[string, string, string]> = [
    ['plug',         '8432100000', 'Plug / Plow'],
    ['plow',         '8432100000', 'Plug / Plow'],
    ['disc',         '8432210000', 'Grapă cu disc'],
    ['grapă',        '8432291000', 'Grapă / Cultivator'],
    ['cultivator',   '8432291000', 'Grapă / Cultivator'],
    ['motosapă',     '8432295000', 'Motosapă'],
    ['baler',        '8433400000', 'Presă de balotat'],
    ['balotat',      '8433400000', 'Presă de balotat'],
    ['cositor',      '8433200000', 'Coasă / Cositor'],
    ['mower',        '8433200000', 'Coasă / Cositor'],
  ]

  for (const [kw, code, desc] of keywords) {
    if (name.includes(kw) || model.includes(kw)) {
      return { code, description: desc, confidence: 0.72, requiresManualReview: false, reason: `Keyword "${kw}" matched in name/model.` }
    }
  }

  return {
    code: '8432800000',
    description: 'Alte mașini pentru pregătirea solului (cod generic)',
    confidence: 0.30,
    requiresManualReview: true,
    reason: 'Could not determine specific TARIC code. Manual review required.',
  }
}
