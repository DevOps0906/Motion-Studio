const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const {bundle}=require('@remotion/bundler'),{openBrowser,selectComposition,renderStill,renderMedia}=require('@remotion/renderer'),sharp=require('sharp');
function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(require('fs').readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,require:id=>id.startsWith('.')?load(path.join(path.dirname(file),id+'.ts')):require(id)});return module.exports;}
(async()=>{let serveUrl,browser;try{
 const {DEFAULT_PROJECT,templates,renderResolutions}=load('lib/model.ts');
 await fs.mkdir('out/qa/motion-presets',{recursive:true});
 serveUrl=await bundle({entryPoint:path.resolve('remotion/index.ts')});
 browser=await openBrowser('chrome',{browserExecutable:process.env.REMOTION_BROWSER_EXECUTABLE||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',chromiumOptions:{headless:true,gl:'swangle'}});
 const results=[];
 for(const preset of templates){
  const inputProps={project:{...DEFAULT_PROJECT,template:preset.id,resolution:{width:1280,height:720}},media:[]};
  const composition=await selectComposition({serveUrl,id:'PhotoWallIntro',inputProps,puppeteerInstance:browser,chromiumOptions:{gl:'swangle'}});
  const output=`out/qa/motion-presets/${preset.id}.png`;
  await renderStill({serveUrl,composition,inputProps,frame:60,scale:.5,output,puppeteerInstance:browser,chromiumOptions:{gl:'swangle'},timeoutInMilliseconds:120000});
  const meta=await sharp(output).metadata();assert.equal(meta.width,640);assert.equal(meta.height,360);results.push(preset.id);console.log('Rendered',preset.id);
 }
 const resolutions=[];
 for(const resolution of renderResolutions){
  const inputProps={project:{...DEFAULT_PROJECT,template:'flip',resolution:{width:resolution.width,height:resolution.height}},media:[]};
  const composition=await selectComposition({serveUrl,id:'PhotoWallIntro',inputProps,puppeteerInstance:browser,chromiumOptions:{gl:'swangle'}});
  assert.equal(composition.width,resolution.width);assert.equal(composition.height,resolution.height);
  if(resolution.id==='2160p'){
   await renderStill({serveUrl,composition,inputProps,frame:120,output:'out/qa/motion-4k.png',puppeteerInstance:browser,chromiumOptions:{gl:'swangle'},timeoutInMilliseconds:120000});
   const meta=await sharp('out/qa/motion-4k.png').metadata();assert.equal(meta.width,3840);assert.equal(meta.height,2160);
  }
  if(resolution.id==='720p')await renderMedia({serveUrl,composition:{...composition,durationInFrames:2},inputProps,codec:'h264',pixelFormat:'yuv420p',outputLocation:'out/qa/motion-720p-smoke.mp4',puppeteerInstance:browser,chromiumOptions:{gl:'swangle'},concurrency:1});
  resolutions.push({id:resolution.id,width:composition.width,height:composition.height});
 }
 await fs.writeFile('out/qa/motion-render-result.json',JSON.stringify({presets:results,resolutions,actual4kStill:true,actual720pMp4:true,smokeVideoFrames:2},null,2));console.log('PASS: 13 rendered preset frames, four composition resolutions, actual 4K image and 720p H.264 smoke video');
 }finally{if(browser)await browser.close({silent:true});if(serveUrl){const target=path.resolve(serveUrl),temp=path.resolve(os.tmpdir());if(target.startsWith(temp+path.sep))await fs.rm(target,{recursive:true,force:true});}}
})().catch(error=>{console.error(error);process.exitCode=1;});
