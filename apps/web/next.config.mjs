/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // shpjs v6 is ESM-only; shp-write is CJS but needs transpilation on Cloudflare
  transpilePackages: ['shpjs', 'shp-write'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
}
export default config
