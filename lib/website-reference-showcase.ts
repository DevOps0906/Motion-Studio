export const REQUIREMENT_REFERENCE_CARDS=[
 {tier:'basic',title:'BASIC 홈페이지',description:'소개와 문의 중심의 홈페이지 레퍼런스',url:''},
 {tier:'business',title:'BUSINESS 홈페이지',description:'콘텐츠와 고객 운영 중심의 홈페이지 레퍼런스',url:''},
 {tier:'premium',title:'PREMIUM 홈페이지',description:'브랜드 경험과 인터랙션 중심의 홈페이지 레퍼런스',url:''},
] as const;
export function requirementReferenceHref(value:string){try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}}
