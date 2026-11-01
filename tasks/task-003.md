# task-003 고객 홈페이지 실제 문의 전송·운영자 알림 (확정 명세)

- 결정(사용자 2026-11-01): 알림은 이메일(Resend)·Slack·Discord·관리자 화면 모두. 외부 알림은 링크만(개인정보 미포함). 내보낸 HTML·ZIP 폼은 task-005로 미룸.
- challenger REVISE 반영 완료. 위험도 높음 → 변경 후 reviewer(code)+reviewer(security).

## 1. 범위
1. 브리프에 사이트 전체 옵션 `inquiryForm: boolean`(기본 false, 없는 옛 데이터는 false). 켜면 문의 섹션이 보이는 모든 페이지의 **저장된 미리보기(`/websites/[id]`)와 편집기 미리보기**에 폼 표시. 내보낸 HTML·ZIP 출력은 변경 없음(폼 미포함).
2. 폼: 이름(≤50)·연락처(이메일 또는 전화, ≤100)·내용(≤2000)·개인정보 수집·이용 동의(필수, 목적·항목·보관 90일 문구)·허니팟 필드. 상태: 입력·전송 중·성공·오류.
3. `POST /api/inquiries` (JSON, 같은 출처 — proxy.ts 변경 없음). 본문 16KB 제한, `{websiteId, submissionKey(클라이언트 UUID), name, contact, message, consent, website(허니팟)}`.
   - 사이트 존재·`inquiryForm` 켜짐 확인, 허니팟 채워지면 성공처럼 응답하고 저장 안 함.
   - 속도 제한(메모리): 사이트당 10분 5건, 전체 10분 30건. XFF 등 헤더 기반 IP는 쓰지 않는다.
   - `.local-data/inquiries.sqlite`에 저장, 90일 지난 행 삭제, submissionKey 중복은 기존 접수로 응답.
   - 응답에 내부 정보·오류 상세 없음.
4. 알림: `after()`(next/server, 이 버전 문서 확인)로 응답 뒤 발송. 실패해도 접수 성공. 채널별 결과(sent/skipped/failed)를 행에 기록.
   - 내용은 "새 문의 1건 · {사이트 제목} · {관리자 링크}"만. 관리자 링크는 `APP_BASE_URL`(https 또는 localhost)이 있을 때만.
   - Slack은 `& < >` 엔티티 처리, Discord는 마크다운 이스케이프 + `allowed_mentions:{parse:[]}` + `flags: 4`(SUPPRESS_EMBEDS).
   - 이메일: Resend HTTP API(fetch, 새 의존성 없음) `RESEND_API_KEY`·`INQUIRY_EMAIL_FROM`·`INQUIRY_EMAIL_TO`, 텍스트 본문.
   - Slack `SLACK_WEBHOOK_URL`(https·`hooks.slack.com`만), Discord `DISCORD_WEBHOOK_URL`(https·`discord.com`/`discordapp.com`의 `/api/webhooks/`만). 설정 안 됐거나 형식이 틀리면 skipped.
   - 외부 알림 전역 상한: 시간당 30건, 초과분은 skipped(화면 알림만). 요청당 5초 타임아웃.
   - 비밀은 서버 환경 변수로만. 로그·응답·클라이언트 번들 노출 금지. `.env.example`에 키 이름만 추가.
5. 관리자 화면 `/websites/inquiries`: 최신 100건, 읽음 처리(`PATCH /api/inquiries/{id}`), 채널별 발송 결과, 빈·오류 상태. 권한은 `canReadRequirements`와 같은 규칙(API·화면 모두 서버에서 확인).
6. 사이드바 "웹사이트 제작기"에 안 읽은 문의 수 배지(운영자에게만, 권한 없으면 숨김).
7. 편집기 문의 섹션에 "문의 폼 사용" 토글 + "외부 알림에는 개인정보가 담기지 않습니다" 안내.

## 2. 범위 밖 (후속)
- 내보낸 HTML·ZIP 폼, 교차 출처 허용, 공개 inquiryKey, CSP 변경 → task-005.
- 기존 취약점: `/api/websites/[id]` PATCH 무인증, 운영자 이메일 선점 가입, 운영자 목록 비었을 때 Host 판정 → task-005 착수 전 필수 수정.
- 캡차, 자동 회신, 고객별 알림 대상.

## 3. 완료 조건
- typecheck·test·build 통과. 테스트: 입력 검증·한도, 동의 필수, 허니팟, 폼 끈 사이트 거부, 중복 키, 속도 제한(사이트·전역), 알림 실패해도 접수 성공, 웹훅 URL 호스트 검사, Slack·Discord 이스케이프, 외부 알림 본문에 이름·연락처·내용 없음, 전역 알림 상한, 운영자 외 목록·읽음 처리 거부, `inquiryForm` 없는 옛 데이터 호환.
- 브라우저: 저장된 미리보기에서 실제 제출 → 관리자 화면 표시·배지 확인(팀장).
