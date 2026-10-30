const fs=require('fs/promises'),assert=require('assert/strict');
const {openBrowser}=require('@remotion/renderer');
(async()=>{let browser;try{
 browser=await openBrowser('chrome',{browserExecutable:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',chromiumOptions:{headless:true}});
 let page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:()=>{},onLog:()=>{}});
 await page.setViewport({width:1440,height:1000,deviceScaleFactor:1,isMobile:false,hasTouch:false});
 await page.goto({url:'http://127.0.0.1:4101/websites/editor/basic',timeout:60000});
 await new Promise(r=>setTimeout(r,900));
 const results=[];
 for(const kit of ['minimal','publication','portfolio']){
  await page.evaluate(kit=>{const select=document.querySelector('[aria-label="디자인 키트"]');if(!select)throw Error('No kit selector');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,kit);select.dispatchEvent(new Event('change',{bubbles:true}));},kit);
  await new Promise(r=>setTimeout(r,200));
  results.push(await page.evaluate(()=>{const preview=document.querySelector('.website-preview'),cover=preview.querySelector('.website-art,.website-cover');return {className:preview.className,radius:getComputedStyle(cover).borderRadius,font:getComputedStyle(preview.querySelector('h1')).fontFamily};}));
  assert.ok(results.at(-1).className.includes('website-kit-'+kit));
  assert.equal(results.at(-1).radius, {minimal:'0px',publication:'2px',portfolio:'24px'}[kit]);
  if(kit==='publication')assert.ok(results.at(-1).font.includes('Georgia'));
 }
 await fs.writeFile('out/qa/design-kits-desktop.png',Buffer.from((await page._client().send('Page.captureScreenshot',{format:'png'})).value.data,'base64'));
 await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await fs.writeFile('out/qa/design-kits-mobile.png',Buffer.from((await page._client().send('Page.captureScreenshot',{format:'png'})).value.data,'base64'));
 page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:1,onBrowserLog:()=>{},onLog:()=>{}});
 await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await page.goto({url:'http://127.0.0.1:4101/exports',timeout:60000});
 await new Promise(r=>setTimeout(r,500));
 const web=await page.evaluate(()=>Array.from(document.querySelectorAll('a')).find(a=>a.textContent==='CapCut 웹버전')?.href);
 assert.equal(web,'https://www.capcut.com/editor');
 await page.evaluate(()=>Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='CapCut 로컬버전').click());
 for(let i=0;i<40;i++){if(await page.evaluate(()=>document.body.textContent.includes('CapCut 로컬버전을 실행했습니다.')))break;await new Promise(r=>setTimeout(r,250));}
 assert.equal(await page.evaluate(()=>document.body.textContent.includes('CapCut 로컬버전을 실행했습니다.')),true);
 await fs.writeFile('out/qa/capcut-launch-mobile.png',Buffer.from((await page._client().send('Page.captureScreenshot',{format:'png'})).value.data,'base64'));
 await fs.writeFile('out/qa/design-capcut-result.json',JSON.stringify({kits:results,mobileOverflow:false,web,localLaunch:'launched'},null,2));
 console.log('PASS: three live design kits, mobile layout, web URL and installed CapCut launch');
}finally{await browser?.close({silent:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
