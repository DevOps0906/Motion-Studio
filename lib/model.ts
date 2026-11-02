import {validateCreativeContent,type CreativeContent} from './content-template-data';
import {motionPresets,renderResolutions,type MotionPresetId} from './motion-presets';
export type MediaAsset = {ownerId?:string; id:string; name:string; type:'image'|'video'|'audio'; role:'source-capture'|'photo'|'derived-photo'|'reference-video'|'audio'; mimeType:string; sizeBytes:number; url:string; createdAt:string; sourceAssetId?:string; crop?:{left:number;top:number;width:number;height:number}; width?:number;height?:number;durationSeconds?:number};
export type CaptionSegment = {start:number;end:number;text:string};
export type Project = {captions?:CaptionSegment[];ownerId?:string;id:string;schemaVersion:1;contentType?:'intro'|'ranking-short'|'captioned-video'|'product-comparison'|'walkthrough-3d';scene3d?:Scene3D;creative?:CreativeContent;templateId?:string;templateVersion?:number;title:string;createdAt:string;updatedAt:string;durationSeconds:number;fps:number;resolution:{width:number;height:number};photos:string[];template:MotionPresetId;background:string;tileScale:number;gap:number;radius:number;brand:{title:string;subtitle:string;color:string;startSeconds:number;endSeconds:number;logoAssetId?:string;align?:'left'|'center'|'right';placement?:'bottom'|'center';logoScale?:number;logoOpacity?:number};audio:{assetId?:string;volume:number;startSeconds:number;trimStartSeconds:number;fadeInSeconds:number;fadeOutSeconds:number}};
// task-010 B: camera walkthrough of an uploaded model. Keyframe cameras are copies of the saved view's camera (clone space of the viewer), taken once when the project is saved (lib/server/store.ts). Rendering trusts the saved camera, so deleting or changing a view later does not change the result.
export type Vec3=[number,number,number];
export type Scene3DKeyframe={viewId:string;camera:{position:Vec3;target:Vec3};atSeconds:number};
export type Scene3D={modelId:string;keyframes:Scene3DKeyframe[];easing:'linear'|'easeInOut'};
export type RenderJob = {ownerId?:string;assetToken?:string;id:string;workerToken?:string;projectId:string;projectSnapshot:Project;status:'queued'|'processing'|'completed'|'failed'|'canceled';progress:number;stage:string;createdAt:string;updatedAt:string;error?:string;pid?:number;outputPath?:string};
// Saved viewer settings. Coordinates are in the re-centered clone space of the viewer (x/z centered on the model, y=0 at its lowest point).
export type CadView = {id:string;schemaVersion:1;name:string;camera:{position:[number,number,number];target:[number,number,number]};floors:boolean[];exploded:boolean;background:string;createdAt:string;updatedAt:string};
// Saved 3D shape edits (task-010 plan C). One document per model; keys are ORIGINAL glTF node indices (decimal strings).
// position/rotation(deg)/scale are relative to the node's original local TRS: offset added, rotation applied after it, scale multiplied.
export type CadNodeEdit = {position?:[number,number,number];rotation?:[number,number,number];scale?:[number,number,number];hidden?:boolean;color?:string;roughness?:number};
export type CadEdits = {schemaVersion:1;revision:number;overrides:Record<string,CadNodeEdit>};
// Result of the last GLB validation, valid while the .glb mtime and size stay the same.
export type CadValidation = {at:string;mtimeMs:number;size:number;nodeCount:number;matrixNodes?:number[];skinNodes?:number[]};
export type CadModelAsset = {ownerId?:string;id:string;name:string;sizeBytes:number;createdAt:string;gltfVersion:string;sceneCount:number;nodeCount:number;meshCount:number;materialCount:number;storeyCount:number;views?:CadView[];invalid?:string;validated?:CadValidation};
// 3D walkthrough limits (task-010 section 9): 1280x720, 30fps, up to 10 seconds, 2~8 keyframes.
export const WALKTHROUGH_MAX_SECONDS=10,WALKTHROUGH_MIN_KEYFRAMES=2,WALKTHROUGH_MAX_KEYFRAMES=8;
// Same camera limits as the viewer's OrbitControls and the saved-view validation (lib/server/cad-models.ts): distance 12~65 m, polar angle up to 0.48*PI.
const CAMERA_MIN_DISTANCE=12,CAMERA_MAX_DISTANCE=65,CAMERA_MAX_POLAR=Math.PI*.48,CAMERA_EPS=1e-3;
const plain=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const vec3=(v:unknown):v is Vec3=>Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=-1000&&n<=1000);
// The last frame that exists is (duration*fps-1)/fps, so no keyframe may sit later.
export const lastFrameSeconds=(durationSeconds:number,fps:number)=>(durationSeconds*fps-1)/fps;
export function validateScene3D(value:unknown,durationSeconds:number,fps=30):Scene3D{
 if(!plain(value)||Object.keys(value).some(k=>!['modelId','keyframes','easing'].includes(k)))throw new Error('3D 워크스루 설정이 올바르지 않습니다.');
 if(typeof value.modelId!=='string'||!/^[a-f0-9-]{36}$/i.test(value.modelId))throw new Error('3D 모델을 선택해 주세요.');
 if(value.easing!=='linear'&&value.easing!=='easeInOut')throw new Error('이동 방식은 linear 또는 easeInOut입니다.');
 const frames=value.keyframes;
 if(!Array.isArray(frames)||frames.length<WALKTHROUGH_MIN_KEYFRAMES||frames.length>WALKTHROUGH_MAX_KEYFRAMES)throw new Error(`키프레임은 ${WALKTHROUGH_MIN_KEYFRAMES}~${WALKTHROUGH_MAX_KEYFRAMES}개여야 합니다.`);
 let previous=-1;
 for(const frame of frames){
  if(!plain(frame)||Object.keys(frame).some(k=>!['viewId','camera','atSeconds'].includes(k))||typeof frame.viewId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(frame.viewId))throw new Error('키프레임 형식이 올바르지 않습니다.');
  const t=frame.atSeconds;
  if(typeof t!=='number'||!Number.isFinite(t)||t<0||t>lastFrameSeconds(durationSeconds,fps)+1e-9||t<=previous)throw new Error('키프레임 시간은 0초부터 마지막 프레임 안에서 계속 늘어나야 합니다.');
  previous=t;
  const camera=frame.camera;
  if(!plain(camera)||Object.keys(camera).some(k=>k!=='position'&&k!=='target')||!vec3(camera.position)||!vec3(camera.target))throw new Error('카메라 좌표를 확인해 주세요.');
  const dy=camera.position[1]-camera.target[1],distance=Math.hypot(camera.position[0]-camera.target[0],dy,camera.position[2]-camera.target[2]);
  if(distance<CAMERA_MIN_DISTANCE-CAMERA_EPS||distance>CAMERA_MAX_DISTANCE+CAMERA_EPS)throw new Error(`카메라 거리는 ${CAMERA_MIN_DISTANCE}~${CAMERA_MAX_DISTANCE} m 범위여야 합니다.`);
  if(Math.acos(Math.min(1,Math.max(-1,dy/distance)))>CAMERA_MAX_POLAR+CAMERA_EPS)throw new Error('카메라 각도가 허용 범위를 벗어났습니다.');
 }
 return value as unknown as Scene3D;
}
// Storey/roof placement shared with the viewer's UploadedBuilding rule (all floors visible, not exploded): a node with a numeric extras.storeyId sits at elevationM (default floor*3.6), the roof at its elevationM.
export function placeStoreys(root:{traverse:(visit:(node:{userData:Record<string,unknown>;position:{y:number}})=>void)=>void}){
 root.traverse(node=>{
  const storeyId=node.userData.storeyId;
  if(typeof storeyId==='string'&&/^\d+$/.test(storeyId))node.position.y=Number(node.userData.elevationM??(Number(storeyId)-1)*3.6);
  else if(node.userData.system==='roof'&&typeof node.userData.elevationM==='number')node.position.y=node.userData.elevationM;
 });
}
// Camera at a time: holds before the first and after the last keyframe, interpolates position and target between.
export function cameraAt(scene:Scene3D,time:number):{position:Vec3;target:Vec3}{
 const k=scene.keyframes,first=k[0],last=k[k.length-1];
 if(time<=first.atSeconds)return first.camera;
 if(time>=last.atSeconds)return last.camera;
 const i=k.findIndex(frame=>frame.atSeconds>time)-1,a=k[i],b=k[i+1],u=(time-a.atSeconds)/(b.atSeconds-a.atSeconds);
 const e=scene.easing==='easeInOut'?(u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2):u;
 const mix=(x:Vec3,y:Vec3):Vec3=>[x[0]+(y[0]-x[0])*e,x[1]+(y[1]-x[1])*e,x[2]+(y[2]-x[2])*e];
 return {position:mix(a.camera.position,b.camera.position),target:mix(a.camera.target,b.camera.target)};
}
export const DEFAULT_PROJECT:Project = {id:'preview',schemaVersion:1,title:'나의 첫 인트로',createdAt:'',updatedAt:'',durationSeconds:15,fps:30,resolution:{width:1920,height:1080},photos:[],template:'mosaic',background:'#080c17',tileScale:1,gap:1,radius:.08,brand:{title:'IDEAS INTO MOTION',subtitle:'PHOTO WALL STUDIO',color:'#ffffff',startSeconds:11.8,endSeconds:15},audio:{volume:.5,startSeconds:0,trimStartSeconds:0,fadeInSeconds:.5,fadeOutSeconds:1}};
export const templates = motionPresets;
export {renderResolutions};
// task-011: transcript/caption output limits. Segments are monotonic (start<end, none starts before the previous one ends) and, when the media length is given, inside it.
export const MAX_CAPTION_SEGMENTS=500,MAX_CAPTION_CHARS=200;
export function validateSegments(value:unknown,durationSeconds?:number):CaptionSegment[] {
 if(!Array.isArray(value)||value.length>MAX_CAPTION_SEGMENTS)throw new Error(`자막 구간은 ${MAX_CAPTION_SEGMENTS}개 이하여야 합니다.`);
 let previousEnd=0;
 return value.map((item:unknown)=>{
  const s=item as Partial<CaptionSegment>|null;
  if(!s||typeof s!=='object'||typeof s.start!=='number'||typeof s.end!=='number'||!Number.isFinite(s.start)||!Number.isFinite(s.end)||typeof s.text!=='string')throw new Error('자막 구간 형식이 올바르지 않습니다.');
  const text=s.text.trim(),start=Math.round(s.start*1000)/1000,end=Math.round(s.end*1000)/1000;
  if(!text||[...text].length>MAX_CAPTION_CHARS)throw new Error(`자막 문장은 1~${MAX_CAPTION_CHARS}자여야 합니다.`);
  if(start<0||end<=start||start<previousEnd||(durationSeconds!==undefined&&end>durationSeconds+.05))throw new Error('자막 시간은 시작이 끝보다 앞서고, 앞 구간 뒤에서 이어지며, 영상 길이 안이어야 합니다.');
  previousEnd=end;return {start,end,text};
 });
}
export function validateProject(value:unknown):Project {
 if(!value || typeof value!=='object') throw new Error('프로젝트 데이터가 올바르지 않습니다.');
 const p=value as Project;
 const finite=(v:unknown)=>typeof v==='number' && Number.isFinite(v);
 if(p.contentType&&!['intro','ranking-short','captioned-video','product-comparison','walkthrough-3d'].includes(p.contentType))throw new Error('아직 지원하지 않는 콘텐츠 형식입니다.');
 const walk=p.contentType==='walkthrough-3d';
 if(p.schemaVersion!==1) throw new Error('지원하지 않는 프로젝트 버전입니다.');
 if(p.scene3d!==undefined&&!walk)throw new Error('3D 설정은 3D 워크스루에서만 쓸 수 있습니다.');
 if(typeof p.title!=='string'||!p.title.trim()||p.title.length>120)throw new Error('프로젝트 이름은 1~120자입니다.');
 if(walk){if(!finite(p.durationSeconds)||p.durationSeconds<1||p.durationSeconds>WALKTHROUGH_MAX_SECONDS||p.fps!==30)throw new Error(`3D 워크스루는 ${WALKTHROUGH_MAX_SECONDS}초 이하, 30fps여야 합니다.`);if(p.resolution?.width!==1280||p.resolution?.height!==720)throw new Error('3D 워크스루는 720p(1280×720)까지 만들 수 있습니다.');}
 else{if(!finite(p.durationSeconds)||p.durationSeconds<5||p.durationSeconds>30||![30,60].includes(p.fps))throw new Error('길이는 5~30초, FPS는 30 또는 60이어야 합니다.');
 if(!renderResolutions.some(r=>(r.width===p.resolution?.width&&r.height===p.resolution?.height)||(p.contentType&&p.contentType!=='intro'&&r.height===p.resolution?.width&&r.width===p.resolution?.height)))throw new Error('해상도는 720p·1080p·1440p·4K 중 선택해 주세요.');}
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
 if(p.captions!==undefined)validateSegments(p.captions);
 if(walk){if(p.creative!==undefined||p.templateId!==undefined)throw new Error('3D 워크스루에는 콘텐츠 템플릿 설정을 쓸 수 없습니다.');validateScene3D(p.scene3d,p.durationSeconds,p.fps);}
 else if(p.contentType&&p.contentType!=='intro'){validateCreativeContent(p.creative,p.templateId,p.contentType);if((p.contentType==='product-comparison')!==(p.resolution.width>p.resolution.height))throw Error('콘텐츠 화면 비율을 확인해 주세요.');}
 return p;
}



