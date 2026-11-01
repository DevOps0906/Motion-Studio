const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict'),ts=require('typescript');
const env={};let calls=[],aiReply;
const SECRET='test-placeholder-secret';
async function fakeFetch(url,options={}){calls.push({url:String(url),body:options.body});if(String(url).startsWith('https://api.openai.com/'))return aiReply();return new Response('<html><title>Ref</title></html>',{headers:{'Content-Type':'text/html'}});}
const okReply=draft=>()=>new Response(JSON.stringify({output:[{content:[{type:'output_text',text:JSON.stringify(draft)}]}]}),{headers:{'Content-Type':'application/json'}});
function load(file,stubs={}){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,URL,Response,TextDecoder,AbortSignal,Date,SyntaxError,process:{env},fetch:fakeFetch,require:id=>id==='server-only'||id.startsWith('node:')?{}:stubs[id]||load(path.join(path.dirname(file),id+'.ts'),stubs)});return module.exports;}
const {EMPTY_WEBSITE,validateWebsiteBrief}=load('lib/website.ts');
const draftLib=load('lib/website-draft.ts');
const {WEBSITE_DRAFT_FIELDS,automaticWebsiteDraft,websiteDraftSource,applyWebsiteDraft,undoWebsiteDraft,isBlankDraftValue,websiteDraftAiInput}=draftLib;
const clone=value=>JSON.parse(JSON.stringify(value)),eq=(a,b,message)=>assert.deepEqual(clone(a),clone(b),message);
const production={tier:'basic',industry:'카페',goal:'예약 늘리기',audience:'',offer:'원두 납품',pages:'',content:'',conversion:'',operations:'주말 운영',experience:'',automation:'',schedule:'12월 오픈',budget:'300만원',modules:[]};
const brief={...clone(EMPTY_WEBSITE),title:'테스트 프로젝트',brand:'ACME',description:'원두를 직접 볶습니다. 매장에서 맛볼 수 있습니다.',audience:'동네 주민',services:['로스팅','드립 커피'],productionBrief:production,contactUrl:'https://example.com/contact',testimonials:[{quote:'좋아요',name:'김'}],faqs:[{question:'영업?',answer:'매일'}],pages:[{id:'about',title:'소개',headline:'소개',description:'',sections:clone(EMPTY_WEBSITE.sections)}],heroImageId:'img-1',inquiryForm:true,referenceUrl:'https://evil.example/page',referenceTitle:'Minimal Coffee',designPreset:'editorial'};
const goodAi={headline:'직접 볶은 원두',aboutHeading:'ACME 이야기',aboutBody:'원두를 직접 볶습니다.',services:['로스팅'],ctaLabel:'문의하기',showSections:{about:true,services:true,contact:true}};
(async()=>{
 // Rule draft only uses entered facts.
 const rule=automaticWebsiteDraft(websiteDraftSource(brief));
 eq(Object.keys(rule).sort(),[...WEBSITE_DRAFT_FIELDS].sort());
 assert.equal(rule.headline,'원두를 직접 볶습니다.');eq(rule.services,['로스팅','드립 커피']);
 const ruleText=JSON.stringify(rule);for(const fact of ['카페','300만원','12월','주말','@','010','Minimal Coffee','좋아요'])assert.ok(!ruleText.includes(fact),'rule draft invented or leaked '+fact);
 eq(rule.sections.filter(s=>['testimonials','faq'].includes(s.id)),brief.sections.filter(s=>['testimonials','faq'].includes(s.id)));
 validateWebsiteBrief({...brief,...rule});
 // AI payload whitelist (7.4).
 const payload=websiteDraftAiInput(websiteDraftSource(brief));eq(Object.keys(payload).sort(),['audience','brand','description','designPreset','productionBrief','referenceTitle','services']);eq(Object.keys(payload.productionBrief).sort(),['goal','industry','offer']);

 let server=load('lib/server/website-draft.ts');aiReply=okReply(goodAi);
 // Not configured → automatic, no call.
 calls=[];let result=await server.generateWebsiteDraft({brief,useAi:true},'op@example.com');assert.equal(result.provider,'automatic');assert.equal(calls.length,0);assert.ok(result.warnings.some(w=>w.includes('미연결')));
 Object.assign(env,{OPENAI_API_KEY:SECRET,OPENAI_WEBSITE_MODEL:'test-model'});
 // Non-operator → automatic, no call.
 calls=[];result=await server.generateWebsiteDraft({brief,useAi:true},null);assert.equal(result.provider,'automatic');assert.equal(calls.length,0);
 // useAi omitted or not exactly true → no call.
 for(const useAi of [undefined,'true',1]){calls=[];result=await server.generateWebsiteDraft({brief,useAi},'op@example.com');assert.equal(result.provider,'automatic');assert.equal(calls.length,0);}
 // AI success: store:false, strict schema, whitelisted payload, unlisted reference host not fetched, key not in response.
 calls=[];result=await server.generateWebsiteDraft({brief,useAi:true},'op@example.com');assert.equal(result.provider,'openai');assert.equal(result.draft.headline,'직접 볶은 원두');
 eq(calls.map(c=>c.url),['https://api.openai.com/v1/responses']);
 const body=JSON.parse(calls[0].body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.model,'test-model');
 for(const excluded of ['300만원','12월 오픈','주말 운영','example.com/contact','좋아요','테스트 프로젝트','evil.example','img-1'])assert.ok(!body.input.includes(excluded),'payload leaked '+excluded);
 assert.ok(!JSON.stringify(result).includes(SECRET));validateWebsiteBrief({...brief,...result.draft});eq(result.warnings,[]);
 // Allow-listed reference host is read for metadata.
 calls=[];await server.generateWebsiteDraft({brief:{...brief,referenceUrl:'https://dribbble.com/shots/1'},useAi:true},'op2@example.com');eq(calls.map(c=>new URL(c.url).hostname),['dribbble.com','api.openai.com']);
 // Schema violations, HTTP, network and JSON errors → rule draft + general warning.
 const failures=[okReply({...goodAi,services:['1','2','3','4','5','6','7']}),okReply({...goodAi,showSections:undefined}),okReply({...goodAi,ctaLabel:'x'.repeat(41)}),()=>new Response('{}',{status:500}),()=>{throw new TypeError('network');},()=>new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'{not json'}]}]}))];
 for(const reply of failures){server=load('lib/server/website-draft.ts');aiReply=reply;result=await server.generateWebsiteDraft({brief,useAi:true},'op@example.com');assert.equal(result.provider,'automatic');eq(result.draft,rule);assert.ok(result.warnings.some(w=>w.includes('규칙 기반 초안')));assert.ok(!JSON.stringify(result).includes('network'));}
 // Quota: 5 per account per 10 minutes, 60 overall per hour, counted before the call.
 server=load('lib/server/website-draft.ts');aiReply=okReply(goodAi);calls=[];
 for(let i=0;i<5;i++)assert.equal((await server.generateWebsiteDraft({brief:{...brief,referenceUrl:''},useAi:true},'Same@example.com')).provider,'openai');
 result=await server.generateWebsiteDraft({brief,useAi:true},'same@example.com');assert.equal(result.provider,'automatic');assert.ok(result.warnings.some(w=>w.includes('한도')));assert.equal(calls.length,5);
 server=load('lib/server/website-draft.ts');aiReply=()=>{throw new TypeError('down');};
 for(let i=0;i<60;i++)await server.generateWebsiteDraft({brief:{...brief,referenceUrl:''},useAi:true},`user${Math.floor(i/5)}@example.com`);
 result=await server.generateWebsiteDraft({brief,useAi:true},'fresh@example.com');assert.ok(result.warnings.some(w=>w.includes('한도')));
 // Missing required fields → draft fields only with "직접 입력 필요".
 result=await server.generateWebsiteDraft({brief:{...brief,title:'',brand:' '}},null);assert.ok(result.warnings.includes('직접 입력 필요: 프로젝트 이름, 브랜드명'));eq(Object.keys(result.draft).sort(),[...WEBSITE_DRAFT_FIELDS].sort());
 await assert.rejects(server.generateWebsiteDraft({brief:null},null));
 // Defaults count as blank; "fill" keeps entered values.
 for(const field of WEBSITE_DRAFT_FIELDS)assert.ok(isBlankDraftValue(field,EMPTY_WEBSITE[field]),field+' default should be blank');
 assert.ok(isBlankDraftValue('services',['  ']));assert.ok(!isBlankDraftValue('ctaLabel','바로 예약'));
 const entered={...brief,headline:'내 문구',ctaLabel:'바로 예약',aboutHeading:EMPTY_WEBSITE.aboutHeading,aboutBody:'  ',services:[...EMPTY_WEBSITE.services]};
 const filled=applyWebsiteDraft(entered,rule,'fill');assert.equal(filled.brief.headline,'내 문구');assert.equal(filled.brief.ctaLabel,'바로 예약');assert.equal(filled.brief.aboutHeading,rule.aboutHeading);assert.equal(filled.brief.aboutBody,rule.aboutBody);eq(filled.brief.services,rule.services);assert.ok(!filled.changed.includes('headline'));
 // Overwrite changes only draft fields.
 const over=applyWebsiteDraft(entered,rule,'overwrite');for(const key of Object.keys(entered))if(!WEBSITE_DRAFT_FIELDS.includes(key))eq(over.brief[key],entered[key],key+' must not change');
 assert.equal(over.brief.headline,rule.headline);
 // Undo restores the pre-apply values once, keeping later edits to other fields.
 const undone=undoWebsiteDraft({...over.brief,title:'나중 수정'},over.previous);assert.equal(undone.title,'나중 수정');for(const field of WEBSITE_DRAFT_FIELDS)eq(undone[field],entered[field]);
 // Undo after "fill" restores only the changed fields; a later edit to an unchanged draft field survives.
 eq(Object.keys(filled.previous).sort(),[...filled.changed].sort());assert.ok(!filled.changed.includes('headline')&&!filled.changed.includes('ctaLabel'));
 const fillUndone=undoWebsiteDraft({...filled.brief,headline:'사용자 수정',ctaLabel:'지금 예약',faqs:[]},filled.previous);
 assert.equal(fillUndone.headline,'사용자 수정');assert.equal(fillUndone.ctaLabel,'지금 예약');eq(fillUndone.faqs,[]);for(const field of filled.changed)eq(fillUndone[field],entered[field]);
 // AI only with REQUIREMENTS_ADMIN_EMAILS configured.
 const account={currentAccount:async()=>({name:'op',email:'op@example.com'})};const req=load('lib/server/website-requirements.ts',{'./accounts':account});const local=new Request('http://localhost/api/websites/draft');
 delete env.REQUIREMENTS_ADMIN_EMAILS;assert.equal(await req.canReadRequirements(local,{requireAdminList:true}),false);assert.equal(await req.canReadRequirements(local),true);
 env.REQUIREMENTS_ADMIN_EMAILS='other@example.com, OP@example.com';assert.equal(await req.canReadRequirements(local,{requireAdminList:true}),true);
 env.REQUIREMENTS_ADMIN_EMAILS='other@example.com';assert.equal(await req.canReadRequirements(local,{requireAdminList:true}),false);
 console.log('PASS: website draft rules, AI gating/whitelist/fallback/quota, blank-fill/overwrite scope, undo and admin-list requirement');
})().catch(error=>{console.error(error);process.exitCode=1;});
