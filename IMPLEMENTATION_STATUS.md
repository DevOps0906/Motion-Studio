# Motion Studio 구현·검증 상태

갱신: 2026-10-29 / v0.2.0. 범위: 통합 플랫폼의 1차 기반과 15초 자동 인트로.

## 완료한 작업

- 프로젝트명·패키지명을 Motion Studio / motion-studio로 변경.
- 허용된 작업 경계 안의 `Motion-Studio/`로 소스·의존성·입력·저장 데이터·기존 출력 이동. 상위 디렉터리는 작업 경계용 래퍼로 유지.
- Canva·Kapwing·Renderforest 공식 자료 기반 디자인 기획, 통합 대시보드와 빠른 제작 화면.
- 공통 이미지·영상·음악 등록, 실제 형식·크기·디코딩 검사, 미리보기·삭제 보호.
- 제공 캡처 4장 보존, 선별한 2개 원본에서 20개 영역 분할, 출처·크롭 기록. 첫 프로젝트에는 18개 선택.
- 영상 탐색·프레임 캡처, 원본 영상과 생성 사진 연결.
- 프로젝트 생성·저장·복원·자동 저장·이름 변경·복제·삭제.
- 공통 모션·카메라·R3F 씬, 재생·스크럽·반복, 타일·브랜드·음악 설정.
- 설정과 에셋 파일 사본에 고정된 Node 렌더 작업, 진행률·취소·실패·재시도·MP4 다운로드.
- `photo-wall-intro-v1`: 사진 6~36장 + 로고 → 15초·1080p·30fps·450프레임 자동 생성.
- 웹·랜딩 프리뷰 `/showcase`, 탐색형 3D 갤러리 프로토타입 `/gallery`.
- 구조도 화면·SVG·Mermaid, 후속 랭킹·자막·비교 템플릿의 타입·카탈로그·로드맵.

관련 요구사항: FR-101~108 기반, FR-304~307, FR-401~407 기반, FR-501~508, FR-601~606, FR-701~706. 아래 미구현 항목 때문에 기존 PRD 전체 완료를 선언하지 않는다.

## 실행·검증 결과

| 검증 | 결과 | 근거 |
| --- | --- | --- |
| 타입 검사 | 성공 | npm run typecheck |
| 단위 검증 | 성공 | npm test: 결정적 상태·프레임 경계·오디오·스키마 27개 검사 + 15초 템플릿 정상·오류 입력 |
| 프로덕션 빌드 | 성공 | npm run build: 대시보드·모듈·API 라우트 생성 |
| 미디어·저장 API | 성공 | out/qa/api-result.json |
| 파일 입력·영상 프레임·포인터 분할·자동 저장·삭제 | 성공 | out/qa/workflows-result.json |
| 기존 편집기·데스크톱·모바일 | 성공 | out/qa/browser-result.json |
| 통합 대시보드·빠른 생성·웹·3D·구조도·모바일 | 성공 | out/qa/motion-platform-result.json |
| 10초 1080p/30fps/300프레임·사진 표시 | 성공 | out/qa/final-metadata.json, visible-frames.json |
| 같은 프레임 3회 픽셀 비교 | 성공 | out/qa/determinism-result.json |
| 오디오 AAC·5초 출력 | 성공 | out/qa/audio-metadata.json 및 QA 렌더 작업 |
| 15초 1080p/30fps/450프레임·엔딩 로고·다운로드 | 성공 | out/qa/platform-output-result.json |
| ESLint | 미실행 | 기존 저장소에 ESLint 구성이 없으며 이번 작업에서 추가하지 않음 |

텍스처 준비 전 캡처되던 문제는 Remotion의 Suspense 대기를 유지하고 준비 후 프레임을 명시적으로 그리도록 수정했다. Windows 상태 파일 교체는 재시도를 추가했다. 개발 파일 감시 범위를 조정했고 렌더 기본 GL은 swangle이다. 정상 로컬 Origin까지 거절하던 보호 로직도 수정했다.

## 산출물

- `out/motion-studio-intro-15s.mp4` ? 자동 생성 흐름으로 만든 15초 결과. 예제 로고 사용, 음악 없음.
- `out/photo-wall-intro.mp4` ? 기존 10초 검증 결과 보존.
- `out/cropped-photos/` ? 분할 후보 20개 및 사용·출처 manifest.
- `public/architecture.svg`, `ARCHITECTURE.md` ? 시각·텍스트 구조도.
- `design/dashboard.html` ? 디자인 리뷰.
- `PLATFORM_PLAN.md`, `DESIGN.md`, `BENCHMARK.md`, `PRD.md` ? 기획·디자인·요구사항.

## 남은 범위와 제한

- 랭킹형 쇼츠·자동 자막·제품 비교는 계획·입력 계약만 있으며 생성 기능은 아직 없다.
- 웹은 GSAP 랜딩 프리뷰, 3D는 포토 갤러리 프로토타입이다. 범용 페이지·전시실·GLB 편집기는 후속 단계다.
- 원본 MP4의 시간별 정밀 모션 비교·사용자 유사도 승인, 자유 카메라 키프레임 편집은 미완료.
- 글꼴·브랜드 상세 스타일·SVG 로고 업로드·안전 영역·템플릿 되돌리기·다중 버전 마이그레이션은 후속 항목이다.
- 캡처의 원근을 완전히 복원한 것이 아니라 내부 사진 영역을 자른 결과다. 해상도·잘림 한계가 있으며 원본으로 교체할 수 있다.
- 실제 브랜드·음원은 제공되지 않아 예제 로고와 선택 가능한 음악 입력을 제공했다.
- 인증·팀·결제·클라우드 저장·작업 큐·외부 AI 호출은 미연결.
- codebase-memory 스킬 경로 읽기 접근 불가와 MCP Transport closed로 그래프 검증은 완료하지 못했다. 관련 소스 직접 읽기와 실행 검증을 사용했다.

## 제품 범위 재정의 ? 벤치마크 기반 웹 제작 플랫폼

- 제품 핵심을 프리미엄 동적 웹사이트 제작 플랫폼으로 명확화: 벤치마크 URL/캡처 + 이미지·로고·브랜드/페이지 정보 → 구조·연출 분석 → 새 페이지 생성 → 수정·미리보기 → 내보내기/배포.
- 3D 갤러리·뷰어는 같은 프로젝트에서 제공하는 별도 제작 모듈로 규정. 영상 자동화도 공통 브랜드 자산 기반 모듈로 유지.
- 대시보드 카드에서 웹의 현재 GSAP 랜딩은 시연이며 제작기는 기획 단계, 3D는 갤러리·모델뷰어 시제품, 영상은 인트로 MVP임을 명시.
- PRD·제품계획·전 생애 개발주기와 `/architecture` 설명을 새 범위에 맞춰 갱신.
- 웹 사이트 입력·분석·생성·편집·내보내기 기능은 아직 미구현. 이 반영으로 기존 35% 추정은 상향 근거가 없으며, 통합 플랫폼 관점에서는 약 25~30%로 재평가.

## AI 건축 확장 기획 추가

- 완료 범위: ARCHITECTURAL_STUDIO_PLAN.md와 상세 명세 9개 작성, 플랫폼·Mermaid·SVG 개발주기/시스템 구조 갱신, /architecture 화면에 건축 트랙·다운로드 추가.
- 새 산출물: public/architectural-system.svg, public/architectural-lifecycle.svg.
- 공식 자료 보정: Unity 기존 에디터 내 MCP 대신 CLI MCP 기준, Fusion 로컬 모델링과 데이터 접근 분리, Unreal MCP Experimental·직렬 호출 조건.
- 미실행: CAD 앱 설치·연결, 도구 기능 탐색, 실제 건축 모델 생성·검증·변환, Unity/Unreal 프로젝트·빌드·GPU 스트리밍, PDF 생성.
- 상태 표기는 전부 확장 기획/이 프로젝트에서 연결 미검증. 현재 사진 갤러리와 CAD 뷰어를 구분.
- 이번 검증 결과: 타입 검사 성공. 기획 문서 10개, SVG 4개 경로·화면 앵커 4개·모바일 가로 넘침 검증 성공. 건축 전용 두 다이어그램을 브라우저 캡처로 시각 확인. 증거: out/qa/architectural-planning-result.json, architectural-system.png, architectural-lifecycle.png.

## 2026-10-30 웹 제작기 MVP와 범위 조정

### 새 입력 이미지 적용

- 사용자가 교체한 애니메이션 콜라주 PNG 5장을 직접 확인하고, 검토한 영역으로 36개 샘플 사진 생성. `input/sample-crops.json`과 `public/photos/manifest.json`에 재생성 기준·원본/출력 해시 기록.
- 대시보드 원본 표시와 미디어 원본 API를 새 manifest 기반으로 교체. 이전 4개 입력 원본과 공개 샘플 바이트 교체, 기존 파생 사진 파일 정리.
- 로컬 기존 샘플 20개의 미디어 ID를 유지해 새 사진으로 교체하고 16개 추가. 기존 프로젝트의 참조는 유지하며 로고·음악·완료 렌더 이력은 보존.
- 사진 준비 API는 새 36장을 누락분만 등록하고 반복 호출 시 중복 생성하지 않음. 빠른 생성에서 과거 샘플 이름 제외 규칙 제거.
- 디자인 대시보드·모바일·빠른 제작 PNG를 새 실제 화면으로 교체. 갤러리·대표 이미지·HTML 내보내기에서도 새 사진 표시 확인.
- 검증: 원본 5개·공개 36개·등록 36개 해시, 기존 프로젝트 참조, 준비 API 멱등성, 타입·테스트·프로덕션 빌드 및 데스크톱/모바일 화면. 증거: `out/qa/sample-media-result.json`, `new-image-gallery.png`.

### 후속 완료: 섹션 편집과 HTML 결과물

- 소개·서비스·문의 섹션 표시·순서 편집, 소개/문의 문구와 HTTP(S) 문의 링크 지원. 섹션 ID·중복·표시 설정을 서버에서 검증한다.
- 기존 웹 프로젝트에 필드가 없으면 서비스 섹션만 표시하며 원래 구성을 유지한다. 전체 섹션 숨김 시 끊어진 내부 CTA를 만들지 않는다.
- `GET /api/websites/[id]/export`: 저장된 페이지를 CSS·대표 이미지 포함 단일 HTML로 다운로드. 텍스트·속성을 이스케이프하고 지원하지 않는 이미지와 잘못된 링크를 거절한다.
- 편집기에서 미저장 변경이 있으면 내보내기를 비활성화한다. 미리보기와 HTML 출력은 공통 CSS를 사용한다.
- 타입·단위·빌드 검사와 기존 웹 제작기 회귀, 실제 섹션 이동/숨김/저장/재열기 및 버튼 다운로드를 검증했다. 내려받은 HTML을 Chrome에서 네트워크를 끄고 열어 이미지·390px 반응형을 확인했다. 브라우저 오류 로그 없음.
- 증거: `out/qa/website-export-result.json`, `website-export-desktop.png`, `website-export-mobile.png`, `website-downloads/`. 실행: `WEBSITE_QA_URL` 설정 후 `node scripts/verify-website-export.cjs`.
- 문의 폼 전송·자동 배포·사이트 분석은 후속 범위다. Docker·resvg 보류 상태와 가져오기 중심 제품 경계는 유지한다.

- `/websites`: 브랜드·문구·서비스·대상 고객·참고 URL·테마·강조색·공유 이미지 입력, 실시간 랜딩 미리보기, 프로젝트 저장·수정·재열기.
- `/api/websites`, `/api/websites/[id]`: 별도 웹 프로젝트 저장·목록·조회·갱신. 서버가 ID·버전·타임스탬프를 관리하고 잘못된 URL·색상·이미지 참조를 거절.
- `/websites/[id]`: 저장된 페이지 미리보기. 편집 중 변경과 저장된 결과를 구분하고 이탈 시 미저장 변경 안내.
- 대표 이미지로 사용하는 공유 미디어의 삭제 차단. 기존 영상 계약 테스트 유지.
- Arch-Studio README를 참고하고 도면 자동 생성·법규 엔진·새 CAD 모델링은 현재 범위에서 제외. 가져온 파일을 활용하는 정책·구조도와 `/architecture` 화면 갱신.
- Docker와 resvg는 보류하며 웹 제작의 차단 조건으로 두지 않음. URL 자동 분석·AI 생성·웹 내보내기·CAD 자동 변환은 미구현.
- 검증: 타입·기존 영상 계약·웹 입력 계약 16개 거절 사례, 프로덕션 빌드, API 생성/수정/조회/목록·미디어 보호·교차 출처 차단, 브라우저 폼 생성/수정/재열기·390px 가로 넘침 없음. 증거: `out/qa/website-result.json`, `website-builder-desktop.png`, `website-builder-mobile.png`.
- 재검증: `npm test`, `npm run typecheck`, `npm run build`; 실행 서버 대상 `WEBSITE_QA_URL` 설정 후 `node scripts/verify-websites.cjs`. 후자는 임시 QA 레코드를 만들고 자신의 레코드만 정리함.

## 건축 뷰어·GLB 모델 라이브러리 진행

- 건축 뷰어에서 GLB 2.0을 로컬 미리보기하고, 사용자가 명시적으로 저장하면 `.local-data/models/`에 등록하도록 구현.
- `GET /api/models`, `POST /api/models`, `GET /api/models/[id]`, `DELETE /api/models/[id]`, `GET /api/models/[id]/asset` 추가. 자산 라우트는 HTTP Range 요청도 지원.
- 업로드 100 MiB 제한, GLB 헤더·버전·길이·JSON 청크·scene/node/mesh 유효성 확인.
- 3층·남측 커튼월·객체/층 ID·미터 단위 extras가 포함된 GLB 예제를 생성하고 층 메타데이터가 있는 경우 층 숨김·분해 보기를 연결.
- 외부 GLB의 원본 미터 축척을 보존하고 카메라만 자동 맞춤. 장면 경계 치수를 뷰어에 표시.
- 예제 GLB를 모델 API로 등록해 라이브러리에서 다시 열 수 있도록 로컬 개발 데이터에 저장.
- Remotion headless Chrome에서 예제 GLB를 열고 2층 숨김·층 분해 상호작용을 확인. 해당 화면 콘솔에 React 동기 unmount 오류 없음. 캡처: `out/qa/architecture-glb-interaction.png`.
- 서버 원본 업로드와 Rhino/CAD 연결은 별개의 작업이며 실제 Rhino 모델 생성은 여전히 미실행.
- 이번 변경 타입 검사 통과. Docker 설정은 작성되어 있지만 Docker 엔진 접근 거부로 컨테이너는 실행하지 않았고, 사용자가 요청한 대로 보류.

