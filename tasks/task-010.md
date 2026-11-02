# task-010 3D 편집 — 계획 초안

- 위험도: 안A 보통 / 안B 높음(렌더 계약 변경·업로드 파일 파싱 확대) / 안C 높음(새 의존성·노출 면). 안B 이상은 착수 전 challenger, 변경 후 codex-reviewer(code)+reviewer(contract).
- 상태: 초안. 5장 열린 결정이 풀리기 전에는 구현하지 않는다.
- 근거: `README.md` 진행 현황(3D 제작 10%, 공간·객체·재질·카메라 편집은 후속), `docs/architecture/3d/README.md`(읽지 않음, 확인 필요).

## 1. 현황
| 영역 | 있는 것 | 코드 |
|---|---|---|
| 모델 등록 | GLB 2.0만, 100MiB 상한, 이름 정리, gltf 요약(씬·노드·메시·재질·층 수) 저장 | `lib/server/cad-models.ts:10,46-68` |
| 모델 메타 | `CadModelAsset`(ownerId·sizeBytes·counts). 편집 상태 필드 없음 | `lib/model.ts:6` |
| 모델 API | 목록·등록 `GET/POST /api/models`, 단건·삭제 `/api/models/[id]`, 원본 `/api/models/[id]/asset`(Range 스트림) | `app/api/models/**` |
| 계정 분리 | `ownerId`·`getOwnedModel` 소유 검증(task-008 완료) | `cad-models.ts:32` |
| 뷰어 | R3F `Canvas`+drei `useGLTF`·`OrbitControls`. `extras.storeyId`로 층 표시·분해만 조절 | `app/architecture/viewer/ArchitecturalViewer.tsx:4-5,62-76` |
| 영상 씬 | 프로젝트+미디어+시간으로 그리는 `ContentScene`(모델 참조 없음) | `components/ContentScene.tsx:4`, `components/Studio.tsx:6` |
| 렌더 | 입력 스냅샷(`input.json`+`assets/`)으로 워커 렌더. 모델은 스냅샷에 없음 | `lib/server/render.ts:9,18` |
| 웹 | premium 요금제 문구 '선택형 3D' 한 줄뿐, 3D 블록 없음 | `lib/website-types.ts:6` |
| 의존성 | three 0.180·R3F 9·drei 10·gsap 3.13·remotion 4(`@remotion/three` 포함) | `package.json:22-36` |

- 즉 "보기"만 있고 "저장되는 편집 결과"가 없다. 편집 상태를 담을 곳·웹/영상으로 가져갈 길이 모두 없다.

## 2. 사용자 문제와 목표
| 가설(미확인, 사용자 확인 필요) | 쓰는 곳 | 근거 |
|---|---|---|
| H1 모델을 원하는 각도·층 구성으로 보여주는 영상 클립을 만들고 싶다 | 영상 제작 | Remotion+`@remotion/three` 이미 설치, 건축·공간 고객 |
| H2 웹사이트 premium '선택형 3D'에 모델 뷰어 섹션을 넣고 싶다 | 웹사이트 | `website-types.ts:6`, 구현은 없음 |
| H3 모델 파일 수정(재질·위치) 자체를 하고 싶다 | 별도 DCC 대체 | 범위 크고 README가 CAD 신규 개발 제외(141행) |
- 목표(안): 등록한 GLB에 **보기 설정**(카메라·층 표시·분해·재질 색)을 저장하고 같은 결과를 화면·영상·웹에서 재현한다. 모델 형상 자체 편집은 목표 아님.

## 3. 범위 후보
| 안 | 내용 | 화면 | 데이터 | 렌더 영향 | 위험 |
|---|---|---|---|---|---|
| A 최소: 보기 설정 저장 | 카메라 위치·타깃, 층 표시, 분해 정도, 배경색을 모델별 1개 "뷰"로 저장·복원 | 기존 뷰어에 저장/불러오기 | `CadModelAsset.views[]`(소유자는 모델 따라감) | 없음 | 보통 |
| B 영상 연계: 카메라 키프레임 | A + 카메라 키프레임 2~N개(시간·위치·보간)로 짧은 3D 클립 | 뷰어에 타임라인 한 줄, 영상 프로젝트에서 "3D 클립" 선택 | 뷰 + 키프레임, 프로젝트가 모델·뷰 id 참조 | 렌더 스냅샷에 GLB·뷰 복사, 워커가 3D 씬 렌더 | 높음 |
| C 객체 편집: 변환·재질 | B + 노드 선택, 이동·회전·크기, 재질 색·거칠기, 편집본 GLB 내보내기 | 씬 트리+속성 패널+기즈모 | 노드별 override 또는 편집본 GLB 새 에셋 | B + 내보내기 직렬화 | 높음 |
- 웹 연계(H2)는 안A 결과를 읽기 전용 섹션으로 쓰는 별도 후속 작업으로 분리(이 작업 범위 밖).
- 사용자 영향: A는 기존 기능 위 추가라 비파괴. B·C는 `RenderJob` 입력 형식이 바뀌어 기존 렌더 호환 점검 필요.

## 4. 기술 검토
| 항목 | 판단 | 확인 필요 |
|---|---|---|
| 편집 상태 표현 | 순수 JSON(카메라·층·재질 override). three 객체 직렬화 금지. 화면·영상 모두 같은 JSON을 읽는 단일 씬 함수 | 층 id는 `extras.storeyId`가 있는 모델만 동작(현 뷰어 제약) |
| R3F 재현 | 뷰어와 렌더가 같은 컴포넌트를 쓰되 시간 입력을 props로 받음(`ContentScene`의 `time`·`rendering` 방식 준용) | 렌더 워커에서 WebGL 사용 가능 여부(Remotion 헤드리스 GL 옵션, 미확인, 실측 필요) |
| GSAP 역할 | 편집 UI의 미리보기 보간용. 렌더는 시간 → 상태 순수 함수로 계산(GSAP 타임라인에 의존하면 프레임 정확도 위험, 확인 필요) | 기존 `MotionGallery.tsx`가 gsap 사용 중 |
| 모델 용량 | 100MiB 한도 유지. 렌더 스냅샷 복사 시 디스크·시간 증가, 렌더당 모델 1개로 제한 권장 | 스냅샷 용량 상한 정책 미정 |
| 형식 | GLB 2.0 유지. GLTF(분리)·OBJ·FBX는 범위 밖(외부 파일 참조·파서 노출) | — |
| 업로드 검증 | 현재: 크기·gltf 버전 JSON 파싱(`cad-models.ts:46-58`). 안B·C 전 점검: 외부 URI(`buffers[].uri` http/file) 거부, 텍스처 해상도·개수 상한, 확장(draco·meshopt) 허용 여부 | 현재 외부 URI 검사 여부 미확인(코드 56행 이후 추가 확인 필요) |
| 보안 | 편집 JSON도 소유자 검증을 모델과 같이 적용(`getOwnedModel`). 뷰 id 단독 조회 API 금지. 재질 이름 등 문자열은 길이·문자 제한 | 노출 면 변경 시 threat-model 메모 |
| 편집본 내보내기(C) | three `GLTFExporter` 사용 → 새 GLB는 같은 `saveCadModel` 검증 경로 통과시킨다 | 원본 `extras` 보존 여부 미확인 |

## 5. 위험·열린 결정
| # | 질문(사용자에게) | 기본 가정 |
|---|---|---|
| 1 | 3D 편집 결과를 주로 어디에 쓰나: 영상 / 웹사이트 / 둘 다? | 영상 우선(H1) |
| 2 | 모델 형상을 직접 고치는 편집(안C)이 필요한가, 보기 설정(안A·B)이면 충분한가? | 보기 설정이면 충분 |
| 3 | 편집할 모델은 이 앱에서 만든 층(`storeyId`) 있는 GLB뿐인가, 외부 GLB도 되나? | 외부 GLB도 가능, 층 기능만 제한 |
| 4 | 영상에 3D를 넣으려면 서버 렌더가 필수인데, 렌더 서버 GPU/헤드리스 GL이 없으면 정지 이미지로 대체해도 되나? | 렌더 가능 여부 먼저 실측 |
| 5 | 모델 크기·텍스처 상한을 지금(100MiB)보다 낮춰도 되나? | 유지 |
| 6 | 한 모델에 저장할 뷰 개수 상한(예: 20)? | 20 |
- 위험: 렌더 호환(B), 업로드 파일 악용(외부 URI·대용량 텍스처), 3D 기능 범위 팽창(README가 새 CAD 개발 제외), 스냅샷 용량, 층 정보 없는 모델에서의 기능 공백.

## 6. 권장안과 완료 조건 초안
- 권장: **안A만 먼저**(보통 위험). 이어서 4번 질문(렌더 가능 여부)의 실측 결과로 B를 결정. C는 사용자 수요가 확인되기 전 보류.
- 안A 완료 조건(초안)
  - [ ] 뷰 저장·불러오기·삭제 API: 소유자만 가능, 남의 모델 뷰는 고정 404(`app/api/models/[id]/views`)
  - [ ] 뷰 스키마 검증: 숫자 범위·배열 길이·문자열 길이 제한, 잘못된 입력은 400
  - [ ] `ArchitecturalViewer`에서 저장한 뷰를 복원하면 카메라·층·분해가 같다(브라우저 확인)
  - [ ] 모델 삭제 시 뷰도 함께 삭제, 백업·복구 형식에 뷰 포함 또는 제외를 명시
  - [ ] 동적 권한 테스트 추가, 기존 모델 등록·삭제 테스트 통과, `q npm run lint`·타입 검사 통과
  - [ ] README 진행 현황 3D 줄과 `현재 구현` 갱신
- 안B 선행 과제: 렌더 워커에서 GLB 씬 1프레임 렌더 PoC(별도 작업, 통과 전 구현 금지).

## 수익·사업 관점
- 수익: premium(890만원) 차별 요소 '선택형 3D'에 실체 부여 / 검증: 건축·공간 고객 1~2곳에 뷰 저장+영상 클립 시연(미확인) / 자동화: 뷰 저장은 가능, 카메라 경로 자동 생성은 후속 / 정부지원 연결: 미확인.
- 다이어그램 요청: 없음(안B 진행 시 렌더 스냅샷 흐름 시퀀스).

## 7. 사용자 결정 (2026-11-02, 이 장이 1~6장보다 우선)
- 용도: 영상 제작과 웹사이트 **둘 다** 병렬 진행. 범위: **A·B·C안 모두**.
- 팀장 순서(파일 충돌·데이터 의존): ① A안(보기 설정 '뷰' 저장 — B·C의 기반 데이터) + B안 렌더 PoC(서버 헤드리스 WebGL에서 GLB 장면 렌더 가능 여부)를 병렬 → ② B안(카메라 키프레임 영상)·C안(객체 변환·재질·내보내기)·웹 연계(H2: PREMIUM 사이트 3D 뷰어 섹션)를 각각 작업으로 나눠 병렬. B·C·웹 연계는 위험 높음 → 착수 전 challenger.
- 업로드 GLB 검증(외부 URI·용량·텍스처 상한)은 A안에 포함한다(C안 내보내기·웹 공개의 전제).

## 8. challenger REVISE 반영 — A안 (2026-11-02, 팀장 결정. 이 장이 1~7장보다 우선)
1. 업로드 검증(`lib/server/cad-models.ts`, 공용 함수 `validateGlb`): BIN 청크 밖을 가리키는 `buffers[].uri`·`images[].uri`가 있으면 400(data: 포함). `extensionsRequired`는 허용 목록(KHR_materials_*, KHR_texture_transform, KHR_mesh_quantization)에 없으면 400. draco·meshopt·KTX2는 이번에 **허용하지 않는다**(디코더 외부 CDN 문제). 텍스처는 bufferView 안 PNG·JPEG 헤더로 크기를 읽어 2048px·64장까지, nodes 10,000·accessors 20,000·JSON 청크 4MiB까지. 업로드 상한은 100MiB를 유지하고, 동시 업로드는 2건으로 제한한다(넘으면 429).
2. 기존 모델: `npm run models:revalidate`(서버 정지 상태, dry-run 지원)로 일괄 재검증하고, 실패한 모델은 `invalid` 표시 → 뷰·B·C·H2 진입을 막는다. B·C·H2는 진입할 때 `validateGlb`를 다시 실행한다.
3. 뷰 쓰기: 뷰 저장·삭제는 `getOwnedModel(id, actor, 'change')`(운영자도 남의 모델은 404). 같은 모델에 대한 쓰기는 모델 id별 직렬 큐로 처리하고, 쓰기 직전에 .glb가 있는지 다시 확인한다(없으면 404, JSON을 되살리지 않음).
4. 뷰어 복원: 저장된 뷰를 열 때는 `Bounds` 자동 맞춤을 끄고 저장된 카메라를 그대로 적용한다. 카메라 거리·각도가 OrbitControls 범위를 벗어나면 서버가 400을 낸다(자르지 않는다). `floors` 길이는 모델의 storeyCount로 정하고(3 고정 제거), 배경색을 상태로 옮긴다. 좌표는 재중심화된 클론 공간 기준이라고 명세·코드 주석에 적는다.
5. 뷰 스키마: `view.schemaVersion = 1`, 모델당 최대 20개. 모르는 필드나 다른 버전은 400을 낸다(B의 키프레임, C의 override는 다음 버전에서 추가).
6. A6 메모리: 동시 업로드 2건 제한으로 처리한다(1항). 상한 하향(20MiB)은 H2 결정 때 다시 본다.
- B·C·H2는 각 작업에 들어가기 전에 challenger를 다시 거친다. 그 명세가 답해야 할 것은 이 장의 근거가 된 리뷰 B1~B3·H2·C1이다. B안 PoC 결과: Windows에서 R3F+GLB 카메라 보간을 1280×720·30fps·3초로 렌더했을 때 swiftshader 7.4초, swangle 11.5초였다(worktree `worktree-agent-a88ee708aa8c19f44`의 poc/3d-render/README.md). Linux·Docker는 확인하지 않았다.

## 9. B안 결정 (2026-11-02, challenger REVISE 반영 — ❓는 사용자 결정 대기)
1. 상한: 3D 렌더는 최대 1280×720, 30fps, 10초. validateProject의 일반 상한과는 따로 둔다.
2. 작업 시간 상한: 3D 작업 하나는 전체 5분까지. 워커 안의 타이머가 넘으면 kill하고, getJob은 pid가 살아 있어도 시작 시각과 상한을 보고 failed로 바꾼다. 종료는 프로세스 트리 전체(Windows taskkill /T, Linux 프로세스 그룹). 렌더 잠금은 전역 1개를 유지한다.
3. 자산: `input.model`을 따로 두고, 렌더 스냅샷에 GLB 복사본을 만든 뒤 **복사본에** validateGlb를 실행한다. 렌더러는 기존 `/api/renders/:id/assets/:assetId` 토큰 경로로 받는다(mimeType model/gltf-binary). 렌더가 끝나면(완료·실패·취소) render-files 복사본을 지운다.
4. 외부 네트워크: validateGlb가 `extensionsUsed`에 KHR_draco_mesh_compression·EXT_meshopt_compression이 있어도 거부한다(A안 보완). 렌더와 뷰어 모두 `useGLTF(url, false, false)`로 디코더를 끈다.
5. 참조 소유: saveProject와 startRender에서 getOwnedModel(actor.id)를 확인하고, 뷰가 그 모델에 있는지, invalid가 아닌지도 확인한다. 운영자도 남의 모델은 404.
6. 데이터: Project schemaVersion 1에 선택 필드 `scene3d {modelId, keyframes[{viewId 복사본 camera, atSeconds}], easing}`를 추가한다. 렌더 때는 뷰 카메라를 **복사**해 넣어 결과를 고정한다. 키프레임은 2~8개, 0~10초 단조 증가, easing은 linear·easeInOut. 서버가 카메라 범위를 다시 검사한다.
7. gl: 기본 REMOTION_GL(swangle)을 유지한다. Linux·Docker 실측은 B안 완료 조건에 넣는다(착수 조건은 아님).
8. ❓ 3D 클립을 어떤 형태로 만들지(새 콘텐츠 형식 "3D 워크스루" 단독 영상 / 기존 인트로의 한 구간).

## 10. C안 결정 (2026-11-02, challenger REVISE 반영 — ❓는 사용자 결정 대기)
- C1 원문(누락분): GLTFExporter는 draco·meshopt를 풀어 100MiB를 넘길 수 있고, 지원하지 않는 KHR 확장을 떨어뜨린다. 노드 이름은 고유하지 않다. 편집본은 새 id라 원본 뷰·override가 따라오지 않는다 → override 키는 원본 노드 index로 하고, 내보낸 파일도 A1 검증을 통과해야 한다.
1. 데이터: 뷰 v2가 아니라 모델별 **편집 문서** `edits.json`(모델 폴더 안, revision 필드)을 둔다. override는 최대 500개, 본문 상한 64KB. 저장할 때 revision이 다르면 409(lost update 방지).
2. 키: 로드할 때 GLTFLoader의 `parser.associations`로 원본 노드 index를 `userData.nodeIndex`에 새긴 뒤 clone한다. primitive가 여러 개인 mesh는 부모 노드 index를 쓴다. 재질 override도 노드 단위로 하고 적용할 때 재질을 복제한다. 원본→clone→index 대응을 테스트로 증명한다.
3. 편집 종류: 이동(±1000, 원본 노드 local TRS 기준), 회전(euler deg, ±360), 크기(0.01~100), 숨김, 재질 색(#hex, 텍스처가 있으면 곱셈)·roughness(0~1). metalness는 제외한다. `matrix`로 정의된 노드는 편집 대상에서 뺀다.
4. 층 분해와의 순서: override를 먼저 적용하고 분해 오프셋을 나중에 더한다. 내보낼 때는 분해를 끈 상태로 내보낸다.
5. 내보내기: 클라이언트 GLTFExporter(binary)로 만들어 기존 POST /api/models로 올린다(validateGlb·100MiB·업로드 슬롯 그대로). 숨긴 노드는 삭제하고, extras(storeyId)를 보존하는지 테스트한다. 상한을 넘으면 서버 400 안내. **데스크톱(1200px 이상)만** 허용한다.
6. 뷰 복사: 편집본은 새 모델이고 뷰는 복사하지 않는다(재중심 공간이 바뀜). `sourceModelId`를 기록하고, 원본을 삭제해도 편집본은 남는다. 원본을 삭제하면 원본의 edits.json도 같이 지운다.
7. 소유: 편집 저장·내보내기 원본 확인은 모두 'change'로 한다(운영자도 남의 모델은 404). 동적 권한 테스트에 넣는다.
8. 되돌리기: 클라이언트 undo 스택(50단계)만 둔다. 서버 리비전은 1항의 revision(409)으로 충분하다.
9. 재검증 비용: B·C·H2 진입 때 하는 validateGlb 결과는 모델 JSON에 `validatedAt`·파일 mtime·크기와 함께 저장하고, 같으면 다시 하지 않는다. 다시 할 때는 업로드 슬롯을 같이 쓴다.
10. 성능: 노드 2,000개가 넘으면 씬 트리를 가상화하고 선택은 클릭 시 raycast 1회. 실측 대상은 pavilion-demo.glb와 노드 수천 개 합성 모델, 이 PC 데스크톱 Chrome.
11. 검증: 편집 → 내보내기 → 다시 업로드 → 다시 열기 후 노드 수와 TRS를 비교한다. 내장 샘플(Building, GLB 아님)은 C안 대상에서 제외한다.
12. ❓ 편집본 GLB 내보내기가 꼭 필요한지(편집 문서만 저장해도 영상·웹에 반영 가능). B 렌더와 웹 뷰어가 편집 문서를 적용하는지(의존 순서).

## 11. H2(웹사이트 3D 연결) 사용자 결정 (2026-11-02)
- 공개 파일은 **공개용 정리본**이다(노드 이름·extras 제거 사본, 원본은 비공개). 웹 공개 상한은 **20MB**.

## 12. 사용자 결정 반영 (2026-11-02)
- B안 형식: **새 콘텐츠 형식 "3D 워크스루"**(contentType `walkthrough-3d`, 단독 영상, 사진 0장 허용). 기존 인트로 렌더 흐름은 바꾸지 않는다. 9장 8항 확정.
- C안 범위: **편집 저장 + 영상·웹 반영**. GLB 내보내기(10장 5·6항)는 이번 범위에서 빼고 나중 후보로 둔다. 10장 12항 확정: B 렌더와 H2 정리본은 edits.json을 적용한다.
- 진행 순서(팀장): B·C를 병렬로 구현한다(B는 렌더·모델 검증, C는 뷰어·편집 문서). edits.json 적용 함수는 C가 `lib/cad-edits.ts`(순수 함수)로 먼저 만들고, B와 H2는 그 함수를 가져다 쓴다. H2는 B(9장 4항 extensionsUsed 차단)와 C(편집 적용 함수)가 끝난 뒤 착수한다.

## 13. H2 결정 (2026-11-02, challenger REVISE 반영 — 팀장 기본값, 이 장이 11장의 세부를 정한다)
1. 섹션: `model3d`를 DEFAULT_WEBSITE_SECTIONS와 ADDED_SECTION_IDS 끝에 숨김으로 추가하고, 섹션 길이는 3·5·6·7을 허용한다. 모델 참조는 **사이트 단위로만** 둔다(page.content에는 두지 않음).
2. 정리 규칙: node·mesh·material·scene·image 이름, extras(storeyId만 남기고 값은 `s1`·`s2`… 순번으로 바꿈), asset.generator·copyright, cameras, KHR_lights를 제거한다. storeyId는 웹에서 층 표시·분해를 재현하는 데 필요하고, 순번으로 바꿔 원본 식별 정보는 남기지 않는다. 정리 전후 경계 상자가 같은지 테스트한다.
3. 생성·무효화: 소유자가 사이트를 저장할 때 만든다(익명 요청 때 만드는 지연 생성은 금지). 위치는 `.local-data/models/{id}.public.glb`, 키는 원본 mtime·크기, edits revision, 정리 규칙 버전이다. 모델 삭제·invalid 표시·edits 변경 때 같은 큐에서 지운다.
4. 검증: 정리본에도 validateGlb를 실행한다(10장 9항 캐시 적용). B의 extensionsUsed 차단이 먼저 끝나야 한다.
5. 공개: `GET /api/models/:id/public`(ApiAccess `public-model`). 조건은 소유자 사이트에서 켜진 model3d 섹션이 참조하고, 모델 ownerId가 사이트 ownerId와 같고, invalid가 아닌 것이다. 요청마다 판정하고 캐시하지 않으며 `Cache-Control: no-store`. 원본 /asset는 계속 비공개다.
6. 20MB: 정리본이 20MB를 넘으면 사이트 저장 때 400과 함께 안내하고 자동 축소는 하지 않는다(이름 정리로는 용량이 거의 줄지 않음).
7. 내보내기: three 런타임은 빌드 때 IIFE 번들(로컬 산출물, CDN 금지)로 만들어 ZIP `assets/`에 넣고 GLB도 `assets/`에 파일로 넣는다. ZIP README에 "3D는 웹 서버에서 열 때 보입니다(file://에서는 대표 이미지만 보임)"를 적는다. 단일 HTML에서는 3D 섹션을 대표 이미지로 대체한다. 60MB TOTAL_LIMIT에 GLB도 포함한다.
8. CSP: 내보낸 HTML에 meta CSP를 넣는다(script-src 'self', connect-src 'self', img-src 'self' data: blob:). 앱의 공개 미리보기에도 같은 정책을 응답 헤더로 둔다.
9. 뷰: 저장 때 뷰 카메라를 **복사**한다(결과 고정). 뷰가 없으면 Bounds 기본 시점을 쓴다.
10. 모바일: 대표 이미지(포스터)를 먼저 보여 주고 눌러야 3D를 불러온다. DPR 상한 1.5. 실측 기기는 Chrome 390px 에뮬레이션이고, 실기기는 베타 전 확인 항목으로 둔다.
11. 동적 권한 테스트는 challenger 11항 목록을 그대로 넣는다.
