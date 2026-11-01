# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-01
- 현재 작업: task-004 브리프 기반 홈 초안 생성 — 상태: 완료
- 마지막으로 한 일: 규칙·선택형 OpenAI 초안, 미리보기 후 선택 적용·되돌리기 구현. challenger REVISE 반영, reviewer security ACCEPT·code REQUEST_CHANGES(프로젝트 전환 시 되돌리기 누수) 수정, 라디오 버튼 크기 CSS 수정, 브라우저 검수 통과. README 진행률 71%로 갱신
- 다음 한 걸음: task-005 공개 운영 — 착수 전 선수정 3건(웹사이트 PATCH 무인증·운영자 이메일 선점 가입·운영자 목록 빈 경우 Host 판정) + 배포 대상·도메인 결정 필요
- 열린 결정(사용자 확인 필요): task-005 배포 대상(자체 서버·Docker·클라우드), 도메인, Dependabot PR #1~#4 병합
- 주의(이번 작업에서 알게 된 함정): 4101 포트는 다른 프로그램 점유 → 4111. Codex 한도(2026-11-04 17:54). 전역 input 스타일이 radio에 적용되던 문제 수정함
- SDLC 단계: 07 QA 완료
- 담당 모델/역할: planner·challenger·builder·reviewer(Opus), 팀장 검수·CSS 수정
- 수정 파일: lib/{website-draft}.ts, lib/server/{website-draft,website-requirements}.ts, app/api/websites/draft/**, components/{WebsiteDraftPanel,WebsiteBuilder}.tsx, app/globals.css, scripts/test-website-draft.cjs, package.json, README.md, tasks/*
- 테스트 상태: typecheck·npm test·build 통과(팀장), 브라우저 수동 검수 통과
- 남은 작업: task-005(높음)
