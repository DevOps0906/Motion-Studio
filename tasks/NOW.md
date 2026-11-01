# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-11-02
- 현재 작업: task-005 1단계 완료(커밋) — 2단계는 도메인 확정 후
- 마지막으로 한 일: 리뷰(Opus code·Fable security) 지적 3건 반영(오류 로그 instrumentation 연결, 로그인 전역 제한은 없는 이메일만, /_next/image 공개 폴더 한정), 브라우저 verify 스크립트 세션 주입. Docker 격리 컨테이너(임시 데이터)에서 health·비root·로그인·401/307·가입 차단·저장·공개 미리보기·문의·대표 이미지 공개·백업(0700)·복구 거부/복원 확인. 실제 .local-data는 백업(backups/20261101-181921) 후 QA 계정 3·세션 1·문의 1·QA 웹사이트 1 삭제. README 진행률 75%
- 다음 한 걸음: 사용자가 운영자 계정 생성(account:create) → 터널 주소 로그인·Secure 쿠키 확인. 임시 공개 주소는 compose tunnel 프로필(Cloudflare Quick Tunnel)
- 열린 결정(사용자 확인 필요): 도메인, Dependabot PR #1~#4 병합, Resend·Slack·Discord 키, 운영자 이메일
- 주의: 4101 포트는 다른 프로그램 점유 → 4111. Codex 한도(2026-11-04 17:54). next dev 후 next-env.d.ts 되돌리기
- 알려진 한계: verify-api·verify-media-render·verify-platform-output은 로컬 .local-data 파일을 전제(원격·컨테이너 검증 시 실패). Caddy 뒤 Secure 쿠키는 2단계에서 확인
- SDLC 단계: 08 배포 준비(1단계 완료)
- 테스트 상태: typecheck·test(인증 76 메서드 포함)·build·Docker 수동 검증 통과(2026-11-02)
- 남은 작업: task-005 2단계(도메인·HTTPS·내보낸 사이트 문의 폼), 3D 편집, 계정별 자료 분리, 영상 음성 인식
