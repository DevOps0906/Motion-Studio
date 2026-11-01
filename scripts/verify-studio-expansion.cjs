const {authorizePage}=require('./verify-session.cjs');const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {openBrowser}=require('@remotion/renderer'),{unzipSync,strFromU8}=require('fflate');
const base=process.env.VERIFY_BASE||process.env.WEBSITE_QA_URL||'http://127.0.0.1:4101';
let browser,websiteId,projectId;
async function json(url,options){const r=await fetch(base+url,options),body=await r.json();assert.ok(r.ok,JSON.stringify(body));return body;}
async function wait(fn){for(let i=0;i<120;i++){if(await fn())return;await new Promise(r=>setTimeout(r,250));}throw new Error('Expansion UI timeout');}
(async()=>{
 const report={};const logs=[];
 try{
  const media=await json('/api/media'),photos=media.filter(m=>m.role==='derived-photo').slice(0,6).map(m=>m.id);
  const project=await json('/api/projects',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Expansion QA '+randomUUID(),photos,template:'flip',resolution:{width:3840,height:2160}})});projectId=project.id;assert.equal(project.resolution.height,2160);
  const jobs=await json('/api/renders'),job=jobs.find(j=>j.status==='completed');assert.ok(job,'An existing completed render is required for the CapCut package smoke test');
  const packageResponse=await fetch(`${base}/api/renders/${job.id}/capcut`);assert.equal(packageResponse.status,200);
  const archive=unzipSync(new Uint8Array(await packageResponse.arrayBuffer()));assert.ok(archive['video/intro.mp4']);
  const manifest=JSON.parse(strFromU8(archive['motion-studio.json']));assert.equal(manifest.capcutNativeProject,false);assert.equal(manifest.project.id,job.projectSnapshot.id);
  assert.ok(Object.keys(archive).some(name=>name.startsWith('media/')));assert.deepEqual(Buffer.from(archive['video/intro.mp4']),await fs.readFile(path.join('.local-data','render-files',job.id,'output.mp4')));report.capcutPackage=true;
  browser=await openBrowser('chrome',{browserExecutable:process.env.REMOTION_BROWSER_EXECUTABLE||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',chromiumOptions:{headless:true,gl:'swangle'}});
  const page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:log=>logs.push(log),onLog:()=>{}});await authorizePage(page);
  await fs.mkdir('out/qa',{recursive:true});await page.setViewport({width:1440,height:1000,deviceScaleFactor:1,isMobile:false,hasTouch:false});
  const routes=['/studio','/studio?view=templates','/websites','/gallery','/architecture/viewer','/showcase','/intro','/architecture','/exports','/references'];
  for(const route of routes){await page.goto({url:base+route,timeout:60000});await wait(()=>page.evaluate(()=>Boolean(document.querySelector('.app-gnb nav'))));
   assert.equal(await page.evaluate(()=>document.querySelectorAll('.app-gnb').length),1);
   assert.ok(await page.evaluate(()=>document.querySelector('.app-content').getBoundingClientRect().left>=document.querySelector('.app-gnb').getBoundingClientRect().right-1));
   assert.ok(await page.evaluate(()=>Boolean(document.querySelector('.maker-reference-bar'))));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,route+' desktop overflow');
  }report.gnbRoutes=routes.length;
  await page.goto({url:base+'/studio?view=renders',timeout:60000});
  await wait(()=>page.evaluate(()=>Array.from(document.querySelectorAll('.job-card button')).some(button=>button.textContent==='영상 확인')));
  await page.evaluate(()=>Array.from(document.querySelectorAll('.job-card button')).find(button=>button.textContent==='영상 확인').click());
  await wait(()=>page.evaluate(()=>Boolean(document.querySelector('.job-inline-preview'))));
  assert.equal(await page.evaluate(()=>Boolean(document.querySelector('.app-content .job-inline-preview'))),true);report.inlineVideo=true;
  await page.goto({url:base+'/studio?view=templates',timeout:60000});await wait(()=>page.evaluate(()=>document.querySelectorAll('.template-card').length===13));report.presets=13;
  await page.goto({url:base+`/studio/projects/${projectId}`,timeout:60000});await wait(()=>page.evaluate(()=>Boolean(document.querySelector('select[aria-label="출력 해상도"]'))));
  assert.equal(await page.evaluate(()=>document.querySelector('select[aria-label="출력 해상도"]').value),'2160');
  await page.evaluate(()=>{const el=document.querySelector('select[aria-label="출력 해상도"]');el.value='720';el.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.evaluate(()=>Array.from(document.querySelectorAll('.topbar button')).find(b=>b.textContent==='저장').click());
  await wait(async()=>((await json(`/api/projects/${projectId}`)).resolution.height===720));report.resolutionSave=true;
  await page.goto({url:base+'/websites/editor/basic',timeout:60000});await wait(()=>page.evaluate(()=>!document.querySelector('.website-brief fieldset').disabled));
  const metadata={brand:'메타데이터 QA',title:'정보 기반 홈페이지 QA',headline:'가져온 정보로 만드는 홈페이지',description:'홈페이지 메타데이터에서 가져온 회사 소개입니다.',services:['웹 제작','영상 제작'],contactUrl:'https://example.com/contact'};
  await page.evaluate(data=>{const file=new File([JSON.stringify(data)],'homepage.json',{type:'application/json'}),transfer=new DataTransfer();transfer.items.add(file);const input=document.querySelector('.website-metadata-input');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));},metadata);
  await wait(()=>page.evaluate(()=>document.querySelector('.website-brief input[name=brand]').value==='메타데이터 QA'));
  assert.equal(await page.evaluate(()=>document.querySelector('.website-preview h1').textContent),metadata.headline);report.metadataImport=true;
  await page.evaluate(()=>document.querySelector('.reference-search-controls button').click());
  await wait(()=>page.evaluate(()=>document.querySelector('.reference-search-controls button').textContent==='검색'));
  const liveCount=await page.evaluate(()=>document.querySelectorAll('.reference-result').length);report.liveAwwwardsResults=liveCount;
  if(liveCount){await page.evaluate(()=>document.querySelector('.reference-result button').click());await wait(()=>page.evaluate(()=>Boolean(document.querySelector('.website-brief input[type=url]').value)));}
  await page.evaluate(()=>{document.querySelector('.maker-reference-bar details').open=true;const set=(selector,value)=>{const select=document.querySelector(selector);select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));};set('.maker-reference-bar select[aria-label="레퍼런스 분야"]','interactive');set('.maker-reference-bar select[aria-label="레퍼런스 유형"]','code');set('.maker-reference-bar select[aria-label="레퍼런스 기술"]','GSAP');});
  await wait(()=>page.evaluate(()=>Array.from(document.querySelectorAll('.maker-reference-bar .reference-library-card')).some(card=>card.querySelector('h3').textContent==='Codrops')));
  await page.evaluate(()=>Array.from(document.querySelectorAll('.maker-reference-bar .reference-library-card')).find(card=>card.querySelector('h3').textContent==='Codrops').querySelector('button').click());
  await wait(()=>page.evaluate(()=>document.querySelector('.website-brief input[type=url]').value==='https://tympanus.net/codrops/'));
  assert.equal(await page.evaluate(()=>document.querySelector('.website-preview h1').textContent),metadata.headline);
  await page.evaluate(()=>document.querySelector('.maker-reference-bar details').open=false);
  await page.evaluate(()=>document.querySelector('.website-brief button[type=submit]').click());
  await wait(()=>page.evaluate(()=>document.querySelector('.save-state').textContent==='저장됨'));
  websiteId=(await json('/api/websites')).find(p=>p.title===metadata.title).id;
  const saved=await json(`/api/websites/${websiteId}`);assert.equal(saved.referenceTitle,'Codrops');assert.equal(saved.brand,metadata.brand);report.referenceFilters=true;report.referenceApply=true;
  let shot=await page._client().send('Page.captureScreenshot',{format:'png'});await fs.writeFile('out/qa/website-reference-metadata.png',Buffer.from(shot.value.data,'base64'));
  await page.goto({url:base+`/websites/${websiteId}`,timeout:60000});assert.equal(await page.evaluate(()=>document.querySelector('.website-preview h1').textContent),metadata.headline);
  await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  for(const route of ['/studio?view=templates','/websites','/gallery','/architecture/viewer','/exports','/references']){
   await page.goto({url:base+route,timeout:60000});await wait(()=>page.evaluate(()=>Boolean(document.querySelector('.app-gnb nav'))));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,route+' mobile overflow');
  }
  shot=await page._client().send('Page.captureScreenshot',{format:'png'});await fs.writeFile('out/qa/reference-library-mobile.png',Buffer.from(shot.value.data,'base64'));
  report.mobileOverflow=false;report.logs=logs;await fs.writeFile('out/qa/studio-expansion-result.json',JSON.stringify(report,null,2));console.log('PASS',JSON.stringify(report));
 }finally{
  if(browser)await browser.close({silent:true});
  for(const [dir,id] of [['websites',websiteId],['projects',projectId]])if(id){assert.match(id,/^[a-zA-Z0-9-]+$/);await fs.unlink(path.join('.local-data',dir,id+'.json')).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
