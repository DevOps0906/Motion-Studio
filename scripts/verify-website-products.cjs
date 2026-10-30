const fs=require('fs/promises'),path=require('path'),assert=require('assert/strict'),{randomUUID}=require('crypto'),{openBrowser}=require('@remotion/renderer');
const base='http://127.0.0.1:4101',brand='Product QA '+randomUUID().slice(0,8);let browser,id;
async function wait(check){for(let i=0;i<100;i++){try{if(await check())return;}catch(e){if(!/context was destroyed/.test(e.message))throw e;}await new Promise(r=>setTimeout(r,100));}throw Error('Wait timeout');}
async function shot(page,file){await fs.writeFile('out/qa/'+file,Buffer.from((await page._client().send('Page.captureScreenshot',{format:'png'})).value.data,'base64'));}
(async()=>{try{
 browser=await openBrowser('chrome',{browserExecutable:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',chromiumOptions:{headless:true}});
 const page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:()=>{},onLog:()=>{}});
 await page.setViewport({width:1440,height:1050,deviceScaleFactor:1,isMobile:false,hasTouch:false});
 await page.goto({url:base+'/websites',timeout:60000});
 assert.equal(await page.evaluate(()=>Array.from(document.querySelectorAll('.product-card h2')).map(e=>e.textContent).join(',')),'BASIC,BUSINESS,PREMIUM');
 await shot(page,'website-products-desktop.png');
 const tiers=[];
 for(const tier of ['basic','business','premium']){
  await page.goto({url:base+'/websites/editor/'+tier,timeout:60000});
  await wait(()=>page.evaluate(()=>!!document.querySelector('.production-form')));
  const fields=await page.evaluate(()=>Array.from(document.querySelectorAll('.production-form [name]')).map(el=>el.name));tiers.push({tier,fields});
  if(tier==='basic')assert.equal(fields.includes('production-automation'),false);
  if(tier==='business')assert.ok(fields.includes('production-operations')&&fields.includes('production-automation'));
  if(tier==='premium')assert.ok(fields.includes('production-experience'));
  await shot(page,'website-production-'+tier+'.png');
 }
 // Enter a complete PREMIUM brief through the browser and persist it with the actual editor.
 for(const [key,value] of Object.entries({brand,industry:'공간 디자인',audience:'새로운 사무실을 준비하는 팀',goal:'프로젝트 상담을 신청하세요',offer:'실제 공간 사례와 기존 모델로 작업 방식을 소개합니다.',experience:'차분한 소재와 자연광',automation:'PRIVATE_PRODUCT_QA_NOTE'})){
  await page.evaluate(({key,value})=>{const el=document.querySelector(`[name="production-${key}"]`),proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));},{key,value});
  await new Promise(r=>setTimeout(r,60));
 }
 await page.evaluate(()=>{Array.from(document.querySelectorAll('.production-options label')).find(e=>e.textContent.includes('3D 모델 뷰어')).querySelector('input').click();document.querySelector('.production-form button[type=submit]').click();});
 await wait(()=>page.evaluate(()=>document.querySelector('input[name=title]').value.includes('Product QA')));
 assert.equal(await page.evaluate(()=>document.querySelector('input[name=headline]').value),'프로젝트 상담을 신청하세요');
 await page.evaluate(()=>document.querySelector('.website-brief button[type=submit]').click());
 await wait(async()=>{const projects=await (await fetch(base+'/api/websites')).json();id=projects.find(p=>p.brand===brand)?.id;return !!id;});
 const saved=await (await fetch(base+'/api/websites/'+id)).json();assert.equal(saved.productionBrief.tier,'premium');assert.equal(saved.productionBrief.experience,'차분한 소재와 자연광');assert.ok(saved.productionBrief.modules.includes('3D 모델 뷰어'));
 const exported=await (await fetch(base+'/api/websites/'+id+'/export')).text();assert.ok(!exported.includes('PRIVATE_PRODUCT_QA_NOTE'));
 await page.goto({url:base+'/websites/editor/basic',timeout:60000});
 await wait(()=>page.evaluate(brand=>Array.from(document.querySelectorAll('.website-project-list button')).some(b=>b.textContent.includes(brand)),brand));
 await page.evaluate(brand=>Array.from(document.querySelectorAll('.website-project-list button')).find(b=>b.textContent.includes(brand)).click(),brand);
 await wait(()=>page.evaluate(()=>!!document.querySelector('[name="production-experience"]')));
 assert.equal(await page.evaluate(()=>document.querySelector('[name="production-experience"]').value),'차분한 소재와 자연광');
 await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await page.goto({url:base+'/websites',timeout:60000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot(page,'website-products-mobile.png');
 await page.goto({url:base+'/websites/editor/premium',timeout:60000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot(page,'website-production-mobile.png');
 const legacy=await fetch(base+'/websites/editor/advanced',{redirect:'manual'});assert.ok([307,308].includes(legacy.status));assert.ok(legacy.headers.get('location').endsWith('/websites/editor/premium'));
 await fs.writeFile('out/qa/website-products-result.json',JSON.stringify({tiers,briefApplied:true,saveReopen:true,privateNotesExcluded:true,mobileOverflow:false,legacyRedirect:true},null,2));console.log('PASS: product copy/cards, tier-specific forms, brief application, real save/reopen, private-note exclusion, legacy redirect and mobile layout');
}finally{await browser?.close({silent:true});if(!id){const list=await (await fetch(base+'/api/websites')).json();id=list.find(p=>p.brand===brand)?.id;}if(id)await fs.unlink(path.join('.local-data/websites',id+'.json')).catch(()=>{});}})().catch(e=>{console.error(e);process.exitCode=1;});
