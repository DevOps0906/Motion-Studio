const {authorizePage}=require('./verify-session.cjs');const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {openBrowser} = require('@remotion/renderer');
const base = process.env.VERIFY_BASE || process.env.WEBSITE_QA_URL || 'http://127.0.0.1:4101';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function wait(check) {for(let i=0;i<100;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,250));}throw new Error('Sample media UI timeout');}
(async()=>{
  const manifest=JSON.parse(await fs.readFile('public/photos/manifest.json','utf8'));
  const prepared=await fetch(base+'/api/media/prepare',{method:'POST'});assert.equal(prepared.status,200);
  const media=await fetch(base+'/api/media').then(response=>response.json());
  assert.equal(media.filter(asset=>asset.role==='source-capture').length,5);
  const samples=media.filter(asset=>/^starter-\d{2}\.jpg$/.test(asset.name));assert.equal(samples.length,36);
  assert.equal(media.some(asset=>/^starter-source-/.test(asset.name)),false);
  for(const source of manifest.sources){
    const response=await fetch(base+'/api/media/'+source.id);assert.equal(response.status,200);
    assert.equal(digest(Buffer.from(await response.arrayBuffer())),source.sha256);
  }
  for(const photo of manifest.photos){
    const asset=samples.find(asset=>asset.name==='starter-'+photo.file);assert.ok(asset);
    assert.equal(asset.sourceAssetId,photo.sourceAssetId);
    const response=await fetch(base+asset.url);assert.equal(response.status,200);
    assert.equal(digest(Buffer.from(await response.arrayBuffer())),photo.sha256);
  }
  assert.equal((await fetch(base+'/api/media/prepare',{method:'POST'}).then(response=>response.json())).created,0);
  const projects=await fetch(base+'/api/projects').then(response=>response.json());
  for(const project of projects)for(const id of project.photos)assert.ok(media.some(asset=>asset.id===id),'Preserve existing project photo references');
  const browser=await openBrowser('chrome',{browserExecutable:process.env.REMOTION_BROWSER_EXECUTABLE||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',chromiumOptions:{headless:true,gl:'swangle'}});
  const logs=[];
  try{
    const page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:log=>logs.push(log),onLog:()=>{}});await authorizePage(page);
    await fs.mkdir('out/qa',{recursive:true});
    await page.setViewport({width:1600,height:1100,deviceScaleFactor:1,isMobile:false,hasTouch:false});
    await page.goto({url:base+'/studio',timeout:60000});
    await wait(()=>page.evaluate(()=>Boolean(document.querySelector('.hero-art img')?.complete&&document.querySelector('.hero-art img')?.naturalWidth)));
    assert.equal(await page.evaluate(()=>document.querySelector('.hero-art img').getAttribute('src')),`/api/media/${manifest.sources[0].id}`);
    await wait(()=>page.evaluate(()=>Array.from(document.images).filter(img=>img.loading!=='lazy'||img.getBoundingClientRect().top<innerHeight).every(img=>img.complete&&img.naturalWidth>0)));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    let shot=await page._client().send('Page.captureScreenshot',{format:'png'});
    await fs.writeFile('design/motion-studio-dashboard.png',Buffer.from(shot.value.data,'base64'));
    await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    shot=await page._client().send('Page.captureScreenshot',{format:'png'});
    await fs.writeFile('design/motion-studio-mobile.png',Buffer.from(shot.value.data,'base64'));
    await page.setViewport({width:1440,height:1050,deviceScaleFactor:1,isMobile:false,hasTouch:false});
    await page.evaluate(()=>Array.from(document.querySelectorAll('button')).find(button=>button.textContent.includes('사진·로고로 15초')).click());
    await wait(()=>page.evaluate(()=>document.querySelectorAll('.quick-photo').length>=36));
    await wait(()=>page.evaluate(()=>Array.from(document.querySelectorAll('.quick-photo img')).every(img=>img.complete&&img.naturalWidth>0)));
    shot=await page._client().send('Page.captureScreenshot',{format:'png'});
    await fs.writeFile('design/motion-studio-quick-create.png',Buffer.from(shot.value.data,'base64'));
    await page.goto({url:base+'/gallery',timeout:60000});
    await wait(()=>page.evaluate(()=>Boolean(document.querySelector('canvas'))));
    await new Promise(resolve=>setTimeout(resolve,1800));
    shot=await page._client().send('Page.captureScreenshot',{format:'png'});
    await fs.writeFile('out/qa/new-image-gallery.png',Buffer.from(shot.value.data,'base64'));
    await fs.writeFile('out/qa/sample-media-result.json',JSON.stringify({sources:5,photos:36,registeredHashes:true,projectReferences:true,prepareIdempotent:true,dashboard:true,quickCreate:true,mobileOverflow:false,logs},null,2));
    console.log('PASS: 5 sources / 36 photos, registered image hashes, existing project references, idempotent preparation, dashboard/quick-create/gallery and refreshed design images');
  }finally{await browser.close({silent:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
