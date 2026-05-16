/**
 * Seed TaxRuleVersion records for arendă fiscal calculations.
 *
 * Run: pnpm --filter api exec ts-node -r tsconfig-paths/register prisma/seed/tax-rules.seed.ts
 *
 * Rules are INSERT OR SKIP — safe to run multiple times.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const rules: Array<{
  ruleType: string
  validFrom: Date
  validTo: Date | null
  payloadJson: Record<string, unknown>
  description: string
}> = [
  // ── ARENDA_WITHHOLDING 2024 ──────────────────────────────────────────────
  {
    ruleType: 'ARENDA_WITHHOLDING',
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2024-12-31'),
    description: 'Impozit reținut la sursă pe venituri din arendă — 2024',
    payloadJson: {
      flatDeductionPct: 20,           // 20% cheltuieli forfetare (art. 72 CF)
      withholdingRate: 10,            // 10% din venitul net
      effectiveTaxRate: 8,            // rezultat: 8% din brut
      legalBasis:
        'Legea 227/2015 Cod Fiscal, art. 84 (venitul net), art. 101 (reținere la sursă). ' +
        'OUG 115/2023 — aplicabil 2024.',
      notes:
        'Cheltuiala forfetară de 20% reduce baza impozabilă. ' +
        'Impozitul de 10% se aplică venitului net (brut × 80%). ' +
        'Rezultat efectiv: 8% din venitul brut.',
    },
  },
  // ── ARENDA_WITHHOLDING 2025 ──────────────────────────────────────────────
  // ⚠️ Verificați legislația pentru 2025 și actualizați această regulă.
  {
    ruleType: 'ARENDA_WITHHOLDING',
    validFrom: new Date('2025-01-01'),
    validTo: null,  // open-ended until changed
    description: 'Impozit reținut la sursă pe venituri din arendă — 2025 (necesită verificare)',
    payloadJson: {
      flatDeductionPct: 20,
      withholdingRate: 10,
      effectiveTaxRate: 8,
      legalBasis:
        'Legea 227/2015 Cod Fiscal, art. 84, art. 101. ' +
        '⚠️ Verificați dacă au intervenit modificări legislative pentru 2025.',
      notes: 'Regulă provizorie — validați cu contabilul autorizat pentru conformitate 2025.',
    },
  },
  // ── CASS_ARENDA 2024 ─────────────────────────────────────────────────────
  {
    ruleType: 'CASS_ARENDA',
    validFrom: new Date('2024-01-01'),
    validTo: new Date('2024-12-31'),
    description: 'CASS pe venituri din arendă (alte venituri) — 2024',
    payloadJson: {
      cassRate: 10,                   // 10% CASS (art. 156 CF)
      minBaseMultiplier: 6,           // prag minim: 6 × salariu minim
      maxBaseMultiplier: 60,          // prag maxim: 60 × salariu minim
      minWage: 3300,                  // salariu minim brut 2024 (01.10.2023 - prezent)
      minCassBase: 19800,             // 6 × 3300
      maxCassBase: 198000,            // 60 × 3300
      legalBasis:
        'Legea 227/2015 Cod Fiscal, art. 155, art. 170. ' +
        'OUG 115/2023 — modificări 2024. ' +
        'HG 1/2023 — salariu minim brut 3300 RON (de la 01.10.2023).',
      notes:
        'CASS se datorează dacă venitul NET ANUAL din TOATE sursele depășește 6 × salariul minim. ' +
        'Sistemul generează NUMAI AVERTIZĂRI — obligația finală necesită analiza tuturor veniturilor ' +
        'arendatorului de către acesta sau contabilul său. Arendatorul depune D212.',
      applicabilityNote:
        'ATENȚIE: Sistemul NU poate determina obligația finală CASS fără a cunoaște ' +
        'totalitatea veniturilor arendatorului din toate sursele.',
    },
  },
  // ── CASS_ARENDA 2025 ─────────────────────────────────────────────────────
  {
    ruleType: 'CASS_ARENDA',
    validFrom: new Date('2025-01-01'),
    validTo: null,
    description: 'CASS pe venituri din arendă (alte venituri) — 2025 (necesită verificare)',
    payloadJson: {
      cassRate: 10,
      minBaseMultiplier: 6,
      maxBaseMultiplier: 60,
      minWage: 3700,                  // salariu minim brut 2025 — verificați HG aplicabil
      minCassBase: 22200,
      maxCassBase: 222000,
      legalBasis:
        'Legea 227/2015 Cod Fiscal, art. 155, art. 170. ' +
        '⚠️ Verificați modificările legislative și salariul minim brut pentru 2025.',
      notes: 'Regulă provizorie — actualizați minWage pe baza HG aplicabil 2025.',
      applicabilityNote:
        'ATENȚIE: Sistemul NU poate determina obligația finală CASS. ' +
        'Arendatorul depune D212.',
    },
  },
]

async function main() {
  console.log('🌱 Seeding tax rules...')

  for (const rule of rules) {
    // Skip if a rule with same type+validFrom already exists
    const existing = await prisma.taxRuleVersion.findFirst({
      where: { ruleType: rule.ruleType, validFrom: rule.validFrom },
    })
    if (existing) {
      console.log(`  ⏩ Skipping existing: ${rule.ruleType} ${rule.validFrom.toISOString().split('T')[0]}`)
      continue
    }

    const created = await prisma.taxRuleVersion.create({
      data: {
        ruleType: rule.ruleType,
        validFrom: rule.validFrom,
        validTo: rule.validTo,
        payloadJson: rule.payloadJson,
        description: rule.description,
      },
    })
    console.log(`  ✅ Created: ${created.ruleType} ${rule.validFrom.toISOString().split('T')[0]} (ID: ${created.id})`)
  }

  console.log('✅ Tax rules seed complete.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
