/**
 * scripts/import-siruta.ts
 *
 * Downloads the official SIRUTA 2025 CSV from data.gov.ro,
 * parses it, and bulk-upserts all records into the Supabase `siruta` table.
 *
 * Requirements:
 *   - Run the SQL migration (supabase-migration-siruta.sql) first
 *   - Set env vars in apps/web/.env.local:
 *       NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *       SUPABASE_SERVICE_ROLE_KEY=eyJ...   (NOT the anon key)
 *
 * Usage (from repo root):
 *   cd C:\Temp\arenda-platform
 *   npx tsx scripts/import-siruta.ts
 *
 * Install tsx if not present:
 *   pnpm add -D tsx --filter @arenda/web
 *   -- or globally:  npm install -g tsx
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// ─── Load env from apps/web/.env.local ───────────────────────────────────────
function loadEnv() {
  const envPath = join(process.cwd(), 'apps', 'web', '.env.local')
  if (!existsSync(envPath)) {
    console.error('❌  apps/web/.env.local not found.')
    console.error('    Create it with:')
    console.error('    NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co')
    console.error('    SUPABASE_SERVICE_ROLE_KEY=eyJ...')
    process.exit(1)
  }
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length > 0) {
      process.env[key.trim()] = rest.join('=').trim()
    }
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const SIRUTA_CSV_URL =
  'https://data.gov.ro/dataset/fcba1a54-cffd-422c-b3ac-920f63564085/resource/0ab29d86-302c-4cfa-b9b9-fd5c7ff90710/download/siruta_s1_2025.csv'

// ─── CSV parsing ──────────────────────────────────────────────────────────────
type CsvRow = Record<string, string>

function detectSeparator(headerLine: string): ';' | ',' {
  return (headerLine.match(/;/g) || []).length >= (headerLine.match(/,/g) || []).length ? ';' : ','
}

function splitCsvLine(line: string, sep: ';' | ','): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ } else inQuotes = !inQuotes
      continue
    }
    if (ch === sep && !inQuotes) { result.push(current); current = ''; continue }
    current += ch
  }
  result.push(current)
  return result
}

function parseCsv(text: string): CsvRow[] {
  const clean = text.replace(/^\uFEFF/, '')
  const lines = clean.split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const sep = detectSeparator(lines[0])
  const headers = splitCsvLine(lines[0], sep).map(h => h.trim())
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line, sep)
    const row: CsvRow = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim() })
    return row
  })
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function get(row: CsvRow, candidates: string[]): string | null {
  for (const c of candidates) {
    const nc = norm(c)
    const found = Object.entries(row).find(([k]) => norm(k) === nc)
    if (found && found[1] !== '') return found[1]
  }
  return null
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('⬇  Downloading SIRUTA CSV from data.gov.ro...')
  const res = await fetch(SIRUTA_CSV_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const csv = await res.text()

  console.log('🔍 Parsing CSV...')
  const rows = parseCsv(csv)

  const records = rows
    .map(row => {
      const code = get(row, ['siruta', 'cod_siruta', 'codsiruta', 'siruta_code', 'siruta_uat', 'cod']) ?? ''
      if (!code) return null
      return {
        code,
        name: get(row, ['denumire', 'name', 'nume', 'denumirea_unitatii', 'uat', 'localitate']),
        type: get(row, ['tip', 'type', 'tip_uat', 'tip_localitate']),
        county: get(row, ['judet', 'county', 'denumire_judet', 'judet_name']),
        parent_code: get(row, ['siruta_parinte', 'parent_siruta', 'cod_siruta_parinte', 'siruta_uat_parinte']),
        postal_code: get(row, ['cod_postal', 'postal_code', 'codpostal']),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  console.log(`✅ Parsed ${records.length} records`)

  // Bulk upsert in chunks of 500
  const CHUNK = 500
  let inserted = 0
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK)
    const { error } = await supabase.from('siruta').upsert(chunk, { onConflict: 'code' })
    if (error) {
      console.error(`❌ Error at chunk ${i}–${i + CHUNK}:`, error.message)
      process.exit(1)
    }
    inserted += chunk.length
    process.stdout.write(`\r   Uploaded ${inserted}/${records.length}...`)
  }

  console.log(`\n🎉 Done! ${inserted} SIRUTA records in Supabase.`)
}

main().catch(err => { console.error(err); process.exit(1) })
