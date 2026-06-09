/**
 * Minimal single-file ZIP packer (STORE method — no compression).
 *
 * ANAF requires the XML to be uploaded inside a ZIP archive.
 * We use the STORE method (no compression) which is simpler to implement
 * in pure TypeScript without any dependencies and is valid per the ZIP spec.
 *
 * Edge-compatible: only uses TypeScript arrays and DataView (no Node.js APIs).
 */

// ─── CRC-32 ───────────────────────────────────────────────────────────────────

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    t[i] = c
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    c = CRC32_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

// ─── Helper: write little-endian integers ────────────────────────────────────

function setU16LE(buf: Uint8Array, offset: number, v: number) {
  buf[offset] = v & 0xff
  buf[offset + 1] = (v >>> 8) & 0xff
}

function setU32LE(buf: Uint8Array, offset: number, v: number) {
  buf[offset] = v & 0xff
  buf[offset + 1] = (v >>> 8) & 0xff
  buf[offset + 2] = (v >>> 16) & 0xff
  buf[offset + 3] = (v >>> 24) & 0xff
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Pack a single file into a minimal ZIP archive (STORE, no compression).
 *
 * @param filename  Name of the file inside the ZIP (e.g. "invoice.xml")
 * @param content   File content as bytes
 * @returns         ZIP archive bytes
 */
export function packZip(filename: string, content: Uint8Array): Uint8Array {
  const enc = new TextEncoder()
  const fname = enc.encode(filename)
  const fnLen = fname.length
  const dataLen = content.length
  const crc = crc32(content)
  const modTime = 0x0000 // 00:00:00
  const modDate = 0x0000 // 1980-01-01

  // ── Local file header (30 + fnLen bytes) ──
  const LFH_SIZE = 30 + fnLen
  const lfh = new Uint8Array(LFH_SIZE)
  setU32LE(lfh, 0, 0x04034b50)  // signature
  setU16LE(lfh, 4, 20)          // version needed (2.0)
  setU16LE(lfh, 6, 0)           // general purpose flags
  setU16LE(lfh, 8, 0)           // compression: STORE
  setU16LE(lfh, 10, modTime)
  setU16LE(lfh, 12, modDate)
  setU32LE(lfh, 14, crc)
  setU32LE(lfh, 18, dataLen)    // compressed size (same as uncompressed for STORE)
  setU32LE(lfh, 22, dataLen)    // uncompressed size
  setU16LE(lfh, 26, fnLen)
  setU16LE(lfh, 28, 0)          // extra field length
  lfh.set(fname, 30)

  // ── Central directory entry (46 + fnLen bytes) ──
  const CDE_SIZE = 46 + fnLen
  const cde = new Uint8Array(CDE_SIZE)
  setU32LE(cde, 0, 0x02014b50)  // signature
  setU16LE(cde, 4, 20)          // version made by
  setU16LE(cde, 6, 20)          // version needed
  setU16LE(cde, 8, 0)           // flags
  setU16LE(cde, 10, 0)          // compression: STORE
  setU16LE(cde, 12, modTime)
  setU16LE(cde, 14, modDate)
  setU32LE(cde, 16, crc)
  setU32LE(cde, 20, dataLen)
  setU32LE(cde, 24, dataLen)
  setU16LE(cde, 28, fnLen)
  setU16LE(cde, 30, 0)          // extra length
  setU16LE(cde, 32, 0)          // comment length
  setU16LE(cde, 34, 0)          // disk number start
  setU16LE(cde, 36, 0)          // internal attributes
  setU32LE(cde, 38, 0)          // external attributes
  setU32LE(cde, 42, 0)          // local header offset (always 0 for single file)
  cde.set(fname, 46)

  // ── End of central directory (22 bytes) ──
  const cdOffset = LFH_SIZE + dataLen
  const eocd = new Uint8Array(22)
  setU32LE(eocd, 0, 0x06054b50) // signature
  setU16LE(eocd, 4, 0)          // disk number
  setU16LE(eocd, 6, 0)          // disk with CD start
  setU16LE(eocd, 8, 1)          // entries on this disk
  setU16LE(eocd, 10, 1)         // total entries
  setU32LE(eocd, 12, CDE_SIZE)
  setU32LE(eocd, 16, cdOffset)
  setU16LE(eocd, 20, 0)         // comment length

  // ── Concatenate ──
  const total = LFH_SIZE + dataLen + CDE_SIZE + 22
  const zip = new Uint8Array(total)
  let off = 0
  zip.set(lfh, off); off += LFH_SIZE
  zip.set(content, off); off += dataLen
  zip.set(cde, off); off += CDE_SIZE
  zip.set(eocd, off)

  return zip
}
