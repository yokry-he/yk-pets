import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const directory = path.join(process.cwd(), 'apps/extension/public/audio/motions/zh-CN')
const expectedFiles = [
  'greeting.mp3', 'jumping.mp3', 'flapping.mp3', 'resting.mp3', 'stretching.mp3', 'eating.mp3',
  'backflip.mp3', 'tail-tornado.mp3', 'diving-catch.mp3', 'energy-burst.mp3', 'shy-peek.mp3',
  'star-juggle.mp3', 'cloud-nap.mp3', 'sparkle-sneeze.mp3', 'fireworks-show.mp3', 'curious-scan.mp3',
  'antenna-charge.mp3', 'tail-glow.mp3',
]

const actualFiles = readdirSync(directory).filter(file => file.endsWith('.mp3')).sort()
const failures = []
if (actualFiles.length !== expectedFiles.length || expectedFiles.some(file => !actualFiles.includes(file))) {
  failures.push(`动作语音文件集合不完整 / Motion-speech file set is incomplete: ${actualFiles.length}/${expectedFiles.length}`)
}

for (const file of expectedFiles) {
  const absolute = path.join(directory, file)
  const probe = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', absolute,
  ], { encoding: 'utf8' })
  if (probe.status !== 0) {
    failures.push(`${file}: 无法解码 / cannot be decoded`)
    continue
  }

  const duration = Number.parseFloat(probe.stdout.trim())
  const volume = spawnSync('ffmpeg', [
    '-hide_banner', '-nostats', '-i', absolute, '-af', 'volumedetect', '-f', 'null', '-',
  ], { encoding: 'utf8' })
  const output = `${volume.stdout}\n${volume.stderr}`
  const mean = Number.parseFloat(output.match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1] || '-Infinity')
  const peak = Number.parseFloat(output.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1] || '-Infinity')

  if (!Number.isFinite(duration) || duration < 1 || duration > 10) failures.push(`${file}: 时长异常 / invalid duration ${duration}`)
  if (!Number.isFinite(mean) || mean < -35) failures.push(`${file}: 平均音量过低 / mean volume too low ${mean} dB`)
  if (!Number.isFinite(peak) || peak < -20) failures.push(`${file}: 峰值过低，可能是静音 / peak too low, likely silent ${peak} dB`)
  console.log(`✓ ${file} · ${duration.toFixed(2)}s · mean ${mean.toFixed(1)} dB · peak ${peak.toFixed(1)} dB`)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`\n${expectedFiles.length}/${expectedFiles.length} 条动作语音均为可解码的非静音音频。 / All motion-speech files are decodable and non-silent.`)
