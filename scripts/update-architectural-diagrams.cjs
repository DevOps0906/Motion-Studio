const fs=require('node:fs');
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function svg(title,height,content){return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="${height}" viewBox="0 0 1400 ${height}" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">건축 확장 기획. 실제 CAD·엔진 연결은 미검증. MCP·모델링·검증·변환·출력을 구분한다.</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#94b8d9"/></marker><style>text{font-family:Arial,'Malgun Gothic',sans-serif}.title{fill:#f1f5f9;font-size:24px;font-weight:700}.body{fill:#b6c2d6;font-size:16px}.tag{fill:#93c5fd;font-size:12px;letter-spacing:2px}.plan{fill:#121f32;stroke:#6683a7;stroke-width:1.5;stroke-dasharray:7 5}.current{fill:#27223c;stroke:#b7a6e8;stroke-width:1.5}.line{fill:none;stroke:#94b8d9;stroke-width:2;marker-end:url(#arrow)}</style></defs><rect width="1400" height="${height}" rx="20" fill="#0b1020"/>${content}</svg>`;}
const text=(x,y,s,cl='body')=>`<text x="${x}" y="${y}" class="${cl}">${esc(s)}</text>`;
const box=(x,y,w,h,title,lines=[],current=false)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" class="${current?'current':'plan'}"/>`+text(x+25,y+38,title,'title')+lines.map((s,i)=>text(x+25,y+73+i*28,s)).join('');
const line=d=>`<path d="${d}" class="line"/>`;
let s=text(60,55,'MOTION STUDIO / ARCHITECTURAL SYSTEM · PLANNED','tag')+text(60,105,'AI 건축 모델링에서 웹 체험까지','title')+text(60,138,'도구 연결·CAD 원본·변환 패키지·엔진 출력의 책임을 분리합니다.');
s+=box(60,175,1280,105,'Motion Studio 공통 기반',['현재: 대시보드·프로젝트·미디어·작업·GLB 모델 라이브러리 / CAD 어댑터는 확장 계획'],true)+line('M700 280V310');
s+=box(60,320,1280,110,'입력·모델링 명세',['도면·이미지·치수·프롬프트 → 단위·방위·층·객체 ID·파라미터·검수 기준'])+line('M700 430V460');
s+=box(60,470,1280,105,'AI 실행 · MCP/CLI 연결 계층',['기능 탐색 → 단일 작성자 세션 → 변경 전 저장 → 직렬 실행 → 결과·로그 조회'])+line('M700 575V600H260H1140M260 600V625M700 600V625M1140 600V625');
s+=box(60,635,400,135,'Rhino · Grasshopper',['건축 매스·층·곡면·파사드','파라미터·원본 .3dm/.gh'])+box(500,635,400,135,'Fusion',['정밀 부품·조립·하드웨어','데스크톱 모델링 / 데이터 분리'])+box(940,635,400,135,'Blender',['조건부 메시·UV·PBR·LOD','직접 GLB가 통과하면 생략 가능']);
s+=line('M260 770V795H1140M700 795V820M700 770V795M1140 770V795');
s+=box(60,830,1280,110,'CAD 검증 → 엔진별 변환·시각 검증',['원본 revision·단위/축·객체/층 ID → GLB·FBX·USD 등 → manifest·예산·검사 보고'])+line('M700 940V965H260H1140M260 965V990M700 965V990M1140 965V990');
s+=box(60,1000,400,135,'B1 · R3F 뷰어 시제품',['GLB 2.0 로컬 미리보기·저장 라이브러리','데모 층·파사드 조절 / CAD 메타 계획'],true)+box(500,1000,400,135,'B2 · Unity Web 후속',['Collider·이동·문·전시 선택','CLI/MCP → Web 빌드 검증'])+box(940,1000,400,135,'B3 · Unreal 후속',['MCP → 재질·조명·Sequencer','GPU 앱 → Pixel Streaming']);
s+=line('M260 1135V1160H1140M700 1160V1185M700 1135V1160M1140 1135V1160');
s+=box(60,1195,1280,100,'최종 결과 · 사용자 검수',['건축 웹 뷰어 / 가상 전시관 / 모델하우스 / 건축 영상 → 치수·시각·성능·운영 검수']);
s+=text(60,1335,'실선 보라 상자: 기존 기반 · 파랑 점선 상자: 건축 확장 계획 · 도구 설치·연결·실제 모델 생성은 미실행');
fs.writeFileSync('public/architectural-system.svg',svg('Motion Studio AI 건축 시스템 확장 구조도',1370,s));
let l=text(60,55,'MOTION STUDIO / ARCHITECTURAL DEVELOPMENT TRACK · PLANNED','tag')+text(60,105,'건축 확장 트랙은 이렇게 진행합니다','title')+text(60,138,'기존 웹·영상의 검증 주기를 유지하고, 공간 모듈에서 별도 분기합니다.');
const steps=[['ARC-001 · 요구사항·환경 확인',['도면·치수·단위·방위·도구 버전·연결 조건 / 실제 건축 승인과 분리']],['G0 → G1 · MCP/CLI 작은 연결 시험',['읽기·기능 목록 → 별도 문서의 큐브 1개 → 치수 조회·저장·재열기·복구']],['G2 · 3층 데모 모델 생성·CAD 검수',['Rhino·Grasshopper / 필요 부품은 Fusion / 한 세션 한 작성자']],['G3 · 변환·최적화·검증',['직접 GLB 또는 Blender → 축·배율·층·ID·재질·성능 예산 검사']],['B1 · R3F 건축 뷰어 시제품',['구현: GLB 2.0 미리보기·저장 라이브러리 / 다음: 실제 CAD 메타 연결']],['G4 · 사용자·브라우저 검수',['치수·시각 승인 / 모바일·성능·로딩·누락·복구 검사 → 실패 시 앞 단계 수정']]];
steps.forEach((step,i)=>{const y=180+i*150;l+=box(150,y,1100,115,step[0],step[1]);if(i<steps.length-1)l+=line(`M700 ${y+115}V${y+140}`);});
l+=line('M700 1045V1080H370H1030M370 1080V1110M1030 1080V1110');
l+=box(60,1120,620,145,'B2 · Unity 전시관 PoC',['전시실 1개·작품 10개·이동·충돌·투어','Web 빌드·목표 기기 검증 후 범위 확대'])+box(720,1120,620,145,'B3 · Unreal 모델하우스 PoC',['공간 2개·재질 3종·실시간 체험','GPU 세션·연결·지연·종료·비용 측정']);
l+=line('M370 1265V1290H1030M700 1290V1315M1030 1265V1290');
l+=box(150,1325,1100,115,'G5 · 반복 제작·운영 → 선택적 SaaS',['버전·저장점·리포트·작업 큐·비용 계측 → 라이선스·무인 실행·테넌트 운영 검토']);
l+=text(60,1480,'현재 상태: 기획·명세 단계. 이 다이어그램의 CAD·Unity·Unreal 단계는 구현 완료를 의미하지 않습니다.');
fs.writeFileSync('public/architectural-lifecycle.svg',svg('Motion Studio AI 건축 개발주기 구조도',1520,l));
for(const [file,replacements] of Object.entries({'public/architecture.svg':[['/gallery · 3D 갤러리 프로토타입','현재: 사진 갤러리 + GLB 건축 뷰어 / 계획: CAD 생성·검증'],['현재: 사진 갤러리 / 계획: 건축 CAD','현재: 사진 갤러리 + GLB 건축 뷰어 / 계획: CAD 생성·검증'],['랭킹 쇼츠 → 자동 자막 → 제품 비교 → SaaS','영상 자동화 + CAD 건축 → R3F·Unity·Unreal → SaaS'],['입력 스키마·컴포지션 / 음성인식 Provider / 출처 검수 / 인증·테넌트·저장·큐','영상 템플릿 / MCP 어댑터 / CAD 검증·변환 / 엔진별 출력 / 인증·테넌트·작업 큐']],'public/development-lifecycle.svg':[['현재: 3D 갤러리 프로토타입','사진 갤러리 + GLB 뷰어 시제품 / CAD 생성은 계획'],['사진 갤러리 → CAD 건축 확장(계획)','사진 갤러리 + GLB 뷰어 시제품 / CAD 생성은 계획'],['08 · 콘텐츠 모듈 확장','08 · 영상·건축 모듈 확장'],['랭킹 쇼츠 → 자동 자막 → 제품 비교 : 각 모듈도 기획·구현·검증 반복','영상: 랭킹·자막·비교 / 공간: CAD → 검증·변환 → R3F → Unity·Unreal']] })){let value=fs.readFileSync(file,'utf8');for(const [from,to]of replacements){if(!value.includes(from)&&replacements.some(([source,target])=>value.includes(source)||value.includes(target)))continue;if(!value.includes(from))throw new Error(`Expected label missing in ${file}: ${from}`);value=value.replace(from,to);}fs.writeFileSync(file,value);}
console.log('Architectural system and lifecycle diagrams generated; platform diagrams updated');


