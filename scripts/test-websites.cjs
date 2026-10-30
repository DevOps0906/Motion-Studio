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

// Multi-page persistence, preview/export parity and downloadable archive contract.
const extraPage={id:'about',title:'회사 소개',headline:'우리의 새 이야기',description:'추가 페이지 소개',sections:[{id:'contact',enabled:false},{id:'about',enabled:true},{id:'services',enabled:false}]};
const multi=validateWebsiteBrief({...good,pages:[extraPage]});
assert.equal(multi.pages[0].id,'about');
assert.equal(validateWebsiteBrief({...good,pages:undefined}).pages.length,0);
for(const pages of [[{...extraPage,id:'index'}],[{...extraPage,id:'../secret'}],[{...extraPage,id:'About'}],[extraPage,extraPage],Array(13).fill(extraPage),[{...extraPage,sections:[extraPage.sections[0],extraPage.sections[0],extraPage.sections[2]]}]])assert.throws(()=>validateWebsiteBrief({...good,pages}));
const detailHtml=exportWebsiteHtml(multi,'',multi.pages[0]);
assert.ok(detailHtml.includes('<h1>우리의 새 이야기</h1>'));
assert.ok(detailHtml.includes('<p>추가 페이지 소개</p>'));
assert.ok(detailHtml.includes('href="./index.html"'));
assert.ok(detailHtml.includes('href="./about.html" aria-current="page"'));
assert.ok(!detailHtml.includes('data-website-section="contact"'));
assert.ok(!exportWebsiteHtml(good).includes('href="./index.html"'));
(async()=>{
 let saved=multi;
 const handler={exports:{}};
 const compiled=ts.transpileModule(fs.readFileSync('app/api/websites/[id]/export/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(compiled,{module:handler,exports:handler.exports,Response,require:id=>{
  if(id==='node:fs')return {promises:{}};
  if(id==='fflate')return require('fflate');
  if(id.endsWith('/server/websites'))return {getWebsite:async()=>saved};
  if(id.endsWith('/server/store'))return {apiError:error=>Response.json({error:error.message},{status:400})};
  if(id.endsWith('/website-export'))return {exportWebsiteHtml};
  throw Error('Unexpected dependency '+id);
 }});
 const response=await handler.exports.GET(null,{params:Promise.resolve({id:'qa-project'})});
 assert.equal(response.headers.get('content-type'),'application/zip');
 const files=require('fflate').unzipSync(new Uint8Array(await response.arrayBuffer()));
 assert.equal(Object.keys(files).sort().join(','),'README.txt,about.html,index.html');
 for(const filename of ['index.html','about.html'])assert.ok(require('fflate').strFromU8(files[filename]).includes('href="./about.html"'));
 saved=validateWebsiteBrief({...good,pages:[]});
 const single=await handler.exports.GET(null,{params:Promise.resolve({id:'qa-project'})});
 assert.equal(single.headers.get('content-type'),'text/html; charset=utf-8');
 assert.ok(single.headers.get('content-disposition').endsWith('.html"'));
 console.log('PASS: multi-page migration, invalid/duplicate addresses, per-page sections, relative navigation, ZIP payload and single-page compatibility');
})().catch(error=>{console.error(error);process.exitCode=1;});

const {resolveWebsitePage}=loadTs('lib/website.ts');
const customContent={aboutHeading:'페이지 전용 소개',aboutBody:'독립된 이야기',services:['전용 서비스'],contactHeading:'페이지 전용 문의',contactText:'상담 안내',contactUrl:'https://example.com/page-contact',ctaLabel:'상담하기'};
const customPage={...extraPage,sections:good.sections,content:customContent};
const customSite=validateWebsiteBrief({...good,pages:[customPage]});
const projected=resolveWebsitePage(customSite,customSite.pages[0]);
assert.equal(projected.aboutBody,'독립된 이야기');assert.equal(projected.services.join(','),'전용 서비스');
assert.equal(projected.contactUrl,customContent.contactUrl);
assert.equal(resolveWebsitePage(customSite).aboutBody,good.aboutBody);
const inherited=resolveWebsitePage({...customSite,aboutBody:'수정된 홈 소개'},extraPage);
assert.equal(inherited.aboutBody,'수정된 홈 소개');
assert.equal(resolveWebsitePage({...customSite,aboutBody:'수정된 홈 소개'},customSite.pages[0]).aboutBody,'독립된 이야기');
assert.equal(validateWebsiteBrief(JSON.parse(JSON.stringify(customSite))).pages[0].content.aboutHeading,'페이지 전용 소개');
const customHtml=exportWebsiteHtml(customSite,'',customSite.pages[0]);
for(const value of ['페이지 전용 소개','독립된 이야기','전용 서비스','페이지 전용 문의','상담 안내','https://example.com/page-contact','상담하기'])assert.ok(customHtml.includes(value));
assert.ok(!exportWebsiteHtml(customSite).includes('독립된 이야기'));
for(const content of [null,[],{...customContent,services:[]},{...customContent,services:[' ']},{...customContent,services:Array(7).fill('서비스')},{...customContent,aboutBody:'x'.repeat(1201)},{...customContent,ctaLabel:''},{...customContent,contactUrl:'javascript:alert(1)'},{...customContent,contactUrl:'https://user:password@example.com'}])assert.throws(()=>validateWebsiteBrief({...good,pages:[{...extraPage,content}]}));
assert.ok(exportWebsiteHtml({...customSite,pages:[{...customPage,content:{...customContent,aboutBody:'<script>alert(1)</script>'}}]},'',customPage).includes('&lt;script&gt;'));
console.log('PASS: page-specific content persistence, home inheritance, independent services/contact, validation and escaped HTML output');
