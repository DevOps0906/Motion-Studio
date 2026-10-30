export type ProductionTier='basic'|'business'|'premium';
export const PRODUCTION_MODULES=['문의 링크','지도·SNS','콘텐츠 CMS','리드·CRM','전환 분석','업무 자동화','브랜드 영상','3D 모델 뷰어','회원·예약·결제','다국어'] as const;
export type WebsiteProductionBrief={tier:ProductionTier;industry:string;goal:string;audience:string;offer:string;pages:string;content:string;conversion:string;operations:string;experience:string;automation:string;schedule:string;budget:string;modules:string[]};
export const PRODUCTION_FIELDS=['industry','goal','audience','offer','pages','content','conversion','operations','experience','automation','schedule','budget'] as const;
export function emptyProductionBrief(tier:ProductionTier):WebsiteProductionBrief{return {tier,industry:'',goal:'',audience:'',offer:'',pages:'',content:'',conversion:'',operations:'',experience:'',automation:'',schedule:'',budget:'',modules:[]};}
export function validateProductionBrief(input:unknown):WebsiteProductionBrief|undefined{
 if(input===undefined)return undefined;
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('제작 브리프를 확인해 주세요.');
 const data=input as Record<string,unknown>;
 if(typeof data.tier!=='string'||!['basic','business','premium'].includes(data.tier))throw Error('제작 상품을 확인해 주세요.');
 const result=emptyProductionBrief(data.tier as ProductionTier);
 for(const key of PRODUCTION_FIELDS){if(typeof data[key]!=='string'||data[key].length>1600)throw Error('브리프 항목은 1600자 이하로 입력해 주세요.');result[key]=(data[key] as string).trim();}
 if(!Array.isArray(data.modules)||data.modules.length>PRODUCTION_MODULES.length||data.modules.some(value=>!PRODUCTION_MODULES.includes(value))||new Set(data.modules).size!==data.modules.length)throw Error('제작 옵션을 확인해 주세요.');
 result.modules=[...data.modules];return result;
}
