const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('lib/website.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS},
}).outputText;
const target = {exports: {}};
vm.runInNewContext(code, {exports: target.exports, module: target, URL, require: id => loadTs('lib/' + id.slice(2) + '.ts')});
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

const legacy = {...good};
for (const key of ['sections', 'aboutHeading', 'aboutBody', 'contactHeading', 'contactText', 'contactUrl']) delete legacy[key];
const migrated = validateWebsiteBrief(legacy);
assert.equal(migrated.sections.filter(s => s.enabled).map(s => s.id).join(','), 'services');
const badSections = [[], [{id: 'services', enabled: true}],
  [{id: 'about', enabled: true}, {id: 'about', enabled: true}, {id: 'contact', enabled: true}],
  [{id: '__proto__', enabled: true}, {id: 'services', enabled: true}, {id: 'contact', enabled: true}],
  [{id: 'about', enabled: 'yes'}, {id: 'services', enabled: true}, {id: 'contact', enabled: true}]];
for (const sections of badSections) assert.throws(() => validateWebsiteBrief({...good, sections}));
assert.throws(() => validateWebsiteBrief({...good, contactUrl: 'javascript:alert(1)'}));
assert.throws(() => validateWebsiteBrief({...good, aboutBody: 'x'.repeat(1201)}));
const {websiteCtaHref, safeWebsiteLink} = target.exports;
assert.equal(websiteCtaHref(migrated), '#website-services');
assert.equal(safeWebsiteLink('data:text/html,bad'), '');
assert.equal(websiteCtaHref({...good, sections: good.sections.map(s => ({...s, enabled: false}))}), '');

function loadTs(file) {
  const path = require('node:path');
  const module = {exports: {}};
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(compiled, {exports: module.exports, module, URL, require: id => loadTs(path.join(path.dirname(file), id + '.ts'))});
  return module.exports;
}
const {exportWebsiteHtml} = loadTs('lib/website-export.ts');
const sections = [{id: 'contact', enabled: true}, {id: 'about', enabled: false}, {id: 'services', enabled: true}];
const malicious = {...good, sections, title: '"><script>alert(1)</script>', headline: '<img src=x onerror=alert(1)>',
  contactHeading: '</style><script>bad</script>', contactText: 'A & B', contactUrl: 'https://example.com/contact?a=1&b=2'};
const html = exportWebsiteHtml(malicious);
assert.ok(!html.includes('<script>'));
assert.ok(!html.includes('<img src=x'));
assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
assert.ok(html.includes('A &amp; B'));
assert.ok(html.includes('a=1&amp;b=2'));
assert.ok(!html.includes('id="website-about"'));
assert.ok(html.indexOf('id="website-contact"') < html.indexOf('id="website-services"'));
assert.ok(html.includes('<meta name="viewport"'));
assert.ok(!html.includes('/api/media/'));
assert.throws(() => exportWebsiteHtml({...good, heroImageId: 'photo-1'}));
assert.throws(() => exportWebsiteHtml({...good, heroImageId: 'photo-1'}, 'data:image/svg+xml;base64,PHN2Zz4='));
assert.ok(exportWebsiteHtml({...good, heroImageId: 'photo-1'}, 'data:image/png;base64,aGVsbG8=').includes('src="data:image/png;base64,aGVsbG8="'));
assert.equal(exportWebsiteHtml({...good, sections: good.sections.map(s => ({...s, enabled: false}))}).includes('class="website-cta"'), false);
console.log('PASS: legacy section defaults, section validation, CTA fallback, ordered/hidden sections, HTML escaping and embedded-image export');

// Persisted kit IDs are allowlisted before becoming preview/export class names.
assert.equal(validateWebsiteBrief({...good, designKit: undefined}).designKit, 'original');
for (const designKit of ['original','minimal','publication','portfolio']) {
  const saved = validateWebsiteBrief({...good, designKit});
  assert.equal(saved.designKit, designKit);
  assert.ok(exportWebsiteHtml(saved).includes('website-kit-' + designKit));
}
for (const designKit of ['__proto__', 'constructor', '\"><script>', null, 42]) assert.throws(() => validateWebsiteBrief({...good, designKit}));
const {importWebsiteMetadata} = loadTs('lib/website-metadata.ts');
assert.equal(importWebsiteMetadata(JSON.stringify({name:'새 브랜드',description:'새 소개'}), {...good,designKit:'publication'}).designKit,'publication');
console.log('PASS: design kit migration, persistence, export parity, injection rejection and metadata preservation');

const {websiteTypeBrief}=loadTs('lib/website-types.ts');
for(const [tier,layout,kit,sectionCount] of [['basic','studio','minimal',3],['business','editorial','publication',3],['premium','gallery','portfolio',3]]){
 const draft=websiteTypeBrief(tier);
 assert.equal(draft.designPreset,layout);assert.equal(draft.designKit,kit);
 assert.equal(draft.sections.filter(section=>section.enabled).length,sectionCount);
 const valid=validateWebsiteBrief({...draft,title:good.title,brand:good.brand,headline:good.headline,description:good.description});
 assert.ok(exportWebsiteHtml(valid).includes('website-kit-'+kit));
}
console.log('PASS: three website entry cards initialize distinct layouts, design kits and sections');

const {emptyProductionBrief}=loadTs('lib/website-production.ts');
const production={...emptyProductionBrief('business'),goal:' 상담 문의 ',modules:['콘텐츠 CMS','리드·CRM']};
const savedProduction=validateWebsiteBrief({...good,productionBrief:production}).productionBrief;
assert.equal(savedProduction.goal,'상담 문의');assert.equal(savedProduction.tier,'business');assert.equal(savedProduction.modules.length,2);
for(const productionBrief of [null,[],{...production,tier:'advanced'},{...production,goal:'x'.repeat(1601)},{...production,modules:['unknown']},{...production,modules:['리드·CRM','리드·CRM']}])assert.throws(()=>validateWebsiteBrief({...good,productionBrief}));
assert.equal(validateWebsiteBrief(good).productionBrief,undefined);
assert.ok(!exportWebsiteHtml({...good,productionBrief:{...production,operations:'PRIVATE_OPERATIONS_NOTE'}}).includes('PRIVATE_OPERATIONS_NOTE'));
console.log('PASS: production brief persistence contract, bounded options, legacy compatibility and private notes excluded from public HTML');
