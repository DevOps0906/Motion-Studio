// npm run stt:model -- [small|base|all]   (operator CLI, run with the server stopped)
// Downloads the pinned whisper.cpp model files into STT_MODEL_DIR (default .stt-models) and enables them only after the SHA256 matches.
// Source: Hugging Face ggerganov/whisper.cpp at a fixed revision. A mismatch deletes the download, removes the manifest entry and exits non-zero (local engine stays off).
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{Readable}=require('node:stream'),{pipeline}=require('node:stream/promises');
const REVISION='5359861c739e955e79d9a303bcbc70fb988958b1';
const BASE_URL=`https://huggingface.co/ggerganov/whisper.cpp/resolve/${REVISION}`;
const MODELS={
 small:{file:'ggml-small.bin',sha256:'1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b',size:487601967},
 base:{file:'ggml-base.bin',sha256:'60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',size:147951465},
};
const modelDir=()=>process.env.STT_MODEL_DIR||path.join(process.cwd(),'.stt-models');
const readManifest=dir=>{try{const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));return manifest&&typeof manifest.models==='object'?manifest:{models:{}};}catch{return {models:{}};}};
function writeManifest(dir,manifest){const temp=path.join(dir,'manifest.json.tmp');fs.writeFileSync(temp,JSON.stringify(manifest,null,2));fs.renameSync(temp,path.join(dir,'manifest.json'));}
function checkBase(url){const parsed=new URL(url);if(!(parsed.protocol==='https:'||(parsed.protocol==='http:'&&['127.0.0.1','localhost'].includes(parsed.hostname))))throw new Error('모델 주소는 https여야 합니다.');return url.replace(/\/+$/,'');}
// expected: {file,sha256,size}. The pinned values are the default; tests may pass their own.
async function installModel(name,{dir=modelDir(),baseUrl=process.env.STT_MODEL_BASE_URL||BASE_URL,expected=MODELS[name]}={}){
 if(!expected)throw new Error('알 수 없는 모델입니다: '+name);
 fs.mkdirSync(dir,{recursive:true});
 const target=path.join(dir,expected.file),partial=target+'.partial';
 const forget=()=>{const manifest=readManifest(dir);delete manifest.models[name];writeManifest(dir,manifest);};
 try{
  const response=await fetch(`${checkBase(baseUrl)}/${expected.file}`,{redirect:'follow'});
  if(!response.ok||!response.body)throw new Error(`모델을 받지 못했습니다 (HTTP ${response.status}).`);
  const hash=crypto.createHash('sha256');let size=0;
  await pipeline(Readable.fromWeb(response.body),async function*(source){for await(const chunk of source){hash.update(chunk);size+=chunk.length;if(size>expected.size)throw Object.assign(new Error('내려받은 크기가 기대 크기를 넘어 중단했습니다. 모델을 사용하지 않습니다.'),{mismatch:true});yield chunk;}},fs.createWriteStream(partial,{mode:0o644}));
  const digest=hash.digest('hex');
  if(digest!==expected.sha256||size!==expected.size)throw Object.assign(new Error(`SHA256이 일치하지 않습니다. 모델을 사용하지 않습니다 (기대 ${expected.sha256.slice(0,12)}…, 실제 ${digest.slice(0,12)}…).`),{mismatch:true});
  fs.renameSync(partial,target);
  const manifest=readManifest(dir);manifest.models[name]={file:expected.file,sha256:expected.sha256,size:expected.size,revision:REVISION};writeManifest(dir,manifest);
  return {name,file:target};
 }catch(error){
  fs.rmSync(partial,{force:true});
  if(error.mismatch){fs.rmSync(target,{force:true});forget();}
  throw error;
 }
}
module.exports={MODELS,REVISION,BASE_URL,installModel};
if(require.main===module){
 (async()=>{
  const arg=process.argv[2]||'small',names=arg==='all'?Object.keys(MODELS):[arg];
  if(names.some(name=>!MODELS[name])){console.error('사용법: npm run stt:model -- [small|base|all]');process.exit(1);}
  for(const name of names){await installModel(name);console.log(`${name}: 설치하고 SHA256을 확인했습니다.`);}
 })().catch(error=>{console.error('모델 설치 실패: '+error.message);process.exit(1);});
}
