'use client'

// Browser-only component — only imported inside MapParcelSelector (ssr:false)
import { useState, useCallback, useRef } from 'react'
import {
  Upload, X, AlertTriangle, CheckCircle2, FileArchive, FileJson,
  ChevronRight, Loader2, Eye, RotateCcw, Info, Save, CheckCheck, Database,
} from 'lucide-react'
import { area as turfArea } from '@turf/area'
import { kinks as turfKinks } from '@turf/kinks'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ringWgs84ToStereo70, stereo70ToLeaflet, centroidStereo70 } from '@/lib/stereo70'
// GeoJSON namespace types come from @types/geojson (transitive dep of @types/leaflet)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedFeature {
  idx: number
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  attributes: Record<string, unknown>
  areaHa: number          // calculated from geometry
  declaredHa: number | null  // from DBF (best-guess field)
  diffPct: number | null  // % diff (calc - declared) / declared
  isValid: boolean
  validationMsg?: string
}

export interface FieldMapping {
  // Generic fields (all shapefiles)
  bloc_fizic: string    // → parcels.bloc_fizic
  suprafata_ha: string  // → parcels.surface ('' = use calculated)
  cultura: string       // → parcels.culture
  judet: string         // → parcels.county
  localitate: string    // → parcels.locality
  cod_parcela: string   // → parcels.parcel_nr (legacy)
  // APIA 1:1 fields
  farm_id: string       // → parcels.apia_farm_id
  year: string          // → parcels.apia_year
  siruta: string        // → parcels.siruta
  commune: string       // → parcels.locality (overrides localitate for APIA)
  bloc_nr: string       // → parcels.bloc_fizic (overrides bloc_fizic for APIA)
  parcel_nr: string     // → parcels.parcel_nr
  crop_nr: string       // → parcels.crop_nr
  cat_use: string       // → parcels.land_use_category
  crop_code: string     // → parcels.crop_code
  crop_name: string     // → parcels.culture (overrides cultura for APIA)
  area_dec: string      // → parcels.surface (overrides suprafata_ha for APIA)
  agro_env: string      // → parcels.agro_env
  comment: string       // → parcels.apia_comment
  inserted: string      // → parcels.apia_inserted
  updated: string       // → parcels.apia_updated
  status: string        // → parcels.status (APIA: 1=ACTIVE, 0=INACTIVE)
  full_bloc: string     // → parcels.full_bloc
}

interface SaveResult {
  idx: number
  name: string
  status: 'pending' | 'saving' | 'ok' | 'error'
  error?: string
}

const MAPPING_KEY = 'arenda_import_field_mapping_v3'

/** Default mapping for generic (non-APIA) shapefiles */
const DEFAULT_MAPPING: FieldMapping = {
  bloc_fizic: 'BLOC_FIZIC', suprafata_ha: 'SUPRAFATA',
  cultura: 'CULTURA', judet: 'JUDET', localitate: 'LOCALITATE', cod_parcela: 'NR_PARCEL',
  // APIA fields — empty until auto-detected
  farm_id: '', year: '', siruta: '', commune: '', bloc_nr: '', parcel_nr: '',
  crop_nr: '', cat_use: '', crop_code: '', crop_name: '', area_dec: '',
  agro_env: '', comment: '', inserted: '', updated: '', status: '', full_bloc: '',
}

/** 1:1 auto-mapping for APIA shapefiles (column names match exactly) */
const APIA_AUTO_MAPPING: FieldMapping = {
  bloc_fizic: 'bloc_nr', suprafata_ha: 'area_dec',
  cultura: 'crop_name', judet: 'judet', localitate: 'commune', cod_parcela: 'parcel_nr',
  farm_id: 'farm_id', year: 'year', siruta: 'siruta', commune: 'commune',
  bloc_nr: 'bloc_nr', parcel_nr: 'parcel_nr', crop_nr: 'crop_nr',
  cat_use: 'cat_use', crop_code: 'crop_code', crop_name: 'crop_name',
  area_dec: 'area_dec', agro_env: 'agro_env', comment: 'comment',
  inserted: 'inserted', updated: 'updated', status: 'status', full_bloc: 'full_bloc',
}

/** APIA shapefiles have these characteristic columns */
const APIA_SIGNATURE_COLS = ['farm_id', 'year', 'bloc_nr', 'parcel_nr', 'crop_name', 'area_dec']

function isApiaShapefile(cols: string[]): boolean {
  const lower = cols.map(c => c.toLowerCase())
  const hits = APIA_SIGNATURE_COLS.filter(s => lower.includes(s.toLowerCase()))
  return hits.length >= 4
}

function loadMapping(): FieldMapping {
  try {
    const raw = localStorage.getItem(MAPPING_KEY)
    if (raw) return { ...DEFAULT_MAPPING, ...JSON.parse(raw) as FieldMapping }
  } catch { /* ignore */ }
  return DEFAULT_MAPPING
}

function saveMapping(m: FieldMapping) {
  try { localStorage.setItem(MAPPING_KEY, JSON.stringify(m)) } catch { /* ignore */ }
}

interface ImportWizardModalProps {
  open: boolean
  onClose: () => void
  /** Called with GeoJSON when user clicks Preview (closes wizard, shows on map) */
  onPreview: (fc: GeoJSON.FeatureCollection, features: ParsedFeature[]) => void
  /** Potentially vertex-edited FC from the map — used instead of rawFC for saving */
  currentFC?: GeoJSON.FeatureCollection
  /** Called after all features saved successfully */
  onSaveComplete?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectDeclaredAreaHa(attrs: Record<string, unknown>): number | null {
  // Common APIA / IPA Online / ANCPI field names
  const haFields = ['area_dec', 'AREA_DEC', 'SUPRAFATA', 'Suprafata', 'suprafata', 'AREA_HA', 'area_ha', 'SP_HA', 'GIS_AREA']
  const m2Fields = ['Shape_Area', 'shape_area', 'AREA', 'area', 'AREA_M2']
  for (const k of haFields) {
    const v = attrs[k]
    if (v != null && !isNaN(Number(v)) && Number(v) > 0) return Number(v)
  }
  for (const k of m2Fields) {
    const v = attrs[k]
    if (v != null && !isNaN(Number(v)) && Number(v) > 0) {
      const n = Number(v)
      return n > 500 ? n / 10000 : n // assume m² if > 500
    }
  }
  return null
}

function fmt2(n: number) { return n.toFixed(2) }
function fmtPct(n: number) {
  const s = (n > 0 ? '+' : '') + n.toFixed(1) + '%'
  return s
}

/** APIA official crop color palette */
export const APIA_CROP_COLORS: Record<string, string> = {
  'PORUMB':                '#f59e0b',
  'FLOAREA SOARELUI':      '#f97316',
  'GRÂU COMUN de toamnă': '#fbbf24',
  'GRÂU':                  '#fbbf24',
  'ORZOAICĂ de toamnă':   '#84cc16',
  'ORZ de toamnă':         '#22c55e',
  'ORZ':                   '#22c55e',
  'LUCERNĂ':              '#10b981',
  'LUCERNĂ AMESTEC':      '#06b6d4',
  'PLANTE DE NUTREŢ':     '#3b82f6',
  'SOIA':                  '#8b5cf6',
  'RAPIŢĂ':               '#a3e635',
  'SFECLĂ DE ZAHĂR':      '#ec4899',
  'CARTOF':                '#d97706',
  'TEREN NECULTIVAT':      '#94a3b8',
  'ZONE TAMPON':           '#cbd5e1',
  'PAȘUNE':               '#86efac',
  'FÂNEAŢ':               '#4ade80',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportWizardModal({ open, onClose, onPreview, currentFC, onSaveComplete }: ImportWizardModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'mapping' | 'saving' | 'done'>('upload')
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [features, setFeatures] = useState<ParsedFeature[]>([])
  const [rawFC, setRawFC] = useState<GeoJSON.FeatureCollection | null>(null)
  const [fileName, setFileName] = useState('')
  const [columnNames, setColumnNames] = useState<string[]>([])
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>(loadMapping)
  const [saveResults, setSaveResults] = useState<SaveResult[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Parse uploaded file ───────────────────────────────────────────────────

  const parseFile = useCallback(async (file: File) => {
    setParsing(true)
    setParseError(null)
    setFileName(file.name)

    try {
      let fc: GeoJSON.FeatureCollection

      const nameLower = file.name.toLowerCase()
      const isZip = nameLower.endsWith('.zip') || file.type === 'application/zip'
        || file.type === 'application/x-zip-compressed'
      const isGeoJSON = nameLower.endsWith('.geojson') || nameLower.endsWith('.json')
      const isKML = nameLower.endsWith('.kml')

      if (isZip) {
        // Dynamic import — shpjs is heavy, load on demand
        const { default: shp } = await import('shpjs')
        const ab = await file.arrayBuffer()
        const result = await shp(ab)
        if (Array.isArray(result)) {
          fc = {
            type: 'FeatureCollection',
            features: result.flatMap((r: GeoJSON.FeatureCollection) => r.features ?? []),
          }
        } else {
          fc = result as GeoJSON.FeatureCollection
        }
      } else if (isGeoJSON) {
        const text = await file.text()
        const parsed = JSON.parse(text) as { type: string; features?: GeoJSON.Feature[]; geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon; coordinates?: unknown }
        if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
          fc = parsed as GeoJSON.FeatureCollection
        } else if (parsed.type === 'Feature') {
          fc = { type: 'FeatureCollection', features: [parsed as GeoJSON.Feature] }
        } else if (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon') {
          fc = {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: parsed as GeoJSON.Polygon | GeoJSON.MultiPolygon, properties: {} }],
          }
        } else {
          throw new Error('Format GeoJSON nerecunoscut. Așteptăm GeoJSON.FeatureCollection, GeoJSON.Feature sau Polygon/MultiPolygon.')
        }
      } else if (isKML) {
        throw new Error(
          'KML: suport disponibil în curând. ' +
          'Deocamdată exportați din Google Earth ca GeoJSON și importați fișierul .geojson.'
        )
      } else {
        throw new Error(
          `Format nesuportat: "${file.name}". ` +
          'Acceptăm: .zip (Shapefile ESRI), .geojson, .json'
        )
      }

      const validFeatures = (fc.features ?? []).filter(f => f?.geometry != null)
      if (validFeatures.length === 0) {
        throw new Error('Fișierul nu conține niciun poligon / GeoJSON.Feature.')
      }

      // Collect all attribute column names (from first few features)
      const colSet = new Set<string>()
      validFeatures.slice(0, 20).forEach(f => {
        Object.keys(f.properties ?? {}).forEach(k => colSet.add(k))
      })
      const detectedCols = Array.from(colSet)
      setColumnNames(detectedCols)

      // Auto-apply APIA mapping if this looks like an APIA shapefile
      if (isApiaShapefile(detectedCols)) {
        setFieldMapping(APIA_AUTO_MAPPING)
        saveMapping(APIA_AUTO_MAPPING)
      }

      // Parse each GeoJSON.Feature
      const parsed: ParsedFeature[] = validFeatures.map((f, idx) => {
        const attrs = (f.properties ?? {}) as Record<string, unknown>
        const geom = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon

        const calcAreaM2 = turfArea(f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)
        const calcAreaHa = calcAreaM2 / 10000
        const declaredHa = detectDeclaredAreaHa(attrs)
        const diffPct = declaredHa != null && declaredHa > 0
          ? ((calcAreaHa - declaredHa) / declaredHa) * 100
          : null

        let isValid = true
        let validationMsg: string | undefined

        // Area sanity
        if (calcAreaHa <= 0) {
          isValid = false
          validationMsg = 'Suprafață calculată 0 — geometrie invalidă'
        } else if (calcAreaHa > 10000) {
          isValid = false
          validationMsg = `Suprafață prea mare: ${fmt2(calcAreaHa)} ha (max 10 000 ha)`
        }

        // Self-intersection check (only Polygon/MultiPolygon)
        if (isValid && (geom.type === 'Polygon' || geom.type === 'MultiPolygon')) {
          try {
            const kResult = turfKinks(f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>)
            if (kResult.features.length > 0) {
              isValid = false
              validationMsg = `Auto-intersecție detectată (${kResult.features.length} punct${kResult.features.length > 1 ? 'e' : ''})`
            }
          } catch {
            // non-blocking — kinks can fail on complex geometries
          }
        }

        // Area deviation warning (not invalid, just flagged)
        if (isValid && diffPct != null && Math.abs(diffPct) > 10) {
          validationMsg = `Diferență de ${fmtPct(diffPct)} față de suprafața declarată`
        }

        return { idx, geometry: geom, attributes: attrs, areaHa: calcAreaHa, declaredHa, diffPct, isValid, validationMsg }
      })

      setFeatures(parsed)
      setRawFC({ ...fc, features: validFeatures })
      setStep('preview')
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Eroare necunoscută la parsare.')
    } finally {
      setParsing(false)
    }
  }, [])

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void parseFile(file)
  }, [parseFile])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void parseFile(file)
    // Reset so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [parseFile])

  function handlePreviewOnMap() {
    if (rawFC) onPreview(rawFC, features)
  }

  function reset() {
    setStep('upload')
    setFeatures([])
    setRawFC(null)
    setParseError(null)
    setFileName('')
    setColumnNames([])
    setSaveResults([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Save to database ──────────────────────────────────────────────────────

  async function handleSave() {
    const fcToSave = currentFC ?? rawFC
    if (!fcToSave) return
    setIsSaving(true)

    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Neautentificat — reîncarcă pagina.'); setIsSaving(false); return }

    const initial: SaveResult[] = fcToSave.features.map((_, i) => ({
      idx: i, name: `Parcelă ${i + 1}`, status: 'pending',
    }))
    setSaveResults(initial)
    setStep('saving')

    const results = [...initial]
    const isApia = isApiaShapefile(columnNames)

    for (let i = 0; i < fcToSave.features.length; i++) {
      results[i] = { ...results[i], status: 'saving' }
      setSaveResults([...results])

      try {
        const f = fcToSave.features[i]
        const attrs = (f.properties ?? {}) as Record<string, unknown>

        // ── Helpers ──────────────────────────────────────────────────────
        const getStr = (col: string): string | null =>
          col && attrs[col] != null ? String(attrs[col]).trim() || null : null
        const getNum = (col: string): number | null => {
          if (!col || attrs[col] == null) return null
          const n = Number(attrs[col])
          return isNaN(n) ? null : n
        }
        const getInt = (col: string): number | null => {
          const n = getNum(col)
          return n != null ? Math.round(n) : null
        }
        /** APIA date: 'YYYYMMDD' → 'YYYY-MM-DD' */
        const getDate = (col: string): string | null => {
          if (!col || attrs[col] == null) return null
          const raw = String(attrs[col]).trim()
          if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
          return raw || null
        }
        /** APIA agro_env: 'da'/'nu' → boolean */
        const getBool = (col: string): boolean | null => {
          if (!col || attrs[col] == null) return null
          const v = String(attrs[col]).toLowerCase().trim()
          if (v === 'da' || v === '1' || v === 'true') return true
          if (v === 'nu' || v === '0' || v === 'false') return false
          return null
        }
        /** APIA status: 1.0 → 'ACTIVE', 0.0 → 'INACTIVE' */
        const getStatus = (col: string): string => {
          if (!col || attrs[col] == null) return 'ACTIVE'
          const n = Number(attrs[col])
          return !isNaN(n) && n === 0 ? 'INACTIVE' : 'ACTIVE'
        }

        // ── Resolved values ───────────────────────────────────────────────
        const blocNr = getStr(fieldMapping.bloc_nr)
        const parcelNrStr = getStr(fieldMapping.parcel_nr) ?? getStr(fieldMapping.cod_parcela)
        const cropName = getStr(fieldMapping.crop_name) ?? getStr(fieldMapping.cultura)
        const cropNr = getStr(fieldMapping.crop_nr)

        // For APIA: bloc_fizic = raw bloc_nr (e.g. "AG001"), NOT a formatted string
        const bloc_fizic = isApia
          ? (blocNr ?? `Parcelă import ${i + 1}`)
          : (getStr(fieldMapping.bloc_fizic) || `Parcelă import ${i + 1}`)

        const judet     = getStr(fieldMapping.judet)
        const localitate = isApia
          ? (getStr(fieldMapping.commune) ?? getStr(fieldMapping.localitate))
          : getStr(fieldMapping.localitate)

        const suprafataDeclared = isApia
          ? getNum(fieldMapping.area_dec)
          : getNum(fieldMapping.suprafata_ha)
        const calcArea = turfArea(f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>) / 10000
        const suprafata = suprafataDeclared && suprafataDeclared > 0 ? suprafataDeclared : calcArea

        // APIA crop color for map legend
        const apiaColor = cropName ? APIA_CROP_COLORS[cropName] ?? null : null

        results[i].name = bloc_fizic

        // ── Geometry: WGS84 ring for map + Stereo70 for parcele_fitosanitar ──
        const geom = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
        let ringWgs84: number[][]
        if (geom.type === 'Polygon') {
          ringWgs84 = geom.coordinates[0] as number[][]
        } else {
          let biggest = geom.coordinates[0][0] as number[][]
          for (const poly of geom.coordinates) {
            if (poly[0].length > biggest.length) biggest = poly[0] as number[][]
          }
          ringWgs84 = biggest
        }
        const ringStereo = ringWgs84ToStereo70(ringWgs84 as [number, number][])
        const geometryStereo70 = { type: 'Polygon' as const, coordinates: [ringStereo] }
        const geomWgs84 = { type: 'Polygon' as const, coordinates: [ringWgs84] }
        const [cx, cy] = centroidStereo70(ringStereo)
        const [centruLat, centruLng] = stereo70ToLeaflet(cx, cy)

        // ── 1. Insert parcele_fitosanitar (map polygon in Stereo 70) ─────
        const { data: mapParcel, error: mapErr } = await db
          .from('parcele_fitosanitar')
          .insert({
            user_id: user.id,
            nume_parcela: bloc_fizic,
            geometry_geojson: geometryStereo70,
            centru_lat: centruLat,
            centru_lng: centruLng,
            suprafata_ha: suprafata,
            judet: judet ?? null,
            localitate: localitate ?? null,
            cultura_label: cropName ?? null,
            cultura_color: apiaColor ?? null,
          })
          .select('id').single()

        if (mapErr) throw new Error(`Hartă: ${mapErr.message}`)

        // ── 2. Insert parcels registry ────────────────────────────────────
        // Base payload: always-present columns (safe without APIA migration)
        const basePayload = {
          user_id: user.id,
          bloc_fizic,
          parcel_nr: parcelNrStr ?? null,
          // APIA files have no "tarla" concept — tarla_nr stays null
          tarla_nr: null,
          county: judet ?? null,
          locality: localitate ?? null,
          land_use_category: getStr(fieldMapping.cat_use) ?? null,
          culture: cropName ?? null,
          surface: suprafata,
          status: isApia ? getStatus(fieldMapping.status) : 'ACTIVE',
          lat: centruLat,
          lng: centruLng,
          // Save siruta to the standard column (siruta_code) so parcel list shows it
          siruta_code: isApia ? (getStr(fieldMapping.siruta) ?? null) : null,
        }
        // APIA extras: only available after supabase-migration-apia-fields.sql
        const apiaPayload = isApia ? {
          apia_farm_id:  getStr(fieldMapping.farm_id),
          apia_year:     getInt(fieldMapping.year),
          siruta:        getStr(fieldMapping.siruta),
          crop_nr:       cropNr,
          crop_code:     getInt(fieldMapping.crop_code),
          agro_env:      getBool(fieldMapping.agro_env),
          full_bloc:     getInt(fieldMapping.full_bloc),
          apia_comment:  getStr(fieldMapping.comment),
          apia_inserted: getDate(fieldMapping.inserted),
          apia_updated:  getDate(fieldMapping.updated),
          geom_geojson:  geomWgs84,
          centru_lat:    centruLat,
          centru_lng:    centruLng,
        } : {}

        // Try full insert first; fall back to base if APIA columns don't exist
        let regParcelId: string | null = null
        const fullRes = await db.from('parcels')
          .insert({ ...basePayload, ...apiaPayload })
          .select('id').single()

        if (fullRes.error) {
          console.warn('[Import] Full insert failed, retrying with base fields:', fullRes.error.message)
          const baseRes = await db.from('parcels')
            .insert(basePayload)
            .select('id').single()
          if (baseRes.error) {
            // Both failed — clean up orphaned polygon and surface the real error
            await db.from('parcele_fitosanitar').delete().eq('id', mapParcel.id)
            throw new Error(baseRes.error.message)
          }
          regParcelId = baseRes.data?.id ?? null
        } else {
          regParcelId = fullRes.data?.id ?? null
        }

        // ── 3. Link map polygon → registry parcel ────────────────────────
        if (regParcelId && mapParcel) {
          const { error: linkErr } = await db.from('parcele_fitosanitar')
            .update({ parcela_id: regParcelId })
            .eq('id', mapParcel.id)
          if (linkErr) console.warn('[Import] Link error:', linkErr.message)
        }

        results[i] = { ...results[i], status: 'ok' }
      } catch (err) {
        results[i] = {
          ...results[i], status: 'error',
          error: err instanceof Error ? err.message : 'Eroare',
        }
      }
      setSaveResults([...results])
    }

    setIsSaving(false)
    const ok = results.filter(r => r.status === 'ok').length
    const err = results.filter(r => r.status === 'error').length
    if (ok > 0) { toast.success(`${ok} parcel${ok !== 1 ? 'e' : 'ă'} importate!`); onSaveComplete?.() }
    if (err > 0) toast.error(`${err} parcel${err !== 1 ? 'e' : 'ă'} cu erori.`)
    // Stay on 'saving' step so user sees the result log
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  const fcToUse = currentFC ?? rawFC
  const totalHa = features.reduce((s, f) => s + f.areaHa, 0)
  const validCount = features.filter(f => f.isValid).length
  const warnCount = features.filter(f => !f.isValid).length

  // Pick up to 5 "interesting" attribute columns for the preview table
  const isApia = isApiaShapefile(columnNames)
  const PRIORITY_COLS = isApia
    ? ['bloc_nr', 'parcel_nr', 'crop_name', 'area_dec', 'commune', 'judet']
    : ['BLOC_FIZIC', 'NR_PARCEL', 'CULTURA', 'COD_UNIC', 'TARLA', 'JUDET', 'LOCALITATE']
  const displayCols = [
    ...PRIORITY_COLS.filter(c => columnNames.includes(c)),
    ...columnNames.filter(c => !PRIORITY_COLS.includes(c)),
  ].slice(0, isApia ? 5 : 3)

  // DB fields available for mapping (grouped: generic + APIA)
  const DB_FIELDS: { key: keyof FieldMapping; label: string; required?: boolean; group?: string }[] = [
    // Generic
    { key: 'bloc_fizic',   label: 'Bloc fizic / Nume parcelă', required: true },
    { key: 'suprafata_ha', label: 'Suprafață (ha)' },
    { key: 'cultura',      label: 'Cultură' },
    { key: 'judet',        label: 'Județ' },
    { key: 'localitate',   label: 'Localitate' },
    { key: 'cod_parcela',  label: 'Cod parcelă (legacy)' },
    // APIA 1:1
    { key: 'farm_id',   label: 'farm_id → apia_farm_id',  group: 'APIA' },
    { key: 'year',      label: 'year → apia_year',         group: 'APIA' },
    { key: 'siruta',    label: 'siruta → siruta',           group: 'APIA' },
    { key: 'commune',   label: 'commune → locality',        group: 'APIA' },
    { key: 'bloc_nr',   label: 'bloc_nr → bloc_fizic',      group: 'APIA' },
    { key: 'parcel_nr', label: 'parcel_nr → parcel_nr',     group: 'APIA' },
    { key: 'crop_nr',   label: 'crop_nr → crop_nr',         group: 'APIA' },
    { key: 'cat_use',   label: 'cat_use → land_use_category', group: 'APIA' },
    { key: 'crop_code', label: 'crop_code → crop_code',     group: 'APIA' },
    { key: 'crop_name', label: 'crop_name → culture',       group: 'APIA' },
    { key: 'area_dec',  label: 'area_dec → surface',        group: 'APIA' },
    { key: 'agro_env',  label: 'agro_env → agro_env',       group: 'APIA' },
    { key: 'comment',   label: 'comment → apia_comment',    group: 'APIA' },
    { key: 'inserted',  label: 'inserted → apia_inserted',  group: 'APIA' },
    { key: 'updated',   label: 'updated → apia_updated',    group: 'APIA' },
    { key: 'status',    label: 'status → status',           group: 'APIA' },
    { key: 'full_bloc', label: 'full_bloc → full_bloc',      group: 'APIA' },
  ]

  if (!open) return null

  // ── Render ────────────────────────────────────────────────────────────────

  const isUpload  = step === 'upload'
  const isPreview = step === 'preview'
  const isMapping = step === 'mapping'
  const isSavingStep = step === 'saving'

  const STEPS = [
    { n: 1, label: 'Încărcare', done: !isUpload },
    { n: 2, label: 'Preview',   done: isMapping || isSavingStep, active: isPreview },
    { n: 3, label: 'Mapare câmpuri', done: isSavingStep, active: isMapping },
    { n: 4, label: 'Salvare',   done: false, active: isSavingStep },
  ]

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Import parcele</h2>
            <p className="text-xs text-gray-500 mt-0.5">Shapefile (.zip), GeoJSON</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-5 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0 overflow-x-auto">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-1 flex-shrink-0">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                s.done
                  ? 'text-green-700 bg-green-100'
                  : s.active || (isUpload && s.n === 1)
                    ? 'text-brand-700 bg-brand-100'
                    : 'text-gray-400 bg-gray-100'
              }`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  s.done ? 'bg-green-500 text-white' : 'text-white'
                }`} style={s.done ? {} : { background: (s.active || (isUpload && s.n === 1)) ? '#16a34a' : '#d1d5db' }}>
                  {s.done ? '✓' : s.n}
                </span>
                {s.label}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── STEP 1: Upload ── */}
          {step === 'upload' && (
            <div className="p-5 space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors select-none ${
                  dragging
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,.geojson,.json,.kml"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {parsing ? (
                  <>
                    <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
                    <p className="text-sm text-gray-600 font-medium">Se parsează {fileName}…</p>
                    <p className="text-xs text-gray-400">Reproiecție coordonate, validare geometrie…</p>
                  </>
                ) : (
                  <>
                    <Upload className={`w-10 h-10 transition-colors ${dragging ? 'text-green-500' : 'text-gray-300'}`} />
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">
                        Trage fișierul aici sau <span className="text-green-600 underline">selectează</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        .zip (Shapefile ESRI), .geojson, .json
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Error */}
              {parseError && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">Eroare la parsare</div>
                    <div className="text-xs mt-0.5 text-red-600">{parseError}</div>
                  </div>
                </div>
              )}

              {/* Format hints */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <FileArchive className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-blue-800">Shapefile (.zip)</div>
                    <div className="text-xs text-blue-600 mt-0.5">
                      Export IPA Online / LPIS APIA. ZIP trebuie să conțină .shp, .dbf, .prj. Coordonatele sunt reproiectate automat din Stereo 70 → WGS84.
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 bg-purple-50 border border-purple-100 rounded-lg">
                  <FileJson className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-purple-800">GeoJSON (.geojson / .json)</div>
                    <div className="text-xs text-purple-600 mt-0.5">
                      Export Google Earth, GPS-uri, alte sisteme GIS. Coordonate WGS84 (lat/lng).
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Fișierele sunt procesate complet <strong>local în browser</strong> — nicio geometrie nu este trimisă pe server în acest pas.</span>
              </div>
            </div>
          )}

          {/* ── STEP 2: Preview ── */}
          {step === 'preview' && (
            <div className="p-5 space-y-4">
              {/* Summary row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Parcele importate', value: features.length },
                  { label: 'Suprafață totală', value: `${fmt2(totalHa)} ha` },
                  { label: 'Valide', value: validCount, color: 'text-green-700' },
                  { label: 'Avertismente', value: warnCount, color: warnCount > 0 ? 'text-amber-700' : 'text-gray-400' },
                ].map(k => (
                  <div key={k.label} className="bg-gray-50 rounded-lg border border-gray-200 p-3 text-center">
                    <div className={`text-lg font-bold ${k.color ?? 'text-gray-800'}`}>{k.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>

              {/* APIA auto-detected banner */}
              {isApia && (
                <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
                  <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-green-600" />
                  <span>
                    <strong>Shapefile APIA detectat</strong> — mapare automată 1:1 aplicată.
                    {' '}{columnNames.length} coloane, inclusiv <code className="bg-green-100 px-1 rounded">farm_id</code>,{' '}
                    <code className="bg-green-100 px-1 rounded">crop_name</code>, <code className="bg-green-100 px-1 rounded">area_dec</code>.
                  </span>
                </div>
              )}

              {/* Column names detected */}
              {columnNames.length > 0 && (
                <div className="flex items-start gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                  <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
                  <div>
                    <span className="font-medium">Câmpuri DBF detectate: </span>
                    <span className="font-mono">{columnNames.join(', ')}</span>
                  </div>
                </div>
              )}

              {/* GeoJSON.Feature table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 border-b border-gray-200 font-medium uppercase tracking-wide text-[10px]">
                        <th className="px-3 py-2 text-left">#</th>
                        {displayCols.map(c => (
                          <th key={c} className="px-3 py-2 text-left font-mono">{c}</th>
                        ))}
                        <th className="px-3 py-2 text-right">Calc. (ha)</th>
                        <th className="px-3 py-2 text-right">Decl. (ha)</th>
                        <th className="px-3 py-2 text-right">Δ</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {features.map(f => {
                        const bigDiff = f.diffPct != null && Math.abs(f.diffPct) > 5
                        return (
                          <tr key={f.idx} className={`hover:bg-gray-50 ${!f.isValid ? 'bg-red-50' : ''}`}>
                            <td className="px-3 py-2 text-gray-400">{f.idx + 1}</td>
                            {displayCols.map(c => (
                              <td key={c} className="px-3 py-2 text-gray-700 max-w-[120px] truncate" title={String(f.attributes[c] ?? '')}>
                                {f.attributes[c] != null ? String(f.attributes[c]).slice(0, 20) : '—'}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-right font-mono text-gray-800">{fmt2(f.areaHa)}</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-500">
                              {f.declaredHa != null ? fmt2(f.declaredHa) : '—'}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono ${
                              bigDiff ? 'text-amber-600 font-semibold' : 'text-gray-400'
                            }`}>
                              {f.diffPct != null ? fmtPct(f.diffPct) : '—'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {f.isValid && !f.validationMsg && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" />
                              )}
                              {f.isValid && f.validationMsg && (
                                <div title={f.validationMsg}>
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mx-auto cursor-help" />
                                </div>
                              )}
                              {!f.isValid && (
                                <div title={f.validationMsg}>
                                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 mx-auto cursor-help" />
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Error-GeoJSON.Feature legend */}
              {warnCount > 0 && (
                <div className="space-y-1">
                  {features.filter(f => f.validationMsg).slice(0, 5).map(f => (
                    <div key={f.idx} className={`flex items-start gap-2 text-xs p-2 rounded ${f.isValid ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span><strong>Parcela #{f.idx + 1}:</strong> {f.validationMsg}</span>
                    </div>
                  ))}
                  {features.filter(f => f.validationMsg).length > 5 && (
                    <p className="text-xs text-gray-400 pl-2">... și alte {features.filter(f => f.validationMsg).length - 5} avertismente</p>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Poți previzualiza poligoanele pe hartă (editare vertex cu butonul ✏️ din bara laterală), 
                  sau mergi direct la <strong>Mapare câmpuri</strong> pentru salvare.
                </span>
              </div>
            </div>
          )}

          {/* ── STEP 3: Field mapping ── */}
          {isMapping && (
            <div className="p-5 space-y-5">
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Asociază câmpurile din fișierul importat (<strong>coloane DBF</strong>) cu câmpurile din baza de date.
                  Maparea se salvează automat pentru importurile viitoare.
                  {currentFC && <span className="ml-1 font-semibold text-green-700">✓ Se vor salva geometriile editate de pe hartă.</span>}
                </span>
              </div>

              <div className="space-y-3">
                {DB_FIELDS
                  .filter(dbf => !dbf.group || isApia)
                  .map(dbf => (
                  <div key={dbf.key} className={`grid grid-cols-5 gap-3 items-center ${dbf.group === 'APIA' ? 'pl-2 border-l-2 border-green-200' : ''}`}>
                    <div className="col-span-2 text-xs font-medium text-gray-700">
                      {dbf.group === 'APIA'
                        ? <span className="font-mono text-green-700 text-[11px]">{dbf.label}</span>
                        : dbf.label
                      }
                      {dbf.required && <span className="text-red-500 ml-0.5">*</span>}
                    </div>
                    <div className="col-span-3">
                      <select
                        value={fieldMapping[dbf.key]}
                        onChange={e => {
                          const m = { ...fieldMapping, [dbf.key]: e.target.value }
                          setFieldMapping(m)
                          saveMapping(m)
                        }}
                        className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                      >
                        <option value="">— Ignoră câmpul —</option>
                        {columnNames.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Preview mapped values for first 3 parcels */}
              {features.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">Preview mapare (primele 3 parcele):</p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wide">
                          {isApia ? (
                            <>
                              <th className="px-3 py-2 text-left">Bloc / Parcelă</th>
                              <th className="px-3 py-2 text-left">Cultură</th>
                              <th className="px-3 py-2 text-right">Suprafață</th>
                              <th className="px-3 py-2 text-left">Comună</th>
                              <th className="px-3 py-2 text-left">SIRUTA</th>
                            </>
                          ) : (
                            <>
                              <th className="px-3 py-2 text-left">Bloc fizic</th>
                              <th className="px-3 py-2 text-right">Suprafață</th>
                              <th className="px-3 py-2 text-left">Cultură</th>
                              <th className="px-3 py-2 text-left">Județ</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {features.slice(0, 3).map(f => {
                          const get = (col: string) => col && f.attributes[col] != null ? String(f.attributes[col]) : '—'
                          if (isApia) {
                            const blocNr = get(fieldMapping.bloc_nr)
                            const pNr = get(fieldMapping.parcel_nr)
                            const cn = get(fieldMapping.crop_name)
                            const color = cn !== '—' ? APIA_CROP_COLORS[cn] : undefined
                            return (
                              <tr key={f.idx}>
                                <td className="px-3 py-2 text-gray-800 font-mono font-medium">
                                  B{blocNr}/{pNr}{get(fieldMapping.crop_nr) !== '—' ? get(fieldMapping.crop_nr) : ''}
                                </td>
                                <td className="px-3 py-2">
                                  <span className="flex items-center gap-1.5">
                                    {color && <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />}
                                    <span className="text-gray-700 font-medium">{cn}</span>
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right text-gray-600 font-mono">
                                  {fieldMapping.area_dec && f.attributes[fieldMapping.area_dec]
                                    ? Number(f.attributes[fieldMapping.area_dec]).toFixed(2) + ' ha'
                                    : f.areaHa.toFixed(2) + ' ha (calc.)'}
                                </td>
                                <td className="px-3 py-2 text-gray-600">{get(fieldMapping.commune)}</td>
                                <td className="px-3 py-2 text-gray-500 font-mono">{get(fieldMapping.siruta)}</td>
                              </tr>
                            )
                          }
                          // Generic non-APIA row
                          return (
                            <tr key={f.idx}>
                              <td className="px-3 py-2 text-gray-800 font-medium">{get(fieldMapping.bloc_fizic)}</td>
                              <td className="px-3 py-2 text-right text-gray-600 font-mono">
                                {fieldMapping.suprafata_ha && f.attributes[fieldMapping.suprafata_ha]
                                  ? Number(f.attributes[fieldMapping.suprafata_ha]).toFixed(2) + ' ha'
                                  : f.areaHa.toFixed(2) + ' ha (calc.)'}
                              </td>
                              <td className="px-3 py-2 text-gray-600">{get(fieldMapping.cultura)}</td>
                              <td className="px-3 py-2 text-gray-500">{get(fieldMapping.judet)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 4: Saving ── */}
          {isSavingStep && (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                {isSaving
                  ? <Loader2 className="w-5 h-5 text-green-600 animate-spin flex-shrink-0" />
                  : <Database className="w-5 h-5 text-green-600 flex-shrink-0" />
                }
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    {isSaving ? 'Import în curs…' : 'Import finalizat'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {saveResults.filter(r => r.status === 'ok').length} / {saveResults.length} parcele salvate
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${saveResults.length > 0 ? (saveResults.filter(r => r.status === 'ok' || r.status === 'error').length / saveResults.length) * 100 : 0}%` }}
                />
              </div>

              {/* Per-GeoJSON.Feature log */}
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                {saveResults.map(r => (
                  <div key={r.idx} className={`flex items-center justify-between px-3 py-2 text-xs border-b border-gray-100 last:border-0 ${
                    r.status === 'error' ? 'bg-red-50' : r.status === 'ok' ? '' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {r.status === 'pending' && <span className="w-3.5 h-3.5 rounded-full bg-gray-200 flex-shrink-0" />}
                      {r.status === 'saving' && <Loader2 className="w-3.5 h-3.5 text-green-500 animate-spin flex-shrink-0" />}
                      {r.status === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />}
                      {r.status === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                      <span className="truncate text-gray-700 font-medium">{r.name}</span>
                    </div>
                    {r.error && <span className="text-red-600 ml-2 flex-shrink-0 max-w-[180px] truncate" title={r.error}>{r.error}</span>}
                    {r.status === 'ok' && <span className="text-green-600 ml-2 flex-shrink-0">Salvat ✓</span>}
                  </div>
                ))}
              </div>

              {!isSaving && saveResults.some(r => r.status === 'ok') && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                  <CheckCheck className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <strong>{saveResults.filter(r => r.status === 'ok').length} parcele</strong> au fost adăugate în harta parcele și registru.
                    Reîncarcă harta pentru a le vedea.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex-shrink-0 gap-3">
          {isUpload && (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                Anulează
              </button>
              <div className="text-xs text-gray-400">Selectează un fișier pentru a continua</div>
            </>
          )}
          {isPreview && (
            <>
              <button onClick={reset} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Alt fișier
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreviewOnMap}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors font-medium"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Previzualizare pe hartă
                </button>
                <button
                  onClick={() => setStep('mapping')}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                >
                  Continuă la mapare <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
          {isMapping && (
            <>
              <button onClick={() => setStep('preview')} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                ← Înapoi
              </button>
              <div className="flex items-center gap-2">
                <div className="text-xs text-gray-400">{(fcToUse?.features.length ?? 0)} parcele de salvat</div>
                <button
                  onClick={() => void handleSave()}
                  disabled={!fieldMapping.bloc_fizic}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  Salvează în baza de date
                </button>
              </div>
            </>
          )}
          {isSavingStep && (
            <>
              <button
                onClick={reset}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Import nou
              </button>
              <button
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                {isSaving ? 'Se salvează…' : 'Închide'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
