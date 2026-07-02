/**
 * lib/crypto/encryption.ts
 *
 * AES-256-GCM encryption/decryption using the Web Crypto API.
 * Edge-runtime compatible (Cloudflare Workers, Next.js Edge).
 *
 * Env var required: IMPERSONATION_ENCRYPTION_KEY
 *   Must be a base64-encoded 32-byte random key.
 *   Generate with: openssl rand -base64 32
 */

const KEY_ENV = 'IMPERSONATION_ENCRYPTION_KEY'
const IV_BYTES = 12 // 96-bit IV — standard for AES-GCM

function requireKey(): string {
  const key = process.env[KEY_ENV]
  if (!key) throw new Error(`[encryption] Missing env var ${KEY_ENV}`)
  return key
}

async function importKey(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(requireKey()), c => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

/**
 * Encrypt a UTF-8 string. Returns a base64-encoded string
 * containing the 12-byte IV followed by the ciphertext+tag.
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await importKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const encoded = new TextEncoder().encode(plaintext)
  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)

  const combined = new Uint8Array(IV_BYTES + cipherBuffer.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipherBuffer), IV_BYTES)

  return btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt a base64-encoded string produced by `encrypt()`.
 */
export async function decrypt(encryptedB64: string): Promise<string> {
  const key = await importKey()
  const combined = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0))
  const iv = combined.slice(0, IV_BYTES)
  const ciphertext = combined.slice(IV_BYTES)
  const plaintextBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plaintextBuffer)
}
