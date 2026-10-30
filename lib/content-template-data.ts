export const CONTENT_TEMPLATES=[
 {id:'ranking-countdown',category:'ranking-short',name:'카운트다운 랭킹',description:'큰 순위와 사진을 순서대로 공개',variant:'countdown',aspect:'9:16'},
 {id:'ranking-podium',category:'ranking-short',name:'포디움 랭킹',description:'상위 항목을 누적해 보여주는 순위 보드',variant:'podium',aspect:'9:16'},
 {id:'ranking-editorial',category:'ranking-short',name:'에디토리얼 랭킹',description:'사진과 설명을 나눈 매거진형 순위',variant:'editorial',aspect:'9:16'},
 {id:'caption-highlight',category:'captioned-video',name:'키워드 하이라이트 자막',description:'문장별 핵심 단어를 순서대로 강조',variant:'highlight',aspect:'9:16'},
 {id:'caption-box',category:'captioned-video',name:'박스 자막',description:'선명한 자막 박스와 짧은 전환',variant:'box',aspect:'9:16'},
 {id:'caption-kinetic',category:'captioned-video',name:'키네틱 타이포 자막',description:'짧은 문장을 화면 중심에 리듬 있게 배치',variant:'kinetic',aspect:'9:16'},
 {id:'comparison-split',category:'product-comparison',name:'스플릿 제품 비교',description:'두 제품을 같은 크기로 나란히 비교',variant:'split',aspect:'16:9'},
 {id:'comparison-spec',category:'product-comparison',name:'스펙 보드 비교',description:'공통 기준과 출처를 확인하는 비교 보드',variant:'spec',aspect:'16:9'},
 {id:'comparison-focus',category:'product-comparison',name:'포커스 제품 비교',description:'제품을 번갈아 강조하는 비교 연출',variant:'focus',aspect:'16:9'},
] as const;
export type CreativeContent={heading:string;rows:{title:string;detail:string;sourceUrl:string}[]};
export function validateCreativeContent(value:unknown,templateId:unknown,contentType:unknown):CreativeContent{
 const definition=CONTENT_TEMPLATES.find(item=>item.id===templateId);if(!definition||definition.category!==contentType)throw Error('콘텐츠 템플릿을 확인해 주세요.');
 if(!value||typeof value!=='object')throw Error('템플릿 내용을 입력해 주세요.');const data=value as CreativeContent;
 if(typeof data.heading!=='string'||!data.heading.trim()||data.heading.length>120||!Array.isArray(data.rows)||data.rows.length<1||data.rows.length>8)throw Error('제목과 1~8개 장면을 입력해 주세요.');
 if(definition.category==='ranking-short'&&(data.rows.length<3||data.rows.length>5))throw Error('랭킹은 3~5개 항목입니다.');
 if(definition.category==='product-comparison'&&data.rows.length!==2)throw Error('비교할 제품 2개를 입력해 주세요.');
 for(const row of data.rows){if(!row||typeof row.title!=='string'||!row.title.trim()||row.title.length>120||typeof row.detail!=='string'||row.detail.length>300||typeof row.sourceUrl!=='string'||row.sourceUrl.length>1000)throw Error('장면 제목·설명·출처를 확인해 주세요.');if(row.sourceUrl){try{const url=new URL(row.sourceUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error();}catch{throw Error('출처는 인증 정보 없는 http/https 주소를 입력해 주세요.');}}}
 return data;
}
