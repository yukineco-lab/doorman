import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, 'build', 'icon.png')
const OUT_DIR = join(ROOT, 'build')
const TMP_DIR = join(ROOT, 'build', '.icon-tmp')

mkdirSync(TMP_DIR, { recursive: true })

const SIZES = [16, 24, 32, 48, 64, 128, 256]

const pngBuffers = []
for (const size of SIZES) {
  const buf = await sharp(SRC)
    .resize(size, size, { fit: 'contain', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  const path = join(TMP_DIR, `${size}.png`)
  writeFileSync(path, buf)
  pngBuffers.push(buf)
  console.log(`  ${size}x${size} generated`)
}

// Write 1024 version of icon.png (for mac/linux)
const bigPng = await sharp(SRC).resize(1024, 1024, { kernel: 'lanczos3' }).png().toBuffer()
writeFileSync(join(OUT_DIR, 'icon.png'), bigPng)
console.log('  icon.png (1024) written')

// Build multi-size ICO
const ico = await pngToIco(pngBuffers)
writeFileSync(join(OUT_DIR, 'icon.ico'), ico)
console.log('  icon.ico written (' + SIZES.join(',') + ')')

// Also refresh resources/icon.png
await sharp(SRC).resize(512, 512, { kernel: 'lanczos3' }).png().toFile(join(ROOT, 'resources', 'icon.png'))
console.log('  resources/icon.png (512) written')

console.log('Done.')
