# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-01
- 현재 작업: task-002 웹사이트 섹션·페이지별 이미지 확장 — 상태: 완료(커밋 대기)
- 마지막으로 한 일: 후기·FAQ 섹션, 페이지별 대표 이미지(저장 확인·삭제 방지), 빈 항목 거르기, 안내 문구 정정. reviewer(Opus) ACCEPT 후 Should 2건 반영
- 다음 한 걸음: task-003 문의 전송·운영자 알림(위험도 높음 → 착수 전 challenger) 또는 task-004 벤치마크 분석
- 열린 결정(사용자 확인 필요): task-003 알림 수단(이메일·웹훅 등), Dependabot PR #1~#4 병합 여부
- 주의(이번 작업에서 알게 된 함정): Codex 한도 초과(2026-11-04 17:54까지) → reviewer로 대체. 4101 포트는 다른 프로그램 점유
- SDLC 단계: 06 구현 완료 → 07 QA(브라우저 확인은 미실행)
- 담당 모델/역할: builder(Opus) 구현 · reviewer(Opus) 리뷰 · 팀장 검증
- 수정 파일: lib/website*.ts, lib/server/{websites,store}.ts, components/Website*.tsx, app/api/websites/[id]/export/route.ts, scripts/test-websites.cjs, tasks/*, README.md
- 테스트 상태: typecheck·npm test·build 통과(build는 builder 실행)
- 남은 작업: task-003(높음) · task-004 → task-005(높음)
