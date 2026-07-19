import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

async function removeGeneratedSourceFiles(directory) {
  let entries = []
  try { entries = await readdir(directory, { withFileTypes: true }) }
  catch { return }
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await removeGeneratedSourceFiles(path)
    else if (/\.(?:js|js\.map|d\.ts|d\.ts\.map)$/.test(entry.name)) await rm(path, { force: true })
  }
}

for (const entry of await readdir('packages', { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const packageRoot = join('packages', entry.name)
  await rm(join(packageRoot, 'dist'), { recursive: true, force: true })
  await removeGeneratedSourceFiles(join(packageRoot, 'src'))
}

await rm('artifacts', { recursive: true, force: true })
for (const entry of await readdir('.', { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.tgz')) await rm(entry.name, { force: true })
}
