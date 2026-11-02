import type {BlogSkinProject} from '../blog-skin';
import 'server-only';
import {promises as fs,createReadStream} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import sharp from 'sharp';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {DEFAULT_PROJECT,validateProject,type MediaAsset,type Project,type RenderJob} from '../model';
import type {WebsiteProject} from '../website';
import sampleManifest from '../../public/photos/manifest.json';
import {NotFoundError,allow,notFoundResponse,type Actor,type RecordAction} from './owner';
export const DATA=path.join(process.cwd(),'.local-data');
export const validId=(id:string)=>/^[a-zA-Z0-9-]{1,80}$/.test(id);
export async function writeJson(file:string,value:unknown){await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(value,null,2));for(let attempt=0;;attempt++){try{await fs.rename(temp,file);break;}catch(error){if(attempt>=7)throw error;await new Promise(resolve=>setTimeout(resolve,30*(attempt+1)));}}}
export async function readJson<T>(file:string):Promise<T>{for(let attempt=0;;attempt++){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(attempt>=4)throw error;await new Promise(resolve=>setTimeout(resolve,20*(attempt+1)));}}}
export async function listJson<T>(dir:string):Promise<T[]>{await fs.mkdir(dir,{recursive:true});const files=await fs.readdir(dir);return Promise.all(files.filter(f=>f.endsWith('.json')).map(f=>readJson<T>(path.join(dir,f))));}
export function fileFor(kind:'projects'|'media'|'renders',id:string){if(!validId(id))throw new Error('잘못된 ID입니다.');return path.join(DATA,kind,id+'.json');}
// Owner-checked read: a missing, unreadable or foreign record is the same NotFoundError (never an ENOENT message with a path).
export async function readOwned<T extends {id?:string;ownerId?:string}>(file:()=>string,actor:Actor,kind:string,id:string,action:RecordAction):Promise<T>{let record:T;try{record=await readJson<T>(file());}catch{throw new NotFoundError();}await allow(actor,record,kind,id,action);return record;}
export async function listMedia():Promise<MediaAsset[]>{
 const added=await listJson<MediaAsset>(path.join(DATA,'media'));const source:MediaAsset[]=[];
 for(const sample of sampleManifest.sources){try{const stat=await fs.stat(path.join(process.cwd(),'input','images',sample.file));source.push({id:sample.id,name:sample.file,type:'image',role:'source-capture',mimeType:'image/png',sizeBytes:stat.size,width:sample.width,height:sample.height,url:`/api/media/${sample.id}`,createdAt:stat.birthtime.toISOString()});}catch{}}
 return [...added,...source].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
// Media the account may reference from its own projects/websites: its own uploads plus the shared source-* samples.
export async function ownMedia(ownerId:string){return (await listMedia()).filter(m=>m.id.startsWith('source-')||m.ownerId===ownerId);}
// Reads media bytes for an actor (download). source-* samples are shared read-only.
export async function ownedMedia(actor:Actor,id:string,action:RecordAction='view'){if(!validId(id))throw new NotFoundError();if(id.startsWith('source-')){if(action!=='view')throw new NotFoundError();try{return await resolveMedia(id);}catch{throw new NotFoundError();}}await readOwned<MediaAsset>(()=>fileFor('media',id),actor,'media',id,action);return resolveMedia(id);}
// Strictly own (or sample) media for derivations such as crop and blog-skin images; the operator gets no exception here.
export async function ownedRef(ownerId:string,id:string){if(!validId(id))throw new NotFoundError();if(id.startsWith('source-'))return resolveMedia(id).catch(()=>{throw new NotFoundError();});let record:MediaAsset;try{record=await readJson<MediaAsset>(fileFor('media',id));}catch{throw new NotFoundError();}if(record.ownerId!==ownerId)throw new NotFoundError();return resolveMedia(id);}
export async function resolveMedia(id:string){if(!validId(id))throw new Error('잘못된 미디어 ID입니다.');if(id.startsWith('source-')){const source=sampleManifest.sources.find(sample=>sample.id===id);if(!source)throw new Error('원본 이미지를 찾을 수 없습니다.');return {file:path.join(process.cwd(),'input','images',source.file),mimeType:'image/png'};}const m=await readJson<MediaAsset>(fileFor('media',id));return {file:path.join(DATA,'files',id),mimeType:m.mimeType};}
export async function addMedia(bytes:Buffer,name:string,ownerId:string,sourceAssetId?:string,crop?:MediaAsset['crop']):Promise<MediaAsset>{
 let mimeType='',type:MediaAsset['type']='image',width:number|undefined,height:number|undefined;
 const image=bytes.subarray(0,3).equals(Buffer.from([255,216,255]))||bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP');
 if(image){if(bytes.length>20*1024**2)throw new Error('이미지는 20MiB 이하로 등록해 주세요.');const meta=await sharp(bytes,{limitInputPixels:8192*8192}).metadata();width=meta.width;height=meta.height;if(!width||!height||width>8192||height>8192)throw new Error('이미지의 최대 변은 8192px입니다.');mimeType=meta.format==='jpeg'?'image/jpeg':meta.format==='png'?'image/png':'image/webp';}
 else if(bytes.toString('ascii',4,8)==='ftyp'){mimeType='video/mp4';type='video';}
 else if(bytes.subarray(0,4).equals(Buffer.from([26,69,223,163]))){mimeType='video/webm';type='video';}
 else if(bytes.toString('ascii',0,3)==='ID3'||(bytes[0]===255&&((bytes[1]??0)&224)===224)){mimeType='audio/mpeg';type='audio';}
 else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WAVE'){mimeType='audio/wav';type='audio';}
 else throw new Error('JPG·PNG·WebP, MP4·WebM, MP3·WAV 파일을 등록해 주세요.');
 if(bytes.length>250*1024**2)throw new Error('파일은 250MiB 이하로 등록해 주세요.');
 const id=randomUUID();const asset:MediaAsset={ownerId,id,name:path.basename(name).slice(0,180),type,role:sourceAssetId?'derived-photo':type==='video'?'reference-video':type==='audio'?'audio':'photo',mimeType,sizeBytes:bytes.length,url:`/api/media/${id}`,createdAt:new Date().toISOString(),width,height,sourceAssetId,crop};
 await fs.mkdir(path.join(DATA,'files'),{recursive:true});await fs.writeFile(path.join(DATA,'files',id),bytes);try{if(type==='video'||type==='audio'){const probe=process.platform==='win32'?path.join(process.cwd(),'node_modules','@remotion','compositor-win32-x64-msvc','ffprobe.exe'):'ffprobe';const {stdout}=await promisify(execFile)(probe,['-v','error','-show_entries','format=duration:stream=codec_type,width,height','-of','json',path.join(DATA,'files',id)],{timeout:15000,windowsHide:true,maxBuffer:1024*1024});const meta=JSON.parse(stdout);const duration=Number(meta.format?.duration);if(!Number.isFinite(duration)||duration<=0||(type==='video'&&duration>300))throw new Error('재생 가능한 5분 이하 영상 또는 정상 오디오 파일을 등록해 주세요.');const stream=meta.streams?.find((s:{codec_type:string})=>s.codec_type===type);if(!stream)throw new Error('파일에 필요한 영상 또는 오디오 스트림이 없습니다.');asset.durationSeconds=duration;if(type==='video'){asset.width=stream.width;asset.height=stream.height;}}await writeJson(fileFor('media',id),asset);}catch(error){await fs.unlink(path.join(DATA,'files',id));throw error;}return asset;
}
export async function validateReferences(p:Project,ownerId:string,actor?:Actor,freezeCameras=false):Promise<Project>{const media=await ownMedia(ownerId);for(const id of p.photos){if(!media.some(m=>m.id===id&&m.type==='image'&&m.role!=='source-capture'))throw new Error('사진월에 사용할 사진을 다시 선택해 주세요.');}if(p.brand.logoAssetId&&!media.some(m=>m.id===p.brand.logoAssetId&&m.type==='image'))throw new Error('로고 파일을 찾을 수 없습니다.');if(p.audio.assetId&&!media.some(m=>m.id===p.audio.assetId&&m.type==='audio'))throw new Error('오디오 파일을 찾을 수 없습니다.');
 // task-010 B: the model must belong to the actor (the operator gets no exception: 'change'). Only when saving (freezeCameras) are the keyframe views required and their cameras copied; a render trusts the saved cameras, so a deleted view does not break it.
 if(!p.scene3d)return p;
 if(!actor||actor.id!==ownerId)throw new NotFoundError();
 const {getOwnedModel}=await import('./cad-models');
 const model=await getOwnedModel(p.scene3d.modelId,actor,'change');
 if(model.invalid)throw new Error('검증에 실패한 모델은 3D 워크스루에 쓸 수 없습니다. 모델을 다시 등록해 주세요.');
 if(!freezeCameras)return p;
 const keyframes=p.scene3d.keyframes.map(frame=>{const view=(model.views??[]).find(item=>item.id===frame.viewId);if(!view)throw new NotFoundError();return {viewId:view.id,camera:structuredClone(view.camera),atSeconds:frame.atSeconds};});
 return {...p,scene3d:{...p.scene3d,keyframes}};
}
export async function getProject(id:string,actor:Actor,action:RecordAction='view'){return readOwned<Project>(()=>fileFor('projects',id),actor,'project',id,action);}
export async function deleteProject(id:string,actor:Actor){await getProject(id,actor,'delete');await fs.unlink(fileFor('projects',id));}
// The owner always comes from the session (a client-sent ownerId is overwritten); editing another account's project is a 404.
export async function saveProject(input:unknown,id:string|undefined,actor:Actor){let existing:Project|undefined;if(id)existing=await getProject(id,actor,'change');const p=await validateReferences(validateProject(input),actor.id,actor,true);const now=new Date().toISOString();const saved={...p,id:id??randomUUID(),ownerId:existing?.ownerId??actor.id,createdAt:existing?.createdAt??now,updatedAt:now};await writeJson(fileFor('projects',saved.id),saved);return saved;}
export async function createProject(title:string,photos:string[]=[],template:Project['template']='mosaic',resolution:Project['resolution']=DEFAULT_PROJECT.resolution,actor:Actor){return saveProject({...DEFAULT_PROJECT,title,photos,template,resolution},undefined,actor);}
export async function streamFile(file:string,mimeType:string,request:Request,downloadName?:string){
 const stat=await fs.stat(file);let start=0,end=stat.size-1;let partial=false;const range=request.headers.get('range');
 if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${stat.size}`}});if(!match[1])start=Math.max(0,stat.size-Number(match[2]));else start=Number(match[1]);if(match[1]&&match[2])end=Math.min(end,Number(match[2]));if(start>end||start>=stat.size)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${stat.size}`}});partial=true;}
 const headers:Record<string,string>={'Content-Type':mimeType,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};if(partial)headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;if(downloadName)headers['Content-Disposition']=`attachment; filename="${downloadName}"`;
 return new Response(Readable.toWeb(createReadStream(file,{start,end})) as ReadableStream,{status:partial?206:200,headers});
}
export function apiError(error:unknown,status=400){if(error instanceof NotFoundError||(error as NodeJS.ErrnoException|undefined)?.code==='ENOENT')return notFoundResponse();return Response.json({error:error instanceof Error?error.message:'요청을 처리하지 못했습니다.'},{status});}
export type {RenderJob};



export async function deleteMedia(id:string,actor:Actor){
 if(id.startsWith('source-'))throw new Error('제공된 원본 캡처는 보존됩니다.');
 const asset=await readOwned<MediaAsset>(()=>fileFor('media',id),actor,'media',id,'delete');
 const projects=await listJson<Project>(path.join(DATA,'projects'));
 if(projects.some(p=>p.photos.includes(id)||p.brand.logoAssetId===id||p.audio.assetId===id))throw new Error('프로젝트에서 사용 중입니다. 먼저 프로젝트에서 제외해 주세요.');
 const websites=await listJson<WebsiteProject>(path.join(DATA,'websites'));
 if(websites.some(p=>p.heroImageId===id||(Array.isArray(p.pages)&&p.pages.some(page=>page?.heroImageId===id))))throw new Error('웹 프로젝트에서 사용 중입니다. 먼저 대표 이미지를 변경해 주세요.');
 const blogs=await listJson<BlogSkinProject>(path.join(DATA,'blog-skins'));if(blogs.some(p=>p.draft.imageId===id||p.draft.logoImageId===id))throw new Error('블로그 스킨에서 사용 중입니다. 먼저 이미지를 변경해 주세요.');
 const all=await listMedia();if(all.some(m=>m.sourceAssetId===id))throw new Error('이 파일에서 만든 사진이 있습니다. 파생 사진의 원본 연결을 위해 보존합니다.');
 await fs.unlink(fileFor('media',asset.id));await fs.unlink(path.join(DATA,'files',asset.id));
}
