/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  images: { unoptimized: true },
  // shpjs v6 is ESM-only; tell Next.js/webpack to transpile it for the browser bundle
  transpilePackages: ['shpjs'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
}
export default config
