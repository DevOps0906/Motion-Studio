const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict'),path=require('path');
function load(file){const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,Date,URL,require:id=>load(path.join(path.dirname(file),id+'.ts'))});return module.exports;}
const {REQUIREMENT_FEATURES,EMPTY_REQUIREMENTS,recommendRequirements,requirementReport}=load('lib/website-requirements.ts');
const evaluate=changes=>recommendRequirements({...EMPTY_REQUIREMENTS,...changes},REQUIREMENT_FEATURES);
assert.equal(evaluate({}).tier,'basic');assert.equal(evaluate({goal:'growth'}).tier,'business');assert.equal(evaluate({goal:'brand'}).tier,'premium');
for(const feature of REQUIREMENT_FEATURES)assert.equal(evaluate({features:[feature.id]}).tier,feature.tier);
assert.equal(evaluate({delivery:'blog',features:['threeD']}).tier,null);assert.equal(evaluate({delivery:'blog'}).blog,true);
assert.equal(evaluate({delivery:'both',features:['cms']}).tier,'business');assert.equal(evaluate({delivery:'both',features:['cms']}).blog,true);
assert.equal(evaluate({budget:'0원',features:['threeD']}).tier,'premium');assert.ok(evaluate({features:['commerce']}).options.includes('회원·예약·결제'));
assert.equal(requirementReport({...EMPTY_REQUIREMENTS,features:['crm']}).format,'motion-studio-requirements-v1');
const {requirementsCustomerHtml}=load('lib/website-requirements-export.ts');const html=requirementsCustomerHtml();assert.ok(html.includes('홈페이지형 블로그'));assert.ok(html.includes('const recommend='));assert.ok(!html.includes('fetch('));
fs.mkdirSync('out/qa',{recursive:true});fs.writeFileSync('out/qa/website-requirements-offline.html',html);
console.log('PASS: requirement recommendation boundaries, blog-only/add-on, complex options and offline customer artifact');

const {requirementReferenceHref,REQUIREMENT_REFERENCE_CARDS}=load('lib/website-reference-showcase.ts');
assert.equal(REQUIREMENT_REFERENCE_CARDS.map(card=>card.tier).join(','),'basic,business,premium');
assert.equal(requirementReferenceHref('https://example.com/demo'),'https://example.com/demo');
for(const value of ['', 'javascript:alert(1)','https://name:password@example.com','file:///tmp/site'])assert.equal(requirementReferenceHref(value),'');
assert.ok(html.includes('type="date" name="timeline"'));
assert.ok(html.indexOf('<h2>BASIC</h2>')<html.indexOf('<h2>BUSINESS</h2>')&&html.indexOf('<h2>BUSINESS</h2>')<html.indexOf('<h2>PREMIUM</h2>'));
console.log('PASS: reference placeholder order, safe external URLs and offline tier/date parity');
