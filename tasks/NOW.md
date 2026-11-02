# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-02 (사용자 요청으로 오늘 작업 종료)
- 현재 작업: 없음(정지). 마지막 커밋은 task-010 B안·C안 병합과 README 진행 현황 갱신(약 82%)
- 오늘 완료: task-006(필수 입력·주소 제안), task-007(갤러리·페이지별 후기/FAQ), task-008(계정별 자료 분리 코드), task-009(운영자 전체 문의함), task-010 A(뷰 저장·GLB 검증)·B(3D 워크스루)·C(형상 편집 저장), task-011(음성 전사·SRT). 모두 reviewer code·security 거쳐 반영
- 다음 한 걸음: task-010 편집 내용을 워크스루 영상에 반영(render.ts input.json edits:null → models/{id}/edits.json 읽기, remotion/Walkthrough3D.tsx Model에서 tagNodeIndices·buildEditedScene 적용) → H2 웹사이트 3D 섹션(명세 13장)
- 열린 결정(사용자): 운영 데이터 위치(이 폴더에 .local-data·backups 없음 → migrate:owner 보류), 실제 사람 한국어 음성 샘플(STT 재측정), 도메인, Dependabot PR, 알림 키
- 주의: next dev(webpack)는 hydration 안 됨 → 브라우저 검수는 next start(포트 4112)로. Git Bash python은 WindowsApps 스텁. worktree 3개(.claude/worktrees: PoC 3D 렌더·STT 벤치마크·C안) 남아 있음 — PoC 브랜치는 기록용
- 알려진 한계: Docker 빌드(whisper.cpp)·Linux 렌더 미검증, 전사 시간 렌더 미반영, C안 편집 UI 브라우저 미확인, restore.cjs 서버 판정 함수 미통일
- SDLC 단계: 08 배포 준비 + 기능 확장(W4·W5)
- 테스트 상태: typecheck·test·build 통과(2026-11-02, 병합 후)
