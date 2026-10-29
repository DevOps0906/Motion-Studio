# Motion Studio — AI Architectural Studio 기획 v0.1

2026-10-29. 상태: 확장 기획. 사용자가 제안한 건축 AI 모델링·인터랙티브 웹 전략을 Motion Studio의 공간 모듈에 추가한다. CAD·엔진 설치·연결, 실제 건축 모델 생성, PDF 생성은 이번 작업에서 수행하지 않는다.

## 1. 제품과 공통 기반

도면·이미지·치수·프롬프트 → 모델링 명세 → AI 도구 제어 → CAD 검증 → 시각화 모델 변환 → 출력 엔진 선택 → 웹 체험·영상.

MCP는 AI와 제작 도구의 연결 계층이다. 형상 변환, 최적화, 렌더링은 별도 단계다. 기존 Motion Studio의 프로젝트·미디어 ID·모션 명세·작업 상태·결과 검수·대시보드를 재사용하되, CAD 원본과 파생 모델의 새 저장·검증 계약을 추가한다. 현재 사진 업로드 API에 CAD 파일을 넣거나 기존 /gallery가 건축 모델을 지원한다고 표시하지 않는다.

## 2. 제작 도구와 어댑터

| 도구 | 계획한 책임 | 이 프로젝트의 상태 |
| --- | --- | --- |
| Rhino 8·Grasshopper | 건축 매스·층·곡면·파사드와 파라미터 | 연결·실행 미검증 |
| Fusion | 치수 기반 부품·조립·하드웨어 | 연결·실행 미검증 |
| Blender | 메시·UV·PBR 재질·텍스처·LOD·내보내기 | 연결·실행 미검증 |
| Unity CLI/MCP | Collider·이동·전시·문·투어·웹 빌드 | 프로젝트 연결 미검증 |
| Unreal MCP | Actor·재질·조명·Blueprint·Sequencer | 프로젝트 연결 미검증, 공식 기능은 Experimental |

AI 모델 이름을 아키텍처의 필수 조건으로 고정하지 않는다. 기획·모델링 명세·실행·검증 역할을 나누고 도구의 실제 기능 목록과 연결 조건을 확인한 뒤 담당을 정한다.

## 3. 세 출력 파이프라인

| 순서 | 파이프라인 | 첫 결과 | 통과 기준 |
| --- | --- | --- | --- |
| B1 우선 | Rhino/Fusion → 필요 시 Blender → GLB+메타데이터 → R3F·GSAP | 파라메트릭 건축 웹 뷰어 | 회전·층 선택·재질 프리셋·카메라 투어, 치수·ID·성능 검사 |
| B2 후속 | CAD·Blender → 검증된 엔진용 에셋 → Unity CLI/MCP → Web 빌드 | 가상 건축 전시관 | 전시실 1개·작품 10개·이동·충돌·확대·투어, 브라우저 검증 |
| B3 후속 | CAD·Blender → Unreal MCP → GPU 앱 + Pixel Streaming → 웹 연결 | 고품질 모델하우스 | 공간 2개·재질 3종·세션 정리·지연·GPU 비용 측정 |

Blender는 조건부 최적화 단계다. Rhino의 직접 GLB 출력 결과가 검증과 예산을 충족하면 생략할 수 있다. FBX·USD·Datasmith 등은 설치 버전과 실제 임포트 결과를 확인한 뒤 선택하며, 모든 형식이 모든 속성을 보존한다고 가정하지 않는다. Unreal 앱은 GPU 서버에서 실행하고 브라우저에 스트리밍하는 경로로 설계한다.

## 4. 개발주기와 작업 게이트

- ARC-001: 도구 버전·설치·플러그인·라이선스·MCP/CLI 기능 인벤토리, 읽기 전용 연결 확인.
- ARC-002: 별도 테스트 문서에서 큐브 1개 생성→치수 조회→저장→다시 열기. 변경 전후 증거 기록.
- ARC-003: 3층 데모 건물 명세·파라미터·씬 그래프 확정, 매스·층·창호 생성과 CAD 검증.
- ARC-004: GLB·메타데이터 변환, 축·단위·법선·재질·ID·계층 검사, 자산 예산 측정.
- ARC-005: R3F 건축 뷰어 MVP. 외부 CAD 연결이 준비되지 않으면 명시적으로 등록한 수동 GLB로 뷰어 개발을 병행한다.
- ARC-006: 사용자 치수·시각 검수, 목표 PC·모바일·네트워크 성능 검증. 통과 전 Unity·Unreal의 통합 완료를 선언하지 않는다.
- ARC-007: Unity 전시관 PoC와 Web 빌드 검증.
- ARC-008: Unreal 모델하우스 PoC·Pixel Streaming·동시 세션·종료·비용 검증.
- ARC-009: 반복 제작·버전·복구·관측, 이후 테넌트·큐·SaaS 운영 검토.

각 티켓은 기획→디자인→명세→구현→검증→사용자 검수→운영 단계를 반복한다. 현재 15초 인트로의 개발·검증을 되돌리지 않고 공간 모듈에 병렬 트랙을 추가하는 로드맵이다. 고정 기간이나 제작 정확도를 보장하지 않는다.

## 5. 데이터와 작업 계약

계획 데이터: ArchitecturalProject(id, schemaVersion, revision, brief, sourceUnit, transformToRuntime, sourceArtifacts, visualizationVariants, sceneManifest, validationReport, cameraTours, integrationRuns).

Artifact에는 해시·원본 revision·내보내기 설정·도구 버전·파생 관계를 기록한다. 도구 실행 기록에는 sessionId, writerLease, commandId, before/after revision, 결과·오류·증거가 필요하다. 웹 UI 이벤트는 objectId를 참조하며 표시 이름을 식별자로 쓰지 않는다.

공통 저장 UI 재사용과 실제 CAD 지원은 별개다. 별도 검증을 통과한 모델 패키지만 뷰어에 승격한다. 원본 CAD, 시각화 모델, 웹 객체 메타데이터의 버전을 함께 연결한다.

## 6. 설계 문서

- [CAD_MODELING_SPEC.md](CAD_MODELING_SPEC.md): 치수·단위·건축 요소 명세.
- [MCP_INTEGRATION.md](MCP_INTEGRATION.md): 연결·기능 탐색·단일 작성자 계약.
- [PARAMETRIC_SPEC.md](PARAMETRIC_SPEC.md): Grasshopper 파라미터와 재생성 규칙.
- [ASSET_PIPELINE.md](ASSET_PIPELINE.md): 원본·변환·최적화·승격.
- [SCENE_GRAPH.md](SCENE_GRAPH.md): 객체·층·원본 ID 계층.
- [INTERACTION_SPEC.md](INTERACTION_SPEC.md): 엔진별 탐색·선택·재질·투어.
- [RENDERING_STRATEGY.md](RENDERING_STRATEGY.md): R3F·Unity·Unreal 출력 경계.
- [PERFORMANCE_BUDGET.md](PERFORMANCE_BUDGET.md): 임시 예산·실측 방법.
- [CAD_VALIDATION.md](CAD_VALIDATION.md): 체크 항목·검수·보고 계약.

## 7. 공식 자료 확인과 변경점

2026-10-29 확인. 제공된 전략을 그대로 설치·지원 보장으로 해석하지 않고 아래 공식 문서를 기준으로 연결 시 재확인한다.

- [McNeel Rhino MCP 시작](https://mcneel.github.io/RhinoAI/docs/getting-started/): Rhino·Grasshopper 연결 및 클라이언트별 안내.
- [Rhino 파일 형식](https://www.rhino3d.com/features/file-formats/): Rhino 8 GLB/glTF 입출력 안내. 실제 재질·계층은 내보내기 검사로 확인.
- [Fusion MCP 개요](https://help.autodesk.com/view/fusion360/ENU/?guid=FMCP-OVERVIEW): 실행 중인 데스크톱 모델링과 클라우드 데이터 접근을 구분한다.
- [Blender glTF 설명](https://docs.blender.org/manual/en/5.1/addons/import_export/scene_gltf2.html): 지원되는 재질 표현과 변환 차이를 확인한다.
- [Unity CLI로 기존 MCP 교체](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli): 에디터 AI Assistant 내 MCP는 대체되었고 CLI의 MCP 모드를 기준으로 계획한다.
- [Unreal MCP](https://dev.epicgames.com/documentation/unreal-engine/unreal-mcp-in-unreal-editor): Experimental 상태와 도구 호출 직렬 실행 조건을 반영한다.
- [Pixel Streaming 개요](https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-pixel-streaming-in-unreal-engine): Unreal 실행과 웹 연결을 별도 배포 계층으로 둔다.

건축 적합성·구조·법규 승인과 시각화 자동화의 결과를 구분한다. GPU 비용·동시 사용자 수·SaaS 가능성은 작은 PoC의 측정으로 판단한다.
