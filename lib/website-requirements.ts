export type RequirementAnswers={delivery:'website'|'both'|'blog';goal:'start'|'growth'|'brand';features:string[];solutions?:string[];brand:string;notes:string;timeline:string;budget:string};
export const REQUIREMENT_FEATURES=[
 {id:'intro',label:'회사·서비스 소개',detail:'신뢰할 수 있는 기본 정보와 문의 연결',tier:'basic'},
 {id:'portfolio',label:'작업 사례·포트폴리오',detail:'실제 결과와 서비스의 차이를 전달',tier:'basic'},
 {id:'cms',label:'직접 관리하는 게시물·콘텐츠',detail:'공지·블로그·사례를 정기적으로 등록',tier:'business'},
 {id:'crm',label:'문의 저장·고객 관리',detail:'상담 상태와 후속 업무를 관리',tier:'business'},
 {id:'funnel',label:'리드 확보 퍼널 1세트',detail:'전용 랜딩·동의 폼·CRM·알림·전환 측정',tier:'business'},
 {id:'advanced-crm',label:'고급 CRM·리드 분류',detail:'영업 단계·담당자·태그·리드 점수·후속 처리',tier:'premium'},
 {id:'advanced-funnel',label:'다단계 자동화 퍼널 2세트',detail:'후속 이메일·유입경로별 분석·업무 자동화',tier:'premium'},
 {id:'analytics',label:'전환 분석',detail:'상담 신청·전화 클릭 등 고객 행동 확인',tier:'business'},
 {id:'automation',label:'문의 알림·업무 자동화',detail:'담당자 알림과 외부 시스템 연결',tier:'business'},
 {id:'cinematic',label:'시네마틱 영상·브랜드 연출',detail:'영상과 스토리로 차별화된 경험 구성',tier:'premium'},
 {id:'threeD',label:'3D 제품·건축 공간 탐색',detail:'보유 모델 활용 · 별도 구축 옵션',tier:'premium'},
 {id:'approval',label:'복잡한 승인·권한·업무 연동',detail:'여러 담당자와 운영 시스템 연결',tier:'premium'},
 {id:'commerce',label:'회원·예약·결제',detail:'외부 연결인지 자체 개발인지 추가 협의',tier:'business'},
 {id:'languages',label:'다국어',detail:'번역 자료와 운영 언어 별도 협의',tier:'business'},
] as const;
export const EMPTY_REQUIREMENTS:RequirementAnswers={delivery:'website',goal:'start',features:[],brand:'',notes:'',timeline:'',budget:''};
// Self-contained: the same decision rules run in React and the offline customer HTML.
export function recommendRequirements(answers:RequirementAnswers,features:readonly {id:string;label:string;tier:string}[]){
 const names:Record<string,string>={crm:'CRM · 영업관리',erp:'ERP · 업무관리',lms:'LMS · 교육플랫폼',funnel:'Marketing Funnel · 리드 자동화'};
 const solutions=(answers.solutions||[]).filter(id=>Object.prototype.hasOwnProperty.call(names,id)).map(id=>names[id]);
 const selected=features.filter(feature=>answers.features.includes(feature.id));
 const reasons:string[]=[];
 if(answers.delivery==='blog')return {solutions,tier:null,blog:true,title:'홈페이지형 블로그',reasons:['주 제작물로 네이버 블로그를 선택했습니다. 블로그 스킨·메뉴·문의 동선을 먼저 설계하는 구성이 적합합니다.'],options:selected.map(item=>item.label)};
 let rank=answers.goal==='brand'?2:answers.goal==='growth'?1:0;
 if(answers.goal==='brand')reasons.push('브랜드 경험을 주요 목적으로 선택해 아트디렉션과 연출 설계를 우선합니다.');
 if(answers.goal==='growth')reasons.push('문의·고객 유입의 성장을 목표로 선택해 전환 동선과 운영 설계가 필요합니다.');
 for(const item of selected){const required=item.tier==='premium'?2:item.tier==='business'?1:0;rank=Math.max(rank,required);if(required>0)reasons.push(`${item.label} 요구를 반영할 수 있는 설계 범위가 필요합니다.`);}
 if(!reasons.length)reasons.push('회사 소개와 기본 문의 동선을 중심으로 시작할 수 있어 BASIC이 적합합니다.');
 return {solutions,tier:(['basic','business','premium'] as const)[rank],blog:answers.delivery==='both',title:['BASIC','BUSINESS','PREMIUM'][rank],reasons,options:selected.filter(item=>['threeD','commerce','languages'].includes(item.id)).map(item=>item.label)};
}
export function requirementReport(answers:RequirementAnswers){return {format:'motion-studio-requirements-v1',createdAt:new Date().toISOString(),answers,recommendation:recommendRequirements(answers,REQUIREMENT_FEATURES),notice:'초기 요구사항 기반 추천이며 확정 견적·기능 제공 완료를 의미하지 않습니다. 홈페이지형 블로그는 네이버 수동 적용 패키지입니다.'};}
