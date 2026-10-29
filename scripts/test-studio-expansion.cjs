const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,URL,require:id=>id.startsWith('.')?load(path.join(path.dirname(file),id+'.ts')):require(id)});cache.set(file,module.exports);return module.exports;}
const {motionPresets,renderResolutions}=load('lib/motion-presets.ts'),motion=load('lib/motion.ts'),model=load('lib/model.ts'),catalog=load('lib/template-catalog.ts');
assert.equal(motionPresets.length,13);assert.equal(new Set(motionPresets.map(item=>item.id)).size,13);
const signatures=new Set();
for(const preset of motionPresets){
 signatures.add(JSON.stringify([motion.cameraPose(.19,preset.id),motion.cameraPose(.53,preset.id),motion.tileMotion(3,36,.07,preset.id)]));
 for(const count of [6,36,60])for(let frame=0;frame<=450;frame++){
  const progress=frame/450,a=motion.cameraPose(progress,preset.id,count),tile=motion.tileMotion(3,count,progress,preset.id);
  assert.ok(a.z>0&&Object.values(a).every(Number.isFinite));assert.ok(tile.scale>0&&Object.values(tile).every(Number.isFinite));
  assert.deepEqual(a,motion.cameraPose(progress,preset.id,count));
 }
 for(const resolution of renderResolutions)assert.doesNotThrow(()=>model.validateProject({...model.DEFAULT_PROJECT,template:preset.id,resolution:{width:resolution.width,height:resolution.height}}));
}
assert.equal(signatures.size,13,'Every preset must have a different trajectory or tile entrance');
assert.throws(()=>model.validateProject({...model.DEFAULT_PROJECT,resolution:{width:1234,height:567}}));
const request={templateId:'photo-wall-intro-v1',photoIds:Array.from({length:6},(_,i)=>`photo-${i}`),logoAssetId:'logo-1',motionPresetId:'flip',resolution:{width:3840,height:2160}};
assert.equal(catalog.buildIntroProject(request).template,'flip');assert.equal(catalog.buildIntroProject(request).resolution.height,2160);
assert.throws(()=>catalog.buildIntroProject({...request,motionPresetId:'unknown'}));assert.throws(()=>catalog.buildIntroProject({...request,resolution:{width:1,height:1}}));
const metadata=load('lib/website-metadata.ts'),website=load('lib/website.ts');
const imported=metadata.importWebsiteMetadata(JSON.stringify({company:{name:'테스트 회사',description:'실제 홈페이지 소개',services:['설계 자료 시각화','브랜드 웹']},seo:{title:'회사 공식 홈페이지'},headline:'새로운 경험',contactUrl:'https://example.com/contact'}));
assert.equal(imported.brand,'테스트 회사');assert.equal(imported.title,'회사 공식 홈페이지');assert.equal(imported.services.length,2);
assert.equal(imported.aboutBody,'실제 홈페이지 소개');assert.equal(imported.contactUrl,'https://example.com/contact');
const linked=metadata.importWebsiteMetadata(JSON.stringify({'@graph':[{'@type':'Organization',name:'JSON-LD 회사',description:'JSON-LD 소개'}]}));assert.equal(linked.brand,'JSON-LD 회사');
for(const input of ['bad json','[]','{}',JSON.stringify({name:'회사',description:'소개',contactUrl:'javascript:alert(1)'})])assert.throws(()=>metadata.importWebsiteMetadata(input));
assert.equal(website.validateWebsiteBrief({...imported,designPreset:'editorial'}).designPreset,'editorial');
assert.throws(()=>website.validateWebsiteBrief({...imported,designPreset:'injected'}));
const refs=load('lib/website-references.ts');
const sample={type:'submission',slug:'design-test',title:'Architecture Test',images:{thumbnail:'submissions/2026/test.jpg'},tags:['Architecture','Minimal']};
const html=`<li data-collectable-model-value="${JSON.stringify(sample).replace(/"/g,'&quot;')}"></li>`;
const cards=refs.parseReferenceCards(html,'awwwards');assert.equal(cards.length,1);assert.equal(cards[0].url,'https://www.awwwards.com/sites/design-test');assert.equal(refs.referenceDesign(cards[0].tags,cards[0].title),'editorial');
assert.equal(refs.parseReferenceCards(html.replace('design-test','../bad'),'awwwards').length,0);
assert.ok(refs.referenceSearchUrl('awwwards','a&b').includes('a%26b'));
const library=load('lib/reference-library.ts').referenceLibrary;assert.ok(library.length>=50);assert.equal(new Set(library.map(item=>item.url)).size,library.length);
console.log('PASS: 13 distinct deterministic presets across 451 frames / 3 photo counts, 4 resolutions, quick-create validation, metadata import, live-result parser and reference directory');
