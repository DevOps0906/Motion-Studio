# CAD → 시각화 에셋 파이프라인 — 초안

상태: 모델 업로드·변환 워커 미구현. 기존 사진·영상 업로드 API는 CAD·GLB를 지원하지 않는다.

## 원본과 파생물

- sources: .3dm/.gh/.f3d/.step/.blend 등 원본. 형상·파라미터·이력을 보존한다.
- staging: 원본 revision별 내보내기·메시·텍스처·변환 로그.
- runtime/r3f: 검증된 GLB와 scene-manifest.json.
- runtime/unity: 설치 버전에 맞는 FBX·지원 모델·텍스처·임포트 설정.
- runtime/unreal: 검증한 FBX/USD/Datasmith 등과 맵·임포트 설정.
- reports: 치수·계층·재질·예산 검사와 스크린샷.

모든 파생물에 sourceRevision, contentHash, toolVersion, exportOptions, transformToRuntime, validationStatus를 기록한다. 원본 파일을 런타임 파일로 덮어쓰지 않는다.

## 처리 단계

원본 저장 → CAD 검증 → 테셀레이션/직접 내보내기 → 필요 시 Blender 최적화 → 엔진별 패키지 → 검사 → 런타임 승격.

Rhino의 직접 GLB 결과가 기준을 통과하면 Blender는 생략한다. 곡면 테셀레이션 허용 오차는 원본 단위와 함께 기록하고 실루엣을 비교한다. Blender 전용 재질 노드가 glTF에서 그대로 유지된다고 가정하지 않는다.

## 필수 검사

단위·축·원점·방위 / 실제 바운딩 박스 / 객체·층·재질 ID / 텍스처 누락·외부 경로 / 법선·삼각형·드로우콜 / 파일 크기·첫 로딩 / 웹·엔진별 시각 비교.

선택할 객체 ID는 최적화 후에도 유지하거나 명시적 ID 매핑을 제공한다. 모델 병합·인스턴싱·압축은 층별 숨김·선택·재질 교체와 함께 검증한다. 변환 실패는 원본과 실패 보고를 남기고, 검증되지 않은 파일을 자동 공개하지 않는다.
