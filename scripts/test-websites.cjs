const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('lib/website.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS},
}).outputText;
const target = {exports: {}};
vm.runInNewContext(code, {exports: target.exports, module: target, URL});
const {EMPTY_WEBSITE, validateWebsiteBrief} = target.exports;
const good = {...EMPTY_WEBSITE, title: '브랜드 소개', brand: 'ATELIER', headline: '새로운 공간', description: '고객을 위한 디자인'};
const clean = validateWebsiteBrief({...good, title: '  브랜드 소개  ', id: '../../injected', createdAt: 'forged'});
assert.equal(clean.title, '브랜드 소개');
assert.equal(clean.id, undefined);
assert.equal(clean.createdAt, undefined);
assert.equal(validateWebsiteBrief({...good, referenceUrl: 'https://example.com/path'}).referenceUrl, 'https://example.com/path');
const invalid = [null, [], {...good, title: ''}, {...good, brand: ' '}, {...good, headline: 'x'.repeat(161)},
  {...good, referenceUrl: 'javascript:alert(1)'}, {...good, referenceUrl: 'file:///etc/passwd'},
  {...good, referenceUrl: 'https://user:password@example.com'}, {...good, services: []},
  {...good, services: Array(7).fill('value')}, {...good, services: [' ']}, {...good, services: [1]},
  {...good, accent: 'url(https://example.com)'}, {...good, theme: 'unknown'}, {...good, heroImageId: '../secret'},
  {...good, description: 42}];
for (const input of invalid) assert.throws(() => validateWebsiteBrief(input));
console.log(`PASS: website brief normalization, server-owned fields and ${invalid.length} invalid-input cases`);
