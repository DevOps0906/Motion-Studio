const fs=require('fs/promises'),path=require('path'),assert=require('assert/strict'),{randomUUID,createHash}=require('crypto'),{DatabaseSync}=require('node:sqlite'),{pathToFileURL}=require('url'),{openBrowser}=require('@remotion/renderer');
const base=process.env.VERIFY_BASE||'http://127.0.0.1:4101',email='requirements-qa-'+randomUUID()+'@example.test';let browser,id;
async function wait(check){for(let i=0;i<100;i++){try{if(await check())return;}catch(e){if(!/context was destroyed/.test(e.message))throw e;}await new Promise(r=>setTimeout(r,100));}throw Error('Wait timeout');}
async function shot(page,name){await fs.writeFile('out/qa/'+name,Buffer.from((await page._client().send('Page.captureScreenshot',{format:'png'})).value.data,'base64'));}
(async()=>{try{
 const signup=await fetch(base+'/api/auth',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'register',name:'접수 QA 운영자',email,password:randomUUID()+'Aa9!'})});assert.equal(signup.status,200);const cookie=signup.headers.get('set-cookie').split(';')[0];
 assert.equal((await fetch(base+'/api/website-requirements')).status,401);
 browser=await openBrowser('chrome',{browserExecutable:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',chromiumOptions:{headless:true}});
 const page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:()=>{},onLog:()=>{}});
 await page.setViewport({width:1440,height:1050,deviceScaleFactor:1,isMobile:false,hasTouch:false});
 await page.goto({url:base+'/websites',timeout:60000});assert.ok(await page.evaluate(()=>document.querySelector('.requirements-entry-card')?.getAttribute('href')==='/website-requirements'));
 await page.goto({url:base+'/website-requirements',timeout:60000});await new Promise(r=>setTimeout(r,500));
 await page.evaluate(()=>{document.querySelector('[name=delivery][value=both]').click();document.querySelector('[name=goal][value=growth]').click();document.querySelector('[name=feature][value=crm]').click();document.querySelector('[name=solution][value=erp]').click();document.querySelector('.requirements-form button[type=submit]').click();});
 await wait(()=>page.evaluate(()=>!!document.querySelector('.requirements-contact')));
 assert.equal(await page.evaluate(()=>document.querySelector('.requirements-result h2').textContent),'BUSINESS + 홈페이지형 블로그');
 const grouped=await page.evaluate(()=>Array.from(document.querySelectorAll('.requirement-feature-group')).map(group=>({tier:group.dataset.tier,features:Array.from(group.querySelectorAll('[name=feature]')).map(input=>input.value),reference:group.querySelector('.requirement-reference-card').getAttribute('aria-disabled')})));
 assert.equal(grouped.map(item=>item.tier).join(','),'basic,business,premium');assert.ok(grouped[1].features.includes('commerce')&&!grouped[2].features.includes('commerce'));assert.ok(grouped.every(item=>item.reference==='true'));
 await page.evaluate(()=>{const input=document.querySelector('[name=timeline]');if(input.type!=='date')throw Error('Missing native calendar');input.showPicker=()=>{window.__calendarOpened=true;};document.querySelector('[aria-label="희망일정 캘린더 열기"]').click();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2026-12-15');input.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await page.evaluate(()=>window.__calendarOpened),true);
 await page.evaluate(()=>document.querySelector('.requirements-form button[type=submit]').click());

 for(const [key,value] of Object.entries({name:'QA 담당자',company:'QA 요구사항 회사',phone:'010-1234-5678',email})){
  await page.evaluate(({key,value})=>{const el=document.querySelector(`.requirements-contact [name="${key}"]`);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));},{key,value});await new Promise(r=>setTimeout(r,40));
 }
 await page.evaluate(()=>{document.querySelector('.requirements-consent input').click();document.querySelector('.requirements-contact button[type=submit]').click();});
 await wait(()=>page.evaluate(()=>document.querySelector('.requirements-contact')?.textContent.includes('접수되었습니다.')));
 const inbox=await (await fetch(base+'/api/website-requirements',{headers:{cookie}})).json();const saved=inbox.find(item=>item.contact.email===email);assert.ok(saved);id=saved.id;assert.equal(saved.contact.company,'QA 요구사항 회사');assert.equal(saved.recommendation.tier,'business');assert.equal(saved.recommendation.blog,true);assert.ok(saved.answers.features.includes('crm'));assert.ok(saved.answers.solutions.includes('erp'));assert.ok(saved.recommendation.solutions.includes('ERP · 업무관리'));assert.equal(saved.answers.timeline,'2026-12-15');
 await shot(page,'requirements-submitted.png');
 const payload={submissionKey:randomUUID(),consent:false,website:'',contact:saved.contact,answers:saved.answers};
 assert.equal((await fetch(base+'/api/website-requirements',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify(payload)})).status,400);
 const database=new DatabaseSync('.local-data/requirements.sqlite');const key=database.prepare('SELECT submission_key FROM submissions WHERE id=?').get(id).submission_key;database.close();
 const duplicate=await fetch(base+'/api/website-requirements',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({...payload,consent:true,submissionKey:key})});assert.equal((await duplicate.json()).id,id);
 await page._client().send('Network.setCookie',{name:'motion-studio-session',value:cookie.slice(cookie.indexOf('=')+1),url:base,httpOnly:true,sameSite:'Lax'});
 await page.goto({url:base+'/requirements-inbox',timeout:60000});await wait(()=>page.evaluate(email=>document.querySelector('.requirements-inbox')?.textContent.includes(email),email));await shot(page,'requirements-inbox.png');
 const csvFolder=path.resolve('out/qa/requirements-csv-'+randomUUID());await fs.mkdir(csvFolder,{recursive:true});await page._client().send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:csvFolder});
 await page.evaluate(()=>Array.from(document.querySelectorAll('button')).find(el=>el.textContent==='구글시트용 CSV 다운로드').click());
 await wait(async()=>!!(await fs.stat(path.join(csvFolder,'website-requirements.csv')).catch(()=>null)));
 const csv=await fs.readFile(path.join(csvFolder,'website-requirements.csv'),'utf8');assert.ok(csv.includes(email)&&csv.includes('담당자')&&csv.includes('문의 저장·고객 관리'));

 await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});await page.goto({url:base+'/website-requirements',timeout:60000});await new Promise(r=>setTimeout(r,500));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot(page,'requirements-mobile.png');await page.evaluate(()=>document.querySelector('.requirement-feature-group[data-tier=business]').scrollIntoView());await shot(page,'requirements-grouped-mobile.png');
 const downloads=path.resolve('out/qa/requirements-download');await fs.mkdir(downloads,{recursive:true});await page._client().send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
 await page.evaluate(()=>Array.from(document.querySelectorAll('button')).find(el=>el.textContent==='오프라인 진단 HTML 다운로드').click());await wait(async()=>!!(await fs.stat(path.join(downloads,'website-requirements.html')).catch(()=>null)));
 const offline=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:1,onBrowserLog:()=>{},onLog:()=>{}});await offline.goto({url:pathToFileURL(path.join(downloads,'website-requirements.html')).href,timeout:60000});
 await offline.evaluate(()=>{document.querySelector('[name=delivery]').value='both';document.querySelector('[name=goal]').value='brand';document.querySelector('#finder button').click();});
 assert.equal(await offline.evaluate(()=>document.querySelector('#result h2').textContent),'PREMIUM + 홈페이지형 블로그');
 await page.evaluate(()=>{document.querySelector('[name=delivery][value=blog]').click();document.querySelector('.requirements-form button[type=submit]').click();});await wait(()=>page.evaluate(()=>!!document.querySelector('#requirements-result')));assert.equal(await page.evaluate(()=>document.querySelector('#requirements-result h2').textContent),'홈페이지형 블로그');
 await fs.writeFile('out/qa/requirements-result.json',JSON.stringify({card:true,businessWithBlog:true,contactAndAnswersStored:true,unauthenticatedDenied:true,consentRequired:true,idempotent:true,operatorInbox:true,mobileOverflow:false,offlineArtifact:true,blogOnly:true,groupedTiers:true,nativeCalendar:true,datePersisted:true,referencePlaceholders:true},null,2));console.log('PASS: customer diagnosis, blog choices, contact/consent submission, SQLite persistence, protected inbox, duplicate prevention, mobile and downloaded offline HTML');
}finally{
 await browser?.close({silent:true});if(id){const database=new DatabaseSync('.local-data/requirements.sqlite');database.prepare('DELETE FROM submissions WHERE id=?').run(id);database.close();}
 await fs.unlink(path.join('.local-data/accounts/users',createHash('sha256').update(email).digest('hex')+'.json')).catch(()=>{});
 for(const name of await fs.readdir('.local-data/accounts/sessions').catch(()=>[])){const file=path.join('.local-data/accounts/sessions',name),session=JSON.parse(await fs.readFile(file,'utf8'));if(session.email===email)await fs.unlink(file);}
}})().catch(e=>{console.error(e);process.exitCode=1;});
