// Run after refresh-sample-media.cjs with the app stopped. Keeps project asset IDs.
const fs = require('node:fs/promises');
const path = require('node:path');
const {randomUUID, createHash} = require('node:crypto');
const root = process.cwd();
function inside(relative) {
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) throw new Error('Workspace path required');
  return file;
}
async function json(file) { return JSON.parse(await fs.readFile(inside(file), 'utf8')); }
async function atomic(relative, bytes) {
  const file = inside(relative), temp = file + '.sample.tmp';
  await fs.mkdir(path.dirname(file), {recursive: true});
  await fs.writeFile(temp, bytes); await fs.rename(temp, file);
}
(async () => {
  const manifest = await json('public/photos/manifest.json');
  const directory = inside('.local-data/media');
  await fs.mkdir(directory, {recursive: true});
  const media = await Promise.all((await fs.readdir(directory)).filter(f => f.endsWith('.json')).map(f => json(path.join('.local-data/media', f))));
  const legacy = media.filter(m => m.type === 'image' && (/^starter-source-[2-5]-/.test(m.name) || /^source-[2-5]$/.test(m.sourceAssetId || '')))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', {numeric: true}));
  let migrated = 0, created = 0;
  const covered = new Set();
  const assignments = legacy.map((asset, i) => ({asset, photo: manifest.photos[i % manifest.photos.length]}));
  for (const photo of manifest.photos) {
    const existing = media.find(m => m.name === `starter-${photo.file}` && !legacy.some(old => old.id === m.id));
    if (existing) assignments.push({asset: existing, photo});
    else if (!assignments.some(item => item.photo.file === photo.file)) assignments.push({photo});
  }
  for (const {asset, photo} of assignments) {
    const bytes = await fs.readFile(inside(path.join('public', 'photos', photo.file)));
    if (createHash('sha256').update(bytes).digest('hex') !== photo.sha256) throw new Error('Generated sample hash mismatch');
    const id = asset?.id || randomUUID();
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('Invalid asset ID');
    const record = {...asset, id, name: `starter-${photo.file}`, type: 'image', role: 'derived-photo', mimeType: 'image/jpeg',
      sizeBytes: bytes.length, width: photo.width, height: photo.height, sourceAssetId: photo.sourceAssetId, crop: photo.crop,
      url: `/api/media/${id}`, createdAt: asset?.createdAt || new Date().toISOString()};
    await atomic(path.join('.local-data', 'files', id), bytes);
    await atomic(path.join('.local-data', 'media', id + '.json'), JSON.stringify(record, null, 2));
    covered.add(photo.file); if (asset) migrated++; else created++;
  }
  if (covered.size !== 36) throw new Error('Not all new samples are registered');
  // Only these superseded input files may be removed; new user originals are retained.
  for (let n = 2; n <= 5; n++) await fs.unlink(inside(`input/images/20261029_152230_${n}.png`)).catch(error => {if (error.code !== 'ENOENT') throw error;});
  const cropped = inside('out/cropped-photos');
  await fs.mkdir(cropped, {recursive: true});
  for (const photo of manifest.photos) await fs.copyFile(inside(path.join('public', 'photos', photo.file)), inside(path.join('out', 'cropped-photos', `starter-${photo.file}`)));
  for (const file of await fs.readdir(cropped)) {
    if (/^starter-source-[2-5]-\d+\.jpg$/.test(file)) await fs.unlink(inside(path.join('out', 'cropped-photos', file)));
  }
  await fs.writeFile(inside('out/cropped-photos/manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`PASS: ${migrated} sample assets replaced in place, ${created} added; project references preserved; old source files removed`);
})().catch(error => {console.error(error); process.exitCode = 1;});
