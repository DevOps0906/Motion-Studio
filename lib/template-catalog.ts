import {DEFAULT_PROJECT,type Project} from './model';
export type ContentType='intro'|'ranking-short'|'captioned-video'|'product-comparison';
export type TemplateDefinition={id:string;version:number;category:ContentType;name:string;description:string;status:'available'|'planned';durationSeconds:number|null;aspectRatio:'16:9'|'9:16';compositionId:string|null;inputs:string[]};
export const templateCatalog:TemplateDefinition[]=[
 {id:'photo-wall-intro-v1',version:1,category:'intro',name:'15초 포토월 인트로',description:'사진과 로고를 교체하면 완성되는 유튜브 오프닝',status:'available',durationSeconds:15,aspectRatio:'16:9',compositionId:'PhotoWallIntro',inputs:['photos','logo','brandName?']},
 {id:'ranking-short-v1',version:1,category:'ranking-short',name:'랭킹형 쇼츠',description:'순위·사진·설명을 장면별로 구성하는 세로 영상',status:'planned',durationSeconds:null,aspectRatio:'9:16',compositionId:null,inputs:['rankedItems','narration?']},
 {id:'captioned-video-v1',version:1,category:'captioned-video',name:'자동 자막 영상',description:'영상 음성을 분석해 검수 가능한 자막을 생성',status:'planned',durationSeconds:null,aspectRatio:'9:16',compositionId:null,inputs:['video','language','captionStyle']},
 {id:'product-comparison-v1',version:1,category:'product-comparison',name:'제품 비교 영상',description:'제품 사진·동일 기준의 스펙·출처로 만드는 비교 영상',status:'planned',durationSeconds:null,aspectRatio:'16:9',compositionId:null,inputs:['products','comparisonCriteria','sources']}
];
export type IntroRequest={templateId:string;photoIds:string[];logoAssetId:string;brandName?:string;title?:string};
export function buildIntroProject(input:IntroRequest):Project{
 if(input.templateId!=='photo-wall-intro-v1')throw new Error('현재 제작 가능한 템플릿은 15초 포토월 인트로입니다.');
 if(!Array.isArray(input.photoIds)||input.photoIds.length<6||input.photoIds.length>36||new Set(input.photoIds).size!==input.photoIds.length)throw new Error('서로 다른 사진 6~36장을 선택해 주세요.');
 if(typeof input.logoAssetId!=='string'||!input.logoAssetId)throw new Error('엔딩에 사용할 로고를 등록해 주세요.');
 if(input.photoIds.includes(input.logoAssetId))throw new Error('로고는 사진 목록에서 제외해 주세요.');
 const brandName=typeof input.brandName==='string'?input.brandName.trim():'';if(brandName.length>80)throw new Error('브랜드명은 80자 이하로 입력해 주세요.');
 const p:Project=JSON.parse(JSON.stringify(DEFAULT_PROJECT));return {...p,title:input.title?.trim()||brandName||'15초 유튜브 인트로',durationSeconds:15,fps:30,photos:input.photoIds,template:'mosaic',contentType:'intro',templateId:input.templateId,templateVersion:1,brand:{...p.brand,title:brandName,subtitle:'',logoAssetId:input.logoAssetId,startSeconds:11.8,endSeconds:15,align:'center',placement:'center',logoScale:.28,logoOpacity:1}};
}
// Future modules share asset IDs, project revisions, validation and immutable render snapshots.
export type RankingItem={rank:number;title:string;description:string;imageAssetId:string;sourceUrl?:string};
export type CaptionSegment={startSeconds:number;endSeconds:number;text:string;words?:{text:string;startSeconds:number;endSeconds:number}[]};
export type ComparisonProduct={id:string;name:string;imageAssetId:string;facts:{criterion:string;value:string;sourceUrl:string;verifiedAt:string}[]};
