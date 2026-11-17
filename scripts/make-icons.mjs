/**
 * Generates the app icons in public/ (run with `npm run icons`).
 *
 * The icon is a simple dumbbell drawn from rectangles, so it can be produced
 * with no image library: this script computes every pixel and writes the PNG
 * file format by hand using Node's built-in zlib. Re-run it only if you want
 * to change the colours or shape below; the generated PNGs are committed.
 */
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BACKGROUND = [0x0f, 0x11, 0x15]
const ACCENT = [0x4c, 0x9a, 0xff]

/**
 * The dumbbell as rectangles in a 0..1 coordinate space: [x, y, width, height].
 * Everything sits inside the central 60% so that "maskable" icons (which
 * Android crops to a circle or rounded square) never lose part of the shape.
 */
const SHAPES = [
  [0.3, 0.47, 0.4, 0.06], // bar
  [0.22, 0.34, 0.07, 0.32], // left outer plate
  [0.3, 0.38, 0.05, 0.24], // left inner plate
  [0.71, 0.34, 0.07, 0.32], // right outer plate
  [0.65, 0.38, 0.05, 0.24], // right inner plate
]

/** CRC-32 checksum, required after every PNG chunk. */
function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** One PNG chunk: length, type, data, checksum. */
function chunk(type, data) {
  const head = Buffer.alloc(4)
  head.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const tail = Buffer.alloc(4)
  tail.writeUInt32BE(crc32(body))
  return Buffer.concat([head, body, tail])
}

function makePng(size) {
  // Each row is 1 filter byte followed by size × RGB.
  const row = 1 + size * 3
  const pixels = Buffer.alloc(row * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      const inShape = SHAPES.some(([sx, sy, w, h]) => u >= sx && u < sx + w && v >= sy && v < sy + h)
      const [r, g, b] = inShape ? ACCENT : BACKGROUND
      pixels.set([r, g, b], y * row + 1 + x * 3)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0) // width
  header.writeUInt32BE(size, 4) // height
  header.set([8, 2, 0, 0, 0], 8) // 8 bits per channel, RGB, default compression/filter/interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG signature
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), makePng(size))
  console.log(`wrote public/${name} (${size}×${size})`)
}

// The browser-tab icon is the same drawing as an SVG, with rounded corners.
const rects = SHAPES.map(
  ([x, y, w, h]) => `<rect x="${x * 100}" y="${y * 100}" width="${w * 100}" height="${h * 100}" rx="1.5"/>`,
).join('')
writeFileSync(
  new URL('../public/favicon.svg', import.meta.url),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#0f1115"/><g fill="#4c9aff">${rects}</g></svg>\n`,
)
console.log('wrote public/favicon.svg')
