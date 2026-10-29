// Rebuilds the 36 tracked sample photos from explicit, reviewed source regions.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const root = process.cwd();
function inside(relative) {
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) throw new Error('Workspace path required');
  return file;
}
(async () => {
  const spec = JSON.parse(await fs.readFile(inside('input/sample-crops.json'), 'utf8'));
  const sources = [], photos = [], prepared = [];
  for (const source of spec.sources) {
    if (path.basename(source.file) !== source.file) throw new Error('Source must be a filename');
    const bytes = await fs.readFile(inside(path.join('input', 'images', source.file)));
    const meta = await sharp(bytes).metadata();
    if (meta.format !== 'png' || !meta.width || !meta.height) throw new Error('Expected a decodable PNG source');
    const sha256 = hash(bytes), id = `source-${sha256.slice(0, 16)}`;
    sources.push({id, file: source.file, width: meta.width, height: meta.height, sizeBytes: bytes.length, sha256});
    for (const [x, y, w, h] of source.crops) {
      const crop = {left: Math.round(x / spec.referenceWidth * meta.width), top: Math.round(y / spec.referenceHeight * meta.height),
        width: Math.round(w / spec.referenceWidth * meta.width), height: Math.round(h / spec.referenceHeight * meta.height)};
      if (crop.left < 0 || crop.top < 0 || crop.width < 40 || crop.height < 40 || crop.left + crop.width > meta.width || crop.top + crop.height > meta.height) throw new Error('Crop outside source');
      const image = await sharp(bytes).extract(crop).jpeg({quality: 95, chromaSubsampling: '4:4:4'}).toBuffer();
      const file = `${String(photos.length + 1).padStart(2, '0')}.jpg`;
      photos.push({file, sourceAssetId: id, crop, width: crop.width, height: crop.height, sizeBytes: image.length, sha256: hash(image)});
      prepared.push({file, image});
    }
  }
  if (photos.length !== 36) throw new Error('Sample scene requires exactly 36 photos');
  await fs.mkdir(inside('public/photos'), {recursive: true});
  for (const {file, image} of prepared) await fs.writeFile(inside(path.join('public', 'photos', file)), image);
  await fs.writeFile(inside('public/photos/manifest.json'), JSON.stringify({version: 1, sources, photos}, null, 2) + '\n');
  console.log(`PASS: ${sources.length} reviewed source collages -> ${photos.length} sample photos; previous sample bytes replaced`);
})().catch(error => {console.error(error); process.exitCode = 1;});
