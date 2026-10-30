const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict'),ts=require('typescript');let stored=null;
function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module,exports:module.exports,localStorage:{getItem:()=>stored,setItem:(_,value)=>{stored=value;}},require:id=>load(path.join(path.dirname(file),id+'.ts'))});return module.exports;}
const api=load('lib/production-settings.ts');assert.equal(api.loadProductionSettings().videoResolution,'1080p');
const selected={videoResolution:'2160p',videoPreset:'orbit',websiteTheme:'light',websiteAccent:'#123abc',blogStyle:'magazine',blogAccent:'#aabbcc'};
api.saveProductionSettings(selected);assert.equal(api.loadProductionSettings().videoResolution,'2160p');assert.equal(api.loadProductionSettings().blogStyle,'magazine');
stored='{invalid json';assert.equal(api.loadProductionSettings().videoPreset,'mosaic');
const clean=api.normalizeProductionSettings({videoResolution:'8k',videoPreset:'bad',websiteAccent:'url(example)',blogAccent:'#12',websiteTheme:'unknown',blogStyle:null});assert.equal(clean.videoResolution,'1080p');assert.equal(clean.websiteAccent,'#c4b5fd');assert.equal(clean.blogStyle,'corporate');assert.equal(clean.websiteTheme,'dark');
console.log('PASS: production settings persistence, defaults, corrupt storage recovery and enum/color validation');
