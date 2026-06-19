'use client'

// Browser-only component — only imported inside MapParcelSelector (ssr:false)
import { useState, useCallback, useRef } from 'react'
import {
  Upload, X, AlertTriangle, CheckCircle2, FileArchive, FileJson,
  ChevronRight, Loader2, Eye, RotateCcw, Info,
} from 'lucide-react'
import { area as turfArea } from '@turf/area'
import { bbox as turfBbox } from '@turf/bbox'
import { kinks as turfKinks } from '@turf/kinks'
import type { FeatureCollection, Feature, Polygon, MultiPolygon, GeoJsonProperties } from 'geojson'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedFeature {
  idx: number
  geometry: Polygon | MultiPolygon
  attributes: Record<string, unknown>
  areaHa: number          // calculated from geometry
  declaredHa: number | null  // from DBF (best-guess field)
  diffPct: number | null  // % diff (calc - declared) / declared
  isValid: boolean
  validationMsg?: string
}

interface ImportWizardModalProps {
  open: boolean
  onClose: () => void
  /** Called with the full GeoJSON FeatureCollection when user clicks Preview */
  onPreview: (fc: FeatureCollection, features: ParsedFeature[]) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectDeclaredAreaHa(attrs: Record<string, unknown>): number | null {
  // Common APIA / IPA Online / ANCPI field names
  const haFields = ['SUPRAFATA', 'Suprafata', 'suprafata', 'AREA_HA', 'area_ha', 'SP_HA', 'GIS_AREA']
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImportWizardModal({ open, onClose, onPreview }: ImportWizardModalProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [features, setFeatures] = useState<ParsedFeature[]>([])
  const [rawFC, setRawFC] = useState<FeatureCollection | null>(null)
  const [fileName, setFileName] = useState('')
  const [columnNames, setColumnNames] = useState<string[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Parse uploaded file ───────────────────────────────────────────────────

  const parseFile = useCallback(async (file: File) => {
    setParsing(true)
    setParseError(null)
    setFileName(file.name)

    try {
      let fc: FeatureCollection

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
            features: result.flatMap((r: FeatureCollection) => r.features ?? []),
          }
        } else {
          fc = result as FeatureCollection
        }
      } else if (isGeoJSON) {
        const text = await file.text()
        const parsed = JSON.parse(text) as { type: string; features?: Feature[]; geometry?: Polygon | MultiPolygon; coordinates?: unknown }
        if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
          fc = parsed as FeatureCollection
        } else if (parsed.type === 'Feature') {
          fc = { type: 'FeatureCollection', features: [parsed as Feature] }
        } else if (parsed.type === 'Polygon' || parsed.type === 'MultiPolygon') {
          fc = {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: parsed as Polygon | MultiPolygon, properties: {} }],
          }
        } else {
          throw new Error('Format GeoJSON nerecunoscut. Așteptăm FeatureCollection, Feature sau Polygon/MultiPolygon.')
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
        throw new Error('Fișierul nu conține niciun poligon / feature.')
      }

      // Collect all attribute column names (from first few features)
      const colSet = new Set<string>()
      validFeatures.slice(0, 20).forEach(f => {
        Object.keys(f.properties ?? {}).forEach(k => colSet.add(k))
      })
      setColumnNames(Array.from(colSet))

      // Parse each feature
      const parsed: ParsedFeature[] = validFeatures.map((f, idx) => {
        const attrs = (f.properties ?? {}) as Record<string, unknown>
        const geom = f.geometry as Polygon | MultiPolygon

        const calcAreaM2 = turfArea(f as Feature<Polygon | MultiPolygon>)
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
            const kResult = turfKinks(f as Feature<Polygon | MultiPolygon>)
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
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  const totalHa = features.reduce((s, f) => s + f.areaHa, 0)
  const validCount = features.filter(f => f.isValid).length
  const warnCount = features.filter(f => !f.isValid).length

  // Pick up to 3 "interesting" attribute columns to show in the preview table
  const PRIORITY_COLS = ['BLOC_FIZIC', 'NR_PARCEL', 'CULTURA', 'COD_UNIC', 'TARLA', 'JUDET', 'LOCALITATE']
  const displayCols = [
    ...PRIORITY_COLS.filter(c => columnNames.includes(c)),
    ...columnNames.filter(c => !PRIORITY_COLS.includes(c)),
  ].slice(0, 3)

  if (!open) return null

  // ── Render ────────────────────────────────────────────────────────────────

  const STEPS = [
    { n: 1, label: 'Încărcare', done: step === 'preview' },
    { n: 2, label: 'Preview', done: false, active: step === 'preview' },
    { n: 3, label: 'Mapare câmpuri', disabled: true },
    { n: 4, label: 'Salvare', disabled: true },
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
                s.disabled
                  ? 'text-gray-300 bg-gray-100'
                  : s.done
                    ? 'text-green-700 bg-green-100'
                    : s.active || (!s.done && !s.disabled && step === 'upload' && s.n === 1)
                      ? 'text-brand-700 bg-brand-100'
                      : 'text-gray-500 bg-gray-100'
              }`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  s.disabled ? 'bg-gray-200 text-gray-400' : s.done ? 'bg-green-500 text-white' : 'bg-current text-white'
                }`} style={s.done || s.disabled ? {} : { background: s.active || s.n === 1 ? '#16a34a' : '#9ca3af' }}>
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

              {/* Feature table */}
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

              {/* Error-feature legend */}
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
                  <strong>Pasul următor (în curând):</strong> mapare câmpuri DBF → câmpuri bază de date și salvare.
                  Deocamdată poți previzualiza poligoanele pe hartă.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex-shrink-0 gap-3">
          {step === 'upload' ? (
            <>
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                Anulează
              </button>
              <div className="text-xs text-gray-400">Selectează un fișier pentru a continua</div>
            </>
          ) : (
            <>
              <button onClick={reset} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Alt fișier
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreviewOnMap}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                >
                  <Eye className="w-4 h-4" />
                  Previzualizare pe hartă
                </button>
                <button
                  disabled
                  title="Disponibil în curând — pasul 3: mapare câmpuri"
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium"
                >
                  Continuă →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
