const {authorizePage}=require('./verify-session.cjs');const fs=require('fs/promises'),assert=require('assert/strict'),{openBrowser}=require('@remotion/renderer');const base=process.env.VERIFY_BASE||'http://127.0.0.1:4101';let browser;
async function wait(check){for(let i=0;i<100;i++){if(await check())return;await new Promise(r=>setTimeout(r,80));}throw Error('wait timeout');}
async function shot(page,name){await fs.writeFile('out/qa/'+name,Buffer.from((await page._client().send('Page.captureScreenshot',{format:'png'})).value.data,'base64'));}
(async()=>{try{
 browser=await openBrowser('chrome',{browserExecutable:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',chromiumOptions:{headless:true}});const page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:()=>{},onLog:()=>{}});await authorizePage(page);
 await page.setViewport({width:1440,height:1050,deviceScaleFactor:1,isMobile:false,hasTouch:false});await page.goto({url:base+'/website-requirements',timeout:60000});await new Promise(r=>setTimeout(r,500));
 assert.equal(await page.evaluate(()=>document.querySelector('.requirements-live').dataset.tier),'basic');
 await page.evaluate(()=>document.querySelector('[name=feature][value=cms]').click());
 await wait(()=>page.evaluate(()=>document.querySelector('.requirements-live').dataset.tier==='business'));
 await new Promise(r=>setTimeout(r,40));
 const moving=await page.evaluate(()=>({transform:document.querySelector('.requirements-live-summary').style.transform,opacity:document.querySelector('.requirements-live-summary').style.opacity}));assert.ok(moving.transform||moving.opacity);
 await page.evaluate(()=>document.querySelector('[name=feature][value=threeD]').click());await wait(()=>page.evaluate(()=>document.querySelector('.requirements-live').dataset.tier==='premium'));
 await page.evaluate(()=>document.querySelector('[name=feature][value=threeD]').click());await wait(()=>page.evaluate(()=>document.querySelector('.requirements-live').dataset.tier==='business'));
 await page.evaluate(()=>document.querySelector('[name=feature][value=cms]').click());await wait(()=>page.evaluate(()=>document.querySelector('.requirements-live').dataset.tier==='basic'));
 const dimensions=await page.evaluate(()=>{const r=document.querySelector('.requirement-feature-grid label').getBoundingClientRect();return {height:r.height,width:r.width,title:getComputedStyle(document.querySelector('h1')).fontSize};});assert.ok(dimensions.height<120);assert.equal(dimensions.title,'30px');
 await shot(page,'requirements-compact-desktop.png');
 await page._client().send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await page.evaluate(()=>document.querySelector('[name=feature][value=cinematic]').click());await new Promise(r=>setTimeout(r,100));
 assert.equal(await page.evaluate(()=>document.querySelector('.requirements-live').dataset.tier),'premium');assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.requirements-live-summary')).transform),'none');
 await page.goto({url:base+'/',timeout:60000});await new Promise(r=>setTimeout(r,400));assert.ok(await page.evaluate(()=>Array.from(document.querySelectorAll('a')).some(a=>a.textContent==='홈페이지 제작 신청'&&a.getAttribute('href')==='/website-requirements')));
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copied=value;}}});document.querySelector('.requirements-link-control button').click();});await wait(()=>page.evaluate(()=>window.__copied===`${location.origin}/website-requirements`));
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}});document.querySelector('.requirements-link-control button').click();});await wait(()=>page.evaluate(()=>!!document.querySelector('[aria-label="개발요구사항 주소"]')));
 await shot(page,'landing-application-desktop.png');
 await page.goto({url:base+'/websites',timeout:60000});await shot(page,'website-products-compact.png');assert.ok(await page.evaluate(()=>document.querySelector('.requirements-top-actions button').textContent.includes('링크 복사')));
 await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
 for(const route of ['/','/websites','/website-requirements']){await page.goto({url:base+route,timeout:60000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);if(route==='/website-requirements')await shot(page,'requirements-compact-mobile.png');}
 await fs.writeFile('out/qa/requirements-motion-result.json',JSON.stringify({liveUpgradeDowngrade:true,gsapInlineMotion:moving,reducedMotion:true,dimensions,landingApplication:true,linkCopy:true,clipboardFallback:true,mobileOverflow:false},null,2));console.log('PASS: immediate recommendation upgrades/downgrades, GSAP motion, reduced motion, compact cards, landing application/copy, clipboard fallback and mobile');
}finally{await browser?.close({silent:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
