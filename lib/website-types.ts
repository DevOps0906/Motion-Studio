import {EMPTY_WEBSITE,type WebsiteBrief} from './website';
import {emptyProductionBrief} from './website-production';
export const WEBSITE_TYPES = {
 basic:{title:'BASIC',subtitle:'비즈니스 시작형',promise:'첫 방문이 첫 문의로 이어지도록.',description:'무엇을 하는 회사인지, 왜 믿을 수 있는지, 어디로 문의할지를 한눈에 전달하세요.',reason:'소개 자료는 있지만 고객에게 보낼 제대로 된 홈페이지가 없다면 BASIC이 출발점입니다.',fit:'소상공인 · 1인 기업 · 신규 서비스',price:'119만원',anchor:'기준 제안가 119만원',timeline:'3–7일',pages:'1–5페이지 계획',features:['명확한 회사·서비스 소개','모바일에서도 편한 문의 동선','브랜드 컬러와 기본 검색 정보'],designPreset:'studio',designKit:'minimal',deliverable:'소개·서비스·문의에 집중하는 간결한 구성'},
 business:{title:'BUSINESS',subtitle:'비즈니스 성장형',promise:'잘 소개하는 홈페이지에서, 상담을 만드는 접점으로.',description:'서비스의 차이를 설명하고, 고객이 상담을 결심하는 흐름과 운영 방식을 함께 설계하세요.',reason:'서비스가 여러 개이고 문의 이후의 관리까지 정리해야 한다면 BUSINESS를 선택하세요.',fit:'전문 서비스 · 중소기업 · 성장하는 팀',price:'329만원',anchor:'기준 제안가 329만원',timeline:'10–20일',pages:'6–12페이지 계획',features:['고객 여정에 맞춘 콘텐츠 구조','CMS·문의 관리 요구사항 설계','전환 지점과 자동화 흐름 정의'],designPreset:'editorial',designKit:'publication',deliverable:'브랜드 이야기와 서비스 설득을 연결하는 구성'},
 premium:{title:'PREMIUM',subtitle:'브랜드 경험형',promise:'비슷한 설명보다, 기억에 남는 브랜드 경험.',description:'브랜드만의 이야기와 영상·인터랙션을 연결하고, 경험 이후의 비즈니스 흐름까지 설계하세요.',reason:'제품과 공간의 매력을 정적인 소개만으로 전하기 어렵다면 PREMIUM에서 경험의 방향을 찾으세요.',fit:'브랜드 · 제품 기업 · 건축·공간',price:'890만원',anchor:'기준 제안가 890만원',timeline:'4–8주',pages:'12–20페이지 계획',features:['브랜드 아트디렉션과 경험 설계','시네마틱 영상·모션 구성','선택형 3D와 업무 자동화 설계'],designPreset:'gallery',designKit:'portfolio',deliverable:'이미지와 스토리텔링을 중심으로 하는 구성'},
} as const;
export type WebsiteType=keyof typeof WEBSITE_TYPES;
export function websiteTypeBrief(tier:WebsiteType):WebsiteBrief{
 const preset=WEBSITE_TYPES[tier];
 return {...EMPTY_WEBSITE,services:[...EMPTY_WEBSITE.services],designPreset:preset.designPreset,designKit:preset.designKit,productionBrief:emptyProductionBrief(tier),
  sections:EMPTY_WEBSITE.sections.map(section=>({...section}))};
}
