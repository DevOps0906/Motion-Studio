# task-008 계정별 자료 분리 — 계획 초안

- 위험도 높음(인증·권한·데이터 이전·백업 형식 변경) → 착수 전 challenger, 변경 후 codex-reviewer(code)+reviewer(security).
- 상태: 초안. 7장 열린 결정이 풀리기 전에는 구현하지 않는다.
- 근거: `tasks/task-005.md`(1·2·8장), 아래 현황의 코드 경로.

## 1. 현황
- 저장 위치: 모두 `.local-data` 아래 `lib/server/store.ts:13`(`DATA`).

| 자료 | 저장 | 코드 | 소유자 |
|---|---|---|---|
| 프로젝트 | `projects/<id>.json` | `store.ts:55` | 없음 |
| 미디어 | `media/<id>.json` + `files/<id>` | `store.ts:19-36` | 없음 |
| 웹사이트 | `websites/<id>.json` | `websites.ts:7`, `store.ts:57` | 없음 |
| 블로그 스킨 | `blog-skins/` | `blog-skins.ts:9` | 없음 |
| CAD 모델 | `models/` | `cad-models.ts:8` | 없음 |
| 렌더 | `renders/`, `render-files/`, `render.lock` | `render.ts:8-11` | 없음 |
| 문의 | SQLite `inquiries`(`websiteId` 열 있음) | `inquiries.ts:12` | 웹사이트로만 연결 |
| 고객 요구사항 | SQLite `submissions` | `website-requirements.ts:11` | 없음(공개 폼 접수) |
| 계정·세션 | `accounts/users/<해시>.json`, `sessions/` | `lib/account-store.ts:10-13` | 이메일 기준 |

- 세션은 `{name,email}`만 돌려준다(`account-store.ts:45`). 자료에는 소유자 필드가 없어 로그인한 누구나 전부 읽고 쓴다.
- 현재 계정은 운영자 중심(task-005 8장: production 가입 닫힘, `account:create`로만 생성).
- 인증 경계: `proxy.ts`(쿠키 검사) + `lib/access-policy.ts`(공개 허용 목록) + `page-session.ts` `requirePageAccount()`(페이지 재확인). API는 `app/api/**/route.ts` 34개, 소유 확인 없음.
- 공개 판정: `GET /api/media/:id`는 어떤 웹사이트 대표 이미지면 공개(`access-policy.ts:34`, 전체 웹사이트 JSON 스캔). `/websites/[id]` 미리보기는 공개.

## 2. 목표·범위
- 목표: 계정마다 자기 프로젝트·웹사이트·미디어·블로그 스킨·모델·렌더·문의를 따로 본다. 남의 자료는 존재 자체를 알 수 없다.

| 범위 | 범위 밖 |
|---|---|
| 소유자 필드, 소유자 검증 공통 도우미 | 팀·공유·초대, 역할 세분화 |
| 목록·단건·변경·삭제·다운로드 API 전체 | 계정별 용량 제한(할당량) |
| 기존 자료의 운영자 계정 이전 | 가입 개방(production 가입은 닫힌 채) |
| 백업·복구 형식 호환 | 계정 삭제 시 자료 정리 UI |
| 공개 미리보기·공개 이미지 판정 정리 | DB 엔진 교체(SQLite 유지) |

## 3. 데이터 모델
- 소유자 키: 이메일 대신 불변 `ownerId`(계정 생성 시 발급한 UUID). 이메일 변경·재생성에도 자료 유지. 계정 파일(`Account`)에 `id` 추가.
- 세션: `readSession` 반환에 `id`(=ownerId) 포함. 기존 세션은 `id` 없음 → 첫 요청에서 계정 파일 조회로 보충하거나 재로그인(7장 결정).
- 자료별 소유자 필드:

| 자료 | 방식 |
|---|---|
| 프로젝트·미디어·웹사이트·블로그 스킨·모델·렌더 JSON | 최상위 `ownerId` 필드 추가(파일 위치 유지) |
| 문의 | `inquiries.ownerId` 열 추가. 접수 때 `websiteId`로 웹사이트 소유자를 복사 |
| 고객 요구사항 `submissions` | 공개 폼이라 소유자 없음 → 운영자 전용 유지(7장) |

- 파일 위치는 그대로 두고 필드만 추가하는 방식 vs `.local-data/accounts/<ownerId>/…` 하위 분리: 필드 방식 권장(이전·백업 단순). 단 목록은 전체 스캔 후 필터라 규모가 커지면 느림 → 지금 규모에서는 허용(미확인: 현재 자료 수, 측정 필요).
- 기존 데이터 이전: `ownerId` 없는 자료는 **운영자(첫 계정)** 소유로 일괄 지정하는 스크립트 `npm run migrate:owner -- --owner <email>`(백업 선행 필수, 멱등, `--dry-run`). 이전 전 구동 시 소유자 없는 자료는 운영자만 접근.
- 샘플 자료(`source-*` 미디어, `public/` 템플릿·모델)는 소유자 없는 공용 읽기 전용.

## 4. API·페이지 권한 규칙
- 공통 도우미 `requireOwner(request, kind, id)` 신설(`server-only`). 세션 `id`와 자료 `ownerId`를 비교한다.
- 규칙:

| 상황 | 응답 |
|---|---|
| 미로그인 | 401 JSON(기존) |
| 남의 자료 단건 조회·수정·삭제·다운로드 | **404**(존재 노출 금지, 없는 ID와 동일 본문·시간) |
| 목록 | 본인 자료만 |
| 생성 | `ownerId`는 서버가 세션에서 채움(클라이언트 입력 무시) |
| 참조(프로젝트 → 미디어·로고·오디오, 웹사이트 → 이미지, 렌더 → 프로젝트) | 참조 대상도 같은 소유자인지 검증(`validateReferences`, `store.ts:38` 확장) |
| 운영자 | 일반 계정과 동일(남의 자료 못 봄). 운영자 전체 열람은 7장 결정 |

- 대상 라우트: `projects`, `media`(+`crop`,`prepare`), `models`(+`asset`), `renders`(+`cancel`,`capcut`,`download`,`assets`), `websites`(+`draft`,`export`), `blog-skins`(+`export`,`generate`,`preview`), `content-projects`, `inquiries`(+`unread`,`[id]`), `integrations/capcut/launch`, `create-intro`. 공개 유지: `auth`, `health`, `inquiries POST`, `website-requirements POST`, `templates`, `website-references`(자료 아님, 확인 필요).
- 페이지: 서버 컴포넌트가 직접 읽는 페이지(`/websites/editor`, `/websites/inquiries`, 프로젝트·렌더 화면 등)도 `requirePageAccount()`에 소유자 검증을 붙인다. 남의 ID는 `notFound()`.
- 안 읽은 문의 배지·집계는 본인 소유 문의만 센다.
- 렌더 큐(`render.lock`)는 전역 1건 직렬 유지. 남의 렌더 취소 불가. 대기 순서·타 계정 렌더 노출은 7장.

## 5. 공개 미리보기·공개 이미지 판정
- `/websites/[id]`: 공개 유지(task-005 8장). 소유자 검사 없이 ID로 렌더하되, 소유자 정보·계정 이메일은 응답에 넣지 않는다.
- `GET /api/media/:id` 공개 판정은 현재 "어떤 웹사이트든 대표 이미지면 공개"(`access-policy.ts:34`). 소유자 분리 후에도 판정 기준은 유지하되 다음을 지킨다.
  - 공개 허용은 **그 웹사이트의 소유자와 같은 소유자의 미디어**일 때만(타인 미디어 ID를 내 웹사이트에 넣어 공개 노출시키는 우회 방지 → 저장 시 참조 소유자 검증으로 차단).
  - 미공개 웹사이트(초안)를 공개 여부 플래그로 구분할지는 7장.
- 문의 접수(`POST /api/inquiries`): 공개 유지. 대상 `websiteId`가 존재할 때만 접수하고 소유자 문의함으로 귀속. 없는 ID는 기존과 같은 거부.
- proxy는 Node API 제약으로 쿠키 존재만 확인하므로(task-005 8장 2항) 소유자 비교는 라우트·서버 컴포넌트의 공통 도우미에서만 한다.

## 6. 이전·백업/복구 영향
- 배포 순서: ① 백업(`npm run backup`) → ② 코드 배포(소유자 없는 자료는 운영자만 접근) → ③ `migrate:owner --dry-run` 확인 → ④ 실제 실행 → ⑤ 검증 쿼리(소유자 없는 자료 0건).
- 롤백: 이전 스크립트는 필드 추가만 하므로 구버전 코드는 필드를 무시. 문제 시 ①의 백업 폴더로 `restore`.
- 백업(`npm run backup`)은 파일 위치를 바꾸지 않아 형식 호환. SQLite `ALTER TABLE` 후 구 백업을 복원하면 `ownerId` 열이 없음 → 복구 스크립트 끝에 "마이그레이션 보정 단계"(열 추가·소유자 없는 자료 운영자 지정) 실행.
- 계정 파일에 `id` 추가: 기존 계정은 첫 구동 시 `id` 발급 후 저장(멱등). 백업에 계정 폴더가 포함되는지 확인 필요(미확인, `scripts/` 백업 구현 확인).
- `account:create`는 `id`를 발급. `--reset`은 `id` 유지(자료 유지).
- Docker: 볼륨 구조 변경 없음. 이전 스크립트는 `docker compose run --rm motion-studio npm run migrate:owner -- …`로 문서화.

## 7. 위험·열린 결정
- 위험:
  - 라우트 하나라도 소유 검사를 빠뜨리면 남의 자료 노출 → 라우트 자동 열거 테스트로 방지.
  - 참조 경로(렌더가 프로젝트·미디어를 읽음, export, CapCut)에서 소유 검사 누락.
  - 이전 중 쓰기 충돌 → 서버 정지 상태에서만 실행.
  - 응답 시간·문구 차이로 남의 ID 존재 추정(404 동일화).
  - 기존 세션에 `id` 없음.
- 사용자에게 물을 것(팀장 결정 필요):
  1. 소유자 키를 `ownerId`(UUID)로 할지, 이메일로 단순화할지.
  2. 기존 자료는 모두 운영자 계정 소유로 이전해도 되는지(QA 자료는 삭제 후 이전).
  3. 운영자가 다른 계정 자료를 열람·삭제할 수 있어야 하는지(지원용). 필요하면 별도 감사 로그.
  4. 고객 요구사항 접수(`submissions`)는 운영자 전용으로 둘지, 계정별 분배가 있는지.
  5. 미리보기 `/websites/[id]`는 지금처럼 ID만 알면 공개인지, "공개 플래그"가 있는 것만 공개할지.
  6. 계정이 여러 개가 되는 시점(가입 개방 여부·계정 수). 개방 안 하면 이 작업의 우선순위 자체를 재검토.
  7. 렌더 큐: 계정 간 공유 1건 직렬 유지 vs 계정별 동시 제한. 타 계정 대기 상태 노출 여부.
  8. 샘플·공용 자료(`source-*`, 템플릿)는 공용 읽기 전용이면 되는지.
  9. 계정 삭제 시 자료를 지울지 보관할지(범위 밖이나 정책만 결정).
- 수익·사업 관점: 수익 모델·검증 방법·정부지원 연결은 `미확인`(근거 필요). 다계정 SaaS 판매를 전제하면 가입 개방·결제와 함께 별도 기획.

## 8. 완료 조건
- `npm run typecheck`, `npm test`, `npm run build` 통과.
- 테스트(계정 A·B 세션 2개를 테스트 환경에 명시 주입):
  - 자료별 목록에 상대 자료가 없다.
  - 상대 자료 ID로 GET·PATCH·DELETE·다운로드·취소·export → 404(없는 ID와 본문 동일).
  - 생성 요청에 `ownerId`를 넣어도 무시되고 세션 계정 소유가 된다.
  - 남의 미디어/프로젝트를 참조해 저장하면 거부.
  - `app/api/**/route.ts`의 모든 export 메서드를 자동 열거해 소유 검사 또는 공개 허용 목록 명시 여부 확인.
  - 서버 컴포넌트 페이지가 남의 ID에서 `notFound()`.
  - 공개: `/websites/[id]` 비로그인 200, 문의 접수 → 소유자 문의함에만 노출·안 읽은 배지 본인 건만, 남의 미디어는 공개 이미지로 열리지 않음.
  - `migrate:owner`: `--dry-run` 무변경, 실행 후 소유자 없는 자료 0건, 재실행 멱등.
  - 구 형식 백업 복원 후 보정 단계로 정상 구동.
  - 기존 세션(`id` 없음) 처리.
- 수동(팀장): Docker에서 계정 2개로 위 시나리오 1회, 백업→이전→복원 리허설.

## 9. 사용자·팀장 결정 (2026-11-02, 7장 열린 결정보다 우선)
- 사용자: 다계정은 **곧**(팀원·고객 계정, account:create로 생성) → W4 우선 구현. 운영자는 다른 계정 자료 **보기·삭제 가능, 감사 로그 한 줄 기록**. `/websites/[id]` 미리보기는 **지금처럼 ID만 알면 공개**. 계정 삭제 시 자료는 **운영자에게 이전**.
- 팀장: 소유자 키는 `ownerId`(UUID, 이메일 변경에 안전). 기존 자료는 모두 운영자 소유로 이전(QA 자료는 이미 삭제됨). 고객 요구사항 접수함은 운영자 전용 유지. 렌더 큐는 전역 직렬 유지, 남의 대기 항목은 개수만 노출. 샘플·공용 자료는 공용 읽기 전용.

## 10. challenger REVISE 반영 (2026-11-02, 팀장 결정 — 이 장이 1~9장보다 우선)
1. 문의 DB: `inquiries.ts` INSERT는 열 이름을 명시한다. `ownerId` 열은 `db()` 초기화에서 없을 때만 `ADD COLUMN`(멱등, 구 백업 복원도 자동 보정). "구버전 코드는 새 필드를 무시" 문구는 SQLite에는 해당하지 않으므로 롤백 절에서 고친다(롤백 = 백업 복원).
2. ownerId 발급: 서버를 멈춘 상태의 `migrate`와 `account:create`에서만 발급한다(런타임 보충 금지). `readSession`은 세션 파일에 저장된 id만 돌려준다. migrate 끝에 세션을 모두 폐기해 다시 로그인하게 한다. `writeAccount(overwrite)`는 기존 id를 보존한다.
3. 미디어 접근: `GET /api/media/:id` 허용 = 본인 소유 OR source-* OR (그 미디어 소유자의 웹사이트에서 공개 대상인 대표·갤러리 이미지). 이 판정은 세션 유무와 상관없이 라우트에서 같은 함수로 한다(proxy가 세션 있다고 건너뛰지 않음). 테스트: B 세션으로 A의 미리보기 이미지 200, A의 비공개 미디어 404.
4. 운영자 = `REQUIREMENTS_ADMIN_EMAILS`에 든 이메일만(`requireAdminList:true`, localhost 예외 없음). `migrate --owner <email>`은 그 목록에 있는지 검증한다.
5. 문의 API 3개(목록·안 읽음·상세)와 문의함 페이지의 관문을 "운영자만"에서 "본인 소유 웹사이트의 문의 + 운영자는 전체(감사 기록)"로 바꾼다.
6. 남의 자료·없는 자료는 모두 공통 도우미 하나로 고정 404 `{error:'찾을 수 없습니다.'}`를 돌려준다(ENOENT 원문·경로 노출 금지, DELETE media 400도 404로 통일). "동일 응답 시간" 요구는 삭제한다.
7. 참조 소유 검사 위치: `store.ts:38`, `websites.ts:22-24`, `blog-skins.ts:13·37`, media crop의 `sourceAssetId`. 모두 "본인 소유 미디어(또는 source-*)"로 제한한다.
8. 배포 순서: ① 백업(accounts 포함, backup.cjs는 전체 복사) → ② 서버 정지 → ③ 코드 교체 → ④ `migrate --dry-run` → ⑤ `migrate`(health가 응답하면 거부, restore.cjs와 같은 방식) → ⑥ 기동. 파일 단위 rename과 "ownerId 없는 것만 채움"이라 중간에 실패해도 재실행하면 끝난다. 6장의 미확인 항목은 해소된 것으로 본다.
9. 감사 로그: `.local-data/audit.log`(백업에 포함), 한 줄 JSON = 시각·운영자 ownerId·동작(view/delete)·종류·대상 id·대상 ownerId. 이메일·이름·문의 본문·IP는 넣지 않는다. 남의 자료일 때만 기록한다. 운영자는 목록 API의 `?owner=all` 파라미터로 남의 자료를 고르고, 기본값은 본인 것만이다.
10. 계정 삭제 CLI `npm run account:delete -- <email> --yes`: 세션 폐기 → JSON·문의 ownerId를 운영자에게 이전(멱등) → 계정 파일 삭제(맨 마지막). 실패하면 재실행으로 끝낸다. 운영자 자신은 삭제를 거부한다.
11. 렌더 자산(`/api/renders/:id/assets/:assetId`, 렌더러가 쿠키 없이 가져옴): 렌더 생성 때 무작위 `assetToken`을 렌더 기록에 저장하고 URL에 붙인다. 허용 = 토큰 일치 OR 소유자 세션. 그 밖의 경우는 404.
12. 권한 테스트는 **동적**으로 한다: `app/api/**/route.ts`의 export 메서드를 자동 열거하고, B 세션으로 A의 실제 id를 넣어 호출해 404(또는 목록에서 제외)를 확인한다. 정적 grep으로 대체하지 않는다.
