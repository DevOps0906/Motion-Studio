# task-005 공개 운영 준비 1단계 (도메인 없이 가능한 것) — 계획 초안

- 결정(사용자 2026-11-01): 자체 서버 + Docker. 도메인 미정 → HTTPS·도메인 연결과 내보낸 사이트 문의 폼은 2단계.
- 위험도 높음(인증·권한·노출 면·백업) → 착수 전 challenger, 변경 후 reviewer(code)+reviewer(security).

## 1. 인증 일괄 적용 (선수정 1)
- 현황: 변경 API 24개 중 18개가 로그인 확인 없음(웹사이트 PATCH·프로젝트/미디어/모델 삭제·렌더 등). 읽기 GET도 대부분 무인증.
- `proxy.ts`에서 `/api/*` 전체를 기본 로그인 필요로 바꾼다(세션 쿠키 검증은 `lib/server/accounts.ts` 재사용). 공개 허용 목록만 예외:
  `POST/DELETE /api/auth`, `POST /api/inquiries`, `POST /api/website-requirements`, `GET /api/health`.
- 페이지: 로그인 화면·고객 요구사항 진단(`/website-requirements`)·저장된 미리보기 문의 폼 외에는 로그인 필요인지 확인하고, 아니면 같은 규칙 적용.
- 기존 같은 출처 검사는 유지. 미인증 API는 401 JSON.

## 2. 운영자·가입 (선수정 2·3)
- `NODE_ENV=production`에서는 `REQUIREMENTS_ADMIN_EMAILS`가 비면 운영자 없음(Host 판정 금지). 개발 모드는 지금처럼 localhost 허용.
- 가입: `SIGNUP_ENABLED=true`일 때만 `register` 허용(production 기본 꺼짐, 개발 기본 켜짐). 운영자 계정은 `npm run account:create -- <email>`(대화형 비밀번호 입력, 서버에서만 실행) 스크립트로 만든다 → 운영자 이메일 선점 차단.

## 3. 백업·복구
- `npm run backup`: `.local-data`의 SQLite는 온라인 백업(`VACUUM INTO` 또는 node:sqlite backup), 나머지 파일은 복사해 `backups/<시각>.zip`(또는 폴더)로 만든다. 보관 개수 N(기본 14) 넘으면 오래된 것 삭제.
- `npm run restore -- <백업>`: 서버 정지 상태에서만(잠금 파일 확인) 복원. 문서에 절차.
- Docker: compose에 백업 볼륨, 호스트 cron/작업 스케줄러 예시를 문서로.

## 4. 모니터링
- `GET /api/health`: 앱·DB 열림·디스크 여유(기준 미만이면 503)만, 내부 경로·버전 상세 미노출. Docker HEALTHCHECK를 이 경로로.
- 서버 오류 로그를 한 줄 JSON(시각·경로·상태·요청 ID, 개인정보·비밀 제외)으로 표준 출력.

## 5. Docker 재검증
- `docker compose build && up -d` → health 200, 로그인·웹사이트 저장·렌더 1건·문의 접수·백업/복구를 컨테이너에서 확인(팀장).
- HTTPS용 Caddy 서비스는 compose에 주석 처리된 예시로만(도메인 확정 후 2단계).

## 6. 범위 밖 (2단계)
- 도메인·HTTPS 실제 연결, 내보낸 사이트 문의 폼(inquiryKey·CORS·CSP), 계정별 자료 분리, 외부 모니터링 서비스.

## 7. 완료 조건
- typecheck·test·build 통과. 테스트: 허용 목록 외 /api 미인증 401(대표 경로 전부), 허용 목록은 통과, production에서 운영자 목록 비면 운영자 거부, SIGNUP_ENABLED 꺼지면 가입 거부, account:create, 백업 생성·보관 개수·복원, health 응답에 내부 정보 없음.
- 기존 테스트·검증 스크립트가 로그인 전제로 깨지면 테스트 쪽을 세션 생성으로 맞춘다.
- Docker: 5장 수동 확인(팀장).

## 8. challenger REVISE·사용자 결정 반영 (2026-11-01, 이 절이 위 내용보다 우선)
- 사용자 결정: 공개 페이지는 웹사이트 미리보기(`/websites/[id]`, 문의 폼 포함)만. `/intro/[id]`는 로그인 필요. 계정은 운영자만(production 가입 닫힘, account:create로만 생성). 배포 전 QA 계정·세션·테스트 문의·"QA 다중 페이지 검수" 프로젝트 삭제(백업 후, 팀장). Next 문서(`node_modules/next/dist/docs/`) 읽기는 사용자가 허용 → builder가 proxy 런타임 제약을 문서로 확인.
1. 공개 허용 목록(정확히 일치, 메서드 단위): `GET/POST/DELETE /api/auth`, `POST /api/inquiries`, `POST /api/website-requirements`, `GET /api/health`, `GET /api/media/:id`는 **어떤 웹사이트의 홈·페이지 대표 이미지로 쓰이는 이미지일 때만** 미인증 허용(그 외 401). `GET /api/media`(목록)는 비공개. HEAD는 GET과 같게.
2. 페이지 보호: proxy matcher를 페이지까지 넓혀 미인증이면 `/login`으로 보낸다. 공개 페이지: `/login`, `/website-requirements`, `/websites/[id]`, 정적 자산(`/_next`, 공개 파일). 서버 컴포넌트에서 데이터를 직접 읽는 페이지도 공통 도우미로 세션을 재확인(proxy만 믿지 않음). proxy에서 Node API를 못 쓰면 쿠키 존재만 보고 실제 검증은 공통 도우미에서.
3. `backups/`를 `.gitignore`·`.dockerignore`에 추가, 폴더 권한 0700. 형식은 폴더(zip 아님). 보관은 개수 14개 + 총 용량 상한(기본 5GB) 중 먼저 걸리는 것.
4. 테스트·verify 스크립트는 `SIGNUP_ENABLED=true`·`REQUIREMENTS_ADMIN_EMAILS`를 테스트 환경에 명시 주입해 세션을 만든다.
5. account:create: 비밀번호 해시·계정 파일 형식은 `server-only` 없는 공용 모듈(`lib/account-store.ts` 등)로 빼서 accounts.ts와 스크립트가 함께 쓴다. 이미 있는 이메일이면 기본 거부, `--reset`일 때만 비밀번호 재설정(기존 세션 무효화).
6. 복구: render.lock·`*-wal`/`*-shm` 제외, processing 상태 렌더는 failed로 바꿔 복원, 덮어쓰기 전 현재 상태를 자동 백업. 서버 정지 확인은 health 무응답 + 사용자 확인 플래그(`--yes`). Docker는 `docker compose run --rm motion-studio npm run restore -- <폴더> --yes` 절차를 문서화. 백업은 호스트·컨테이너 모두 가능하게 하되 문서는 컨테이너 기준.
7. 인증 테스트는 `app/api/**/route.ts`의 모든 export 메서드를 자동 열거해 허용 목록 외 401 확인.
8. 로그인 시도 제한이 전역 2000건 초과 시 전체 차단되는 문제(accounts.ts:18): 전역 차단 대신 오래된 기록부터 버리고 이메일·전역 각각 제한(운영자 잠김 방지).
9. 과잉 제외: zip, 요청 ID 로그. health는 DB 쿼리 없이 데이터 폴더 쓰기 가능 여부·디스크 여유만. 오류 로그는 한 줄 JSON(시각·경로·상태)만.
10. Dockerfile에 비root 사용자(USER node) 적용, 볼륨 권한 문서화.
11. (리뷰 반영) 로그인 제한: 계정 파일이 있는 이메일은 이메일별 제한만, 없는 이메일만 전역 제한에 집계·적용(없는 이메일 300회 후에도 실제 계정 로그인 성공).
12. (리뷰 반영) 처리 안 된 서버 오류: 루트 `instrumentation.ts`가 `lib/server/error-log.ts`의 `onRequestError`를 export → 한 줄 JSON(시각·경로·상태 500, 쿼리·오류 문구 제외).
13. (리뷰 반영) `next.config.ts` `images.localPatterns`를 `/photos/**`·`/models/**`·`/templates/**`(쿼리 없음)로 한정해 `/_next/image`가 `/api/media`를 가져오지 못하게 함.
