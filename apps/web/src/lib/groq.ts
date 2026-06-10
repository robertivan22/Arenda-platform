import Groq from 'groq-sdk'

// ─── Client (server-side only) ────────────────────────────────────────────────
// This file must NEVER be imported in client components.

if (!process.env.GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY env var is missing. Add it to .env.local.')
}

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
})

// Default model – fast and capable
export const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

// ─── Chat completion helper ───────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionOptions {
  model?: string
  temperature?: number
  max_tokens?: number
  json?: boolean   // if true, asks the model for JSON output
}

export async function chat(
  messages: ChatMessage[],
  options: CompletionOptions = {}
): Promise<{ text: string; model: string; tokens: number }> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.2,
    max_tokens = 4096,
    json = false,
  } = options

  const completion = await groq.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  })

  const text = completion.choices[0]?.message?.content ?? ''
  const tokens = completion.usage?.total_tokens ?? 0

  return { text, model, tokens }
}

// ─── Strip markdown code fences from a JSON response ─────────────────────────
// Groq sometimes wraps JSON in ```json ... ``` even when asked not to.

export function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

// ─── Safe JSON parse helper ───────────────────────────────────────────────────

export function safeParseJSON<T>(raw: string): T | null {
  try {
    return JSON.parse(stripCodeFences(raw)) as T
  } catch {
    return null
  }
}
