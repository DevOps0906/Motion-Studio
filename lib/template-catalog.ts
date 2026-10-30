import {CONTENT_TEMPLATES} from './content-template-data';
import {DEFAULT_PROJECT,templates,renderResolutions,type Project} from './model';
export type ContentType='intro'|'ranking-short'|'captioned-video'|'product-comparison';
export type TemplateDefinition={id:string;version:number;category:ContentType;name:string;description:string;status:'available'|'planned';durationSeconds:number|null;aspectRatio:'16:9'|'9:16';compositionId:string|null;inputs:string[]};
export const templateCatalog:TemplateDefinition[]=[
 {id:'photo-wall-intro-v1',version:1,category:'intro',name:'15초 포토월 인트로',description:'사진과 로고를 교체하면 완성되는 유튜브 오프닝',status:'available',durationSeconds:15,aspectRatio:'16:9',compositionId:'PhotoWallIntro',inputs:['photos','logo','brandName?']},
 ...CONTENT_TEMPLATES.map(item=>({id:item.id,version:1,category:item.category,name:item.name,description:item.description,status:'available' as const,durationSeconds:15,aspectRatio:item.aspect,compositionId:'PhotoWallIntro',inputs:['photos','creative']}))
];
export type IntroRequest={templateId:string;photoIds:string[];logoAssetId:string;brandName?:string;title?:string;motionPresetId?:Project['template'];resolution?:Project['resolution']};
export function buildIntroProject(input:IntroRequest):Project{
 if(input.motionPresetId!==undefined&&!templates.some(item=>item.id===input.motionPresetId))throw new Error('지원하지 않는 모션 프리셋입니다.');
 if(input.resolution!==undefined&&!renderResolutions.some(item=>item.width===input.resolution?.width&&item.height===input.resolution?.height))throw new Error('지원하지 않는 출력 해상도입니다.');
 if(input.templateId!=='photo-wall-intro-v1')throw new Error('현재 제작 가능한 템플릿은 15초 포토월 인트로입니다.');
 if(!Array.isArray(input.photoIds)||input.photoIds.length<6||input.photoIds.length>36||new Set(input.photoIds).size!==input.photoIds.length)throw new Error('서로 다른 사진 6~36장을 선택해 주세요.');
 if(typeof input.logoAssetId!=='string'||!input.logoAssetId)throw new Error('엔딩에 사용할 로고를 등록해 주세요.');
 if(input.photoIds.includes(input.logoAssetId))throw new Error('로고는 사진 목록에서 제외해 주세요.');
 const brandName=typeof input.brandName==='string'?input.brandName.trim():'';if(brandName.length>80)throw new Error('브랜드명은 80자 이하로 입력해 주세요.');
 const p:Project=JSON.parse(JSON.stringify(DEFAULT_PROJECT));return {...p,title:input.title?.trim()||brandName||'15초 유튜브 인트로',durationSeconds:15,fps:30,photos:input.photoIds,template:input.motionPresetId??'mosaic',resolution:input.resolution??p.resolution,contentType:'intro',templateId:input.templateId,templateVersion:1,brand:{...p.brand,title:brandName,subtitle:'',logoAssetId:input.logoAssetId,startSeconds:11.8,endSeconds:15,align:'center',placement:'center',logoScale:.28,logoOpacity:1}};
}
// Future modules share asset IDs, project revisions, validation and immutable render snapshots.
export type RankingItem={rank:number;title:string;description:string;imageAssetId:string;sourceUrl?:string};
export type CaptionSegment={startSeconds:number;endSeconds:number;text:string;words?:{text:string;startSeconds:number;endSeconds:number}[]};
export type ComparisonProduct={id:string;name:string;imageAssetId:string;facts:{criterion:string;value:string;sourceUrl:string;verifiedAt:string}[]};
