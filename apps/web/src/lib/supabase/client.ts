/**
 * Browser-side Supabase client.
 * Use this in 'use client' components only.
 * Never import this on the server — use server.ts instead.
 * Only the anon key is used here — safe to expose in the browser.
 */
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
      },
    },
  )
}
