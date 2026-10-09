/** Nakkad PWA icons — generated locally, zero-cost. */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { deflateSync } from 'node:zlib'

function crc32(buf) {
  let c, table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function makePng(size, withGlyph) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit RGBA
  const rows = []
  const c = size / 2
  const rad = size * 0.22
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4)
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x - c), dy = Math.abs(y - c)
      const inCorner = dx > size / 2 - rad && dy > size / 2 - rad
      const cornerDist = Math.hypot(dx - (size / 2 - rad), dy - (size / 2 - rad))
      const inside = inCorner ? cornerDist <= rad : dx <= size / 2 && dy <= size / 2
      let R = 11, G = 18, B = 32, A = inside ? 255 : 0
      if (inside && withGlyph) {
        const gx = (x - c) / (size * 0.31), gy = (y - c) / (size * 0.31)
        const inGlyph =
          (Math.abs(gy) < 0.10 && gx > -0.62 && gx < (gy < 0 ? 0.10 : 0.42)) ||
          (Math.abs(gx) < 0.10 && gy > -0.55 && gy < 0.55)
        if (inGlyph) { R = 5; G = 46; B = 28 }
      }
      row.writeUInt8(R, 1 + x * 4)
      row.writeUInt8(G, 2 + x * 4)
      row.writeUInt8(B, 3 + x * 4)
      row.writeUInt8(A, 4 + x * 4)
    }
    rows.push(row)
  }
  const ihdrChunk = chunk('IHDR', ihdr)
  const idat = chunk('IDAT', deflateSync(Buffer.concat(rows)))
  const iend = chunk('IEND', Buffer.alloc(0))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ihdrChunk, idat, iend,
  ])
}

mkdirSync(resolve('public/icons'), { recursive: true })
for (const [name, size] of [['icon-192', 192], ['icon-512', 512], ['icon-maskable-512', 512]]) {
  const buf = makePng(size, name !== 'icon-maskable-512')
  writeFileSync(resolve(`public/icons/${name}.png`), buf)
  console.log(`wrote public/icons/${name}.png (${buf.length} bytes)`)
}
