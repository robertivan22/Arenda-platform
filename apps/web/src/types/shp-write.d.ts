declare module 'shp-write' {
  interface DownloadOptions {
    folder?: string
    filename?: string
    outputType?: 'blob' | 'base64' | 'hex' | 'binary' | 'array'
    compression?: 'DEFLATE' | 'STORE'
    types?: {
      point?: string
      polygon?: string
      polyline?: string
    }
  }
  interface GeoJSONInput {
    type: string
    features: Array<{
      type: string
      geometry: { type: string; coordinates: unknown }
      properties: Record<string, unknown>
    }>
  }
  export function zip(geojson: GeoJSONInput, options?: DownloadOptions): Promise<Blob>
  export function download(geojson: GeoJSONInput, options?: DownloadOptions): void
}
