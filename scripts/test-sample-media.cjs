const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const manifest = JSON.parse(fs.readFileSync('public/photos/manifest.json', 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(manifest.sources.length, 5);
assert.equal(manifest.photos.length, 36);
const sources = new Map(manifest.sources.map(source => [source.id, source]));
assert.equal(sources.size, 5);
for (const source of manifest.sources) {
  assert.equal(path.basename(source.file), source.file);
  assert.equal(hash(path.join('input/images', source.file)), source.sha256);
}
for (let index = 0; index < manifest.photos.length; index++) {
  const photo = manifest.photos[index], source = sources.get(photo.sourceAssetId);
  assert.equal(photo.file, `${String(index + 1).padStart(2, '0')}.jpg`);
  assert.ok(source);
  assert.ok(photo.crop.left >= 0 && photo.crop.top >= 0 && photo.crop.width >= 40 && photo.crop.height >= 40);
  assert.ok(photo.crop.left + photo.crop.width <= source.width);
  assert.ok(photo.crop.top + photo.crop.height <= source.height);
  assert.equal(hash(path.join('public/photos', photo.file)), photo.sha256);
}
for (let n = 2; n <= 5; n++) assert.equal(fs.existsSync(`input/images/20261029_152230_${n}.png`), false);
console.log('PASS: 5 new source hashes, 36 sample hashes/crop bounds and superseded source removal');
