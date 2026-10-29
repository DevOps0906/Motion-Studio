import {motionPresets,renderResolutions,type MotionPresetId} from './motion-presets';
export type MediaAsset = {id:string; name:string; type:'image'|'video'|'audio'; role:'source-capture'|'photo'|'derived-photo'|'reference-video'|'audio'; mimeType:string; sizeBytes:number; url:string; createdAt:string; sourceAssetId?:string; crop?:{left:number;top:number;width:number;height:number}; width?:number;height?:number;durationSeconds?:number};
export type Project = {id:string;schemaVersion:1;contentType?:'intro';templateId?:string;templateVersion?:number;title:string;createdAt:string;updatedAt:string;durationSeconds:number;fps:number;resolution:{width:number;height:number};photos:string[];template:MotionPresetId;background:string;tileScale:number;gap:number;radius:number;brand:{title:string;subtitle:string;color:string;startSeconds:number;endSeconds:number;logoAssetId?:string;align?:'left'|'center'|'right';placement?:'bottom'|'center';logoScale?:number;logoOpacity?:number};audio:{assetId?:string;volume:number;startSeconds:number;trimStartSeconds:number;fadeInSeconds:number;fadeOutSeconds:number}};
export type RenderJob = {id:string;projectId:string;projectSnapshot:Project;status:'queued'|'processing'|'completed'|'failed'|'canceled';progress:number;stage:string;createdAt:string;updatedAt:string;error?:string;pid?:number;outputPath?:string};
export type CadModelAsset = {id:string;name:string;sizeBytes:number;createdAt:string;gltfVersion:string;sceneCount:number;nodeCount:number;meshCount:number;materialCount:number;storeyCount:number};
export const DEFAULT_PROJECT:Project = {id:'preview',schemaVersion:1,title:'나의 첫 인트로',createdAt:'',updatedAt:'',durationSeconds:15,fps:30,resolution:{width:1920,height:1080},photos:[],template:'mosaic',background:'#080c17',tileScale:1,gap:1,radius:.08,brand:{title:'IDEAS INTO MOTION',subtitle:'PHOTO WALL STUDIO',color:'#ffffff',startSeconds:11.8,endSeconds:15},audio:{volume:.5,startSeconds:0,trimStartSeconds:0,fadeInSeconds:.5,fadeOutSeconds:1}};
export const templates = motionPresets;
export {renderResolutions};
export function validateProject(value:unknown):Project {
 if(!value || typeof value!=='object') throw new Error('프로젝트 데이터가 올바르지 않습니다.');
 const p=value as Project;
 const finite=(v:unknown)=>typeof v==='number' && Number.isFinite(v);
 if(p.contentType && p.contentType!=='intro')throw new Error('아직 지원하지 않는 콘텐츠 형식입니다.');
 if(p.schemaVersion!==1) throw new Error('지원하지 않는 프로젝트 버전입니다.');
 if(typeof p.title!=='string'||!p.title.trim()||p.title.length>120)throw new Error('프로젝트 이름은 1~120자입니다.');
 if(!finite(p.durationSeconds)||p.durationSeconds<5||p.durationSeconds>30||![30,60].includes(p.fps))throw new Error('길이는 5~30초, FPS는 30 또는 60이어야 합니다.');
 if(!renderResolutions.some(r=>r.width===p.resolution?.width&&r.height===p.resolution?.height))throw new Error('해상도는 720p·1080p·1440p·4K 중 선택해 주세요.');
 if(!Array.isArray(p.photos)||p.photos.length>60||p.photos.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9-]+$/.test(id)))throw new Error('사진은 최대 60장까지 선택할 수 있습니다.');
 if(!templates.some(t=>t.id===p.template)||!/^#[\da-f]{6}$/i.test(p.background))throw new Error('템플릿 또는 배경색을 확인해 주세요.');
 if(!finite(p.tileScale)||p.tileScale<.5||p.tileScale>1.5||!finite(p.gap)||p.gap<.7||p.gap>1.8||!finite(p.radius)||p.radius<0||p.radius>.3)throw new Error('타일 설정을 확인해 주세요.');
 const b=p.brand,a=p.audio;
 if(b?.align&&!['left','center','right'].includes(b.align))throw new Error('브랜드 정렬을 확인해 주세요.');
 if(b?.placement&&!['bottom','center'].includes(b.placement))throw new Error('브랜드 위치를 확인해 주세요.');
 if(b?.logoScale!==undefined&&(!finite(b.logoScale)||b.logoScale<.05||b.logoScale>.5))throw new Error('로고 크기를 확인해 주세요.');
 if(b?.logoOpacity!==undefined&&(!finite(b.logoOpacity)||b.logoOpacity<0||b.logoOpacity>1))throw new Error('로고 투명도를 확인해 주세요.');
 if(!b||typeof b.title!=='string'||b.title.length>120||typeof b.subtitle!=='string'||b.subtitle.length>200||!/^#[\da-f]{6}$/i.test(b.color)||!finite(b.startSeconds)||!finite(b.endSeconds)||b.startSeconds<0||b.endSeconds>p.durationSeconds||b.endSeconds<b.startSeconds)throw new Error('브랜드 표시 구간과 텍스트를 확인해 주세요.');
 if(b.logoAssetId && !/^[a-zA-Z0-9-]+$/.test(b.logoAssetId))throw new Error('로고 ID가 올바르지 않습니다.');
 if(!a||[a.volume,a.startSeconds,a.trimStartSeconds,a.fadeInSeconds,a.fadeOutSeconds].some(v=>!finite(v))||a.volume<0||a.volume>1||a.startSeconds<0||a.startSeconds>p.durationSeconds||a.trimStartSeconds<0||a.fadeInSeconds<0||a.fadeOutSeconds<0||a.fadeInSeconds+a.fadeOutSeconds>p.durationSeconds-a.startSeconds)throw new Error('오디오 구간과 페이드를 확인해 주세요.');
 if(a.assetId && !/^[a-zA-Z0-9-]+$/.test(a.assetId))throw new Error('오디오 ID가 올바르지 않습니다.');
 return p;
}



