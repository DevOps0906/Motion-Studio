const fs=require('fs/promises'),path=require('path'),assert=require('assert/strict');
const {randomUUID,createHash}=require('crypto'),{openBrowser}=require('@remotion/renderer');
const base='http://127.0.0.1:4101',email=`qa-${randomUUID()}@example.test`,password=randomUUID()+'Aa9!',name='QA 제작자';
let browser;
async function wait(check){for(let i=0;i<100;i++){try{if(await check())return;}catch(error){if(!/context was destroyed|Cannot find context/.test(error.message))throw error;}await new Promise(r=>setTimeout(r,100));}throw Error('Wait timeout');}
async function shot(page,file){await fs.writeFile(file,Buffer.from((await page._client().send('Page.captureScreenshot',{format:'png'})).value.data,'base64'));}
(async()=>{try{
 const response=await fetch(base+'/api/auth',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'register',email,password,name})});assert.equal(response.status,200);
 const cookie=response.headers.get('set-cookie').split(';')[0];assert.ok(response.headers.get('set-cookie').includes('HttpOnly'));assert.ok(response.headers.get('set-cookie').includes('SameSite=Lax'));
 assert.equal((await response.json()).redirect,'/studio?view=dashboard');
 const stored=JSON.parse(await fs.readFile(path.join('.local-data/accounts/users',createHash('sha256').update(email).digest('hex')+'.json'),'utf8'));assert.equal(stored.password,undefined);assert.ok(!JSON.stringify(stored).includes(password));
 assert.equal((await (await fetch(base+'/api/auth',{headers:{cookie}})).json()).account.name,name);
 const bad=await fetch(base+'/api/auth',{method:'POST',headers:{origin:base,'Content-Type':'application/json'},body:JSON.stringify({action:'login',email,password:'incorrect password'})});assert.equal(bad.status,400);
 const forbidden=await fetch(base+'/api/auth',{method:'POST',headers:{origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal(forbidden.status,403);
 await fetch(base+'/api/auth',{method:'DELETE',headers:{origin:base,cookie}});
 assert.equal((await (await fetch(base+'/api/auth',{headers:{cookie}})).json()).account,null);
 browser=await openBrowser('chrome',{browserExecutable:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',chromiumOptions:{headless:true}});
 const page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:()=>{},onLog:()=>{}});
 await page.setViewport({width:1440,height:1000,deviceScaleFactor:1,isMobile:false,hasTouch:false});
 await page.goto({url:base+'/login',timeout:60000});
 await wait(()=>page.evaluate(()=>Boolean(document.querySelector('input[name="email"]'))));
 await page.evaluate(({email,password})=>{for(const [key,value] of Object.entries({email,password})){const input=document.querySelector(`input[name="${key}"]`);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('.account-page form button').click();},{email,password});
 await wait(()=>page.evaluate(()=>location.pathname==='/studio'&&location.search==='?view=dashboard'&&document.querySelector('.account-menu')?.textContent.includes('QA 제작자')));
 await shot(page,'out/qa/account-dashboard.png');
 await page.evaluate(()=>document.querySelector('.app-gnb .brand').click());
 await wait(()=>page.evaluate(()=>location.pathname==='/'&&!!document.querySelector('.landing-page')));
 await page.evaluate(()=>document.querySelector('.app-gnb a[aria-label="대시보드"]').click());
 await wait(()=>page.evaluate(()=>location.pathname==='/studio'&&location.search==='?view=dashboard'));
 await page.goto({url:base+'/login',timeout:60000});
 await wait(()=>page.evaluate(()=>location.pathname==='/studio'&&location.search==='?view=dashboard'));
 await page.goto({url:base+'/websites',timeout:60000});
 const cards=await page.evaluate(()=>Array.from(document.querySelectorAll('.product-card')).map(a=>({title:a.querySelector('h2').textContent,url:a.querySelector('a').getAttribute('href')})));assert.equal(cards.length,3);
 await shot(page,'out/qa/website-type-cards-desktop.png');
 for(const [tier,layout,kit] of [['basic','studio','minimal'],['business','editorial','publication'],['premium','gallery','portfolio']]){
  await page.goto({url:base+'/websites/editor/'+tier,timeout:60000});await wait(()=>page.evaluate(()=>Boolean(document.querySelector('.website-preview'))));
  assert.equal(await page.evaluate(({layout,kit})=>{const p=document.querySelector('.website-preview');return p.classList.contains('website-design-'+layout)&&p.classList.contains('website-kit-'+kit);},{layout,kit}),true);
 }
 await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});await page.goto({url:base+'/websites',timeout:60000});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot(page,'out/qa/website-type-cards-mobile.png');
 await page.evaluate(()=>{document.querySelector('.account-menu summary').click();Array.from(document.querySelectorAll('.account-menu button')).find(b=>b.textContent==='로그아웃').click();});
 await wait(()=>page.evaluate(()=>location.pathname==='/login'&&document.querySelector('.account-menu a')?.textContent==='로그인'));
 await fs.writeFile('out/qa/navigation-account-result.json',JSON.stringify({registration:true,hashedPassword:true,sessionRevoked:true,crossOriginRejected:true,loginRedirect:true,logoLanding:true,dashboardHome:true,accountShown:true,cards,mobileOverflow:false,logout:true},null,2));
 console.log('PASS: local account registration/login/logout, hashed password, session revocation, landing/dashboard navigation, account header and three website type entries');
}finally{
 await browser?.close({silent:true});
 const accountFile=path.join('.local-data/accounts/users',createHash('sha256').update(email).digest('hex')+'.json');await fs.unlink(accountFile).catch(()=>{});
 for(const file of await fs.readdir('.local-data/accounts/sessions').catch(()=>[])){const p=path.join('.local-data/accounts/sessions',file);const s=JSON.parse(await fs.readFile(p,'utf8'));if(s.email===email)await fs.unlink(p);}
}})().catch(e=>{console.error(e);process.exitCode=1;});
