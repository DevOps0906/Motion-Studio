# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-02
- 현재 작업: task-008 코드 완료(커밋), 실제 데이터 이전 대기(사용자 확인 필요)
- 마지막으로 한 일: W4 병렬 — task-006(필수 입력·주소 제안)·task-007(갤러리·페이지별 후기/FAQ)·task-008(계정별 자료 분리) 구현, 모두 reviewer code·security ACCEPT 후 🟡 반영
- 다음 한 걸음: README 배포 순서대로 ① 백업 → ② 서버 정지(docker compose down) → ③ 코드 교체 → ④ migrate:owner --dry-run --owner skydy96@gmail.com → ⑤ migrate:owner → ⑥ 기동 → 재로그인·자료 보임·공개 미리보기 이미지 확인
- 경고: 새 코드로 migrate 전에 기동하면 id 없는 계정은 전부 401(노출은 없음)
- 열린 결정(사용자 확인 필요): 실제 데이터 이전 시점, 도메인, Dependabot PR #1~#4, Resend·Slack·Discord 키, 갤러리 제목 고정("갤러리") 유지 여부
- 주의: 4101 포트 점유 → 4111. Codex 한도(2026-11-04 17:54) → reviewer로 대체. Git Bash python은 WindowsApps 스텁 → Python312 경로를 PATH 앞에. node_modules 없었음 → npm ci로 복원. next dev/build 후 next-env.d.ts 되돌리기
- 알려진 한계: Docker 수동 시나리오·백업→이전→복원 리허설 미실시. 운영자 전체 문의함 UI 없음(API ?owner=all만). 3구간 화면 확인(shot) 미실시(task-006·007). 미인증 공개 판정 전수 읽기(수용한 위험)
- SDLC 단계: 08 배포 준비
- 테스트 상태: typecheck·test(test-ownership 51 메서드 동적)·build 통과(2026-11-02)
- 남은 작업: task-008 실제 데이터 이전, task-005 2단계(도메인·HTTPS), 3D 편집, 영상 음성 인식
