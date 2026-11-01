# 운영 준비 1단계 — 인증·계정·백업·복구·모니터링 (task-005)

## 1. 접근 규칙
- `proxy.ts`(Next.js 16 proxy, Node.js 런타임)가 모든 요청에서 세션 파일을 확인합니다. 규칙 정본은 `lib/access-policy.ts`입니다.
- 로그인 없이 허용하는 API(정확한 경로·메서드, HEAD는 GET과 같음): `GET/POST/DELETE /api/auth`, `POST /api/inquiries`, `POST /api/website-requirements`, `GET /api/health`.
- `GET /api/media/:id`는 저장된 웹사이트의 홈·페이지 대표 이미지로 쓰이는 사진일 때만 로그인 없이 허용합니다. 목록 `GET /api/media`와 그 외 메서드는 로그인 필요입니다.
- 그 밖의 API는 로그인 없으면 `401 {"error":"로그인이 필요합니다."}`. 다른 사이트에서 보낸 변경 요청은 기존대로 403입니다.
- 공개 페이지: `/login`, `/website-requirements`, `/websites/[id]`(저장된 미리보기·문의 폼), 정적 파일(`/_next`, `public/`, `/icon.svg`). 나머지 페이지는 `/login`으로 이동합니다. 데이터를 서버에서 직접 읽는 페이지는 `lib/server/page-session.ts`의 `requirePageAccount()`로 세션을 다시 확인합니다.

## 2. 운영자·계정
| 변수 | 의미 |
|---|---|
| `REQUIREMENTS_ADMIN_EMAILS` | 운영자 이메일(쉼표 구분). production에서 비우면 운영자가 없습니다(Host 판정 안 함). 개발 모드에서 비우면 localhost 접속만 운영자 |
| `SIGNUP_ENABLED` | `true`일 때만 화면 가입 허용. 비우면 production은 닫힘, 개발은 열림 |

운영자 계정은 서버에서만 만듭니다(비밀번호는 화면에 표시되지 않게 입력).

```bash
npm run account:create -- owner@example.com --name 운영자
npm run account:create -- owner@example.com --reset   # 비밀번호 재설정 + 그 계정의 기존 로그인 종료
# Docker
docker compose exec motion-studio npm run account:create -- owner@example.com
```
이미 있는 이메일은 `--reset` 없이는 거부합니다. 만든 이메일을 `REQUIREMENTS_ADMIN_EMAILS`에 넣고 다시 시작해야 운영자 권한이 적용됩니다.

## 3. 백업
- `npm run backup` → `backups/<UTC 시각>/` 폴더(권한 0700). SQLite는 `VACUUM INTO`로 서버 실행 중에도 일관되게 복사하고, `*-wal`·`*-shm`·`render.lock`은 제외합니다.
- 보관: 최근 `BACKUP_KEEP`개(기본 14) 그리고 총 `BACKUP_MAX_BYTES`(기본 5GB) 중 먼저 걸리는 쪽까지. 가장 최근 백업 1개는 항상 남깁니다. 저장 위치는 `BACKUP_DIR`(기본 `backups`).
- `backups/`는 git·Docker 이미지에서 제외됩니다. 개인정보(문의·접수)가 들어 있으므로 외부로 옮길 때 암호화된 저장소를 씁니다.

Docker(문서 기준 실행 방식):
```bash
docker compose exec motion-studio npm run backup
```
호스트 cron 예시(매일 03:30):
```cron
30 3 * * * cd /srv/motion-studio && docker compose exec -T motion-studio npm run backup >> backups/backup.log 2>&1
```
Windows 작업 스케줄러: 동작 `powershell.exe`, 인수 `-NoProfile -Command "cd D:\path\Motion-Studio; docker compose exec -T motion-studio npm run backup"`, 매일 반복.

## 4. 복구
1. 서버를 멈춥니다(로컬: 서버 종료 / Docker: `docker compose stop motion-studio`).
2. 복원합니다. 복원 직전 현재 데이터를 `<시각>-pre-restore` 백업으로 자동 저장합니다.
   ```bash
   npm run restore -- backups/20261101-033000 --yes
   # Docker: 멈춘 서비스와 같은 네트워크에서 health를 확인하도록 주소 지정
   docker compose run --rm -e MOTION_STUDIO_URL=http://motion-studio:3000 motion-studio npm run restore -- backups/20261101-033000 --yes
   ```
3. 다시 시작합니다(`docker compose start motion-studio`).
- `--yes`가 없거나 `MOTION_STUDIO_URL`(기본 `http://127.0.0.1:$PORT` 또는 3000)의 `/api/health`가 응답하면 중단합니다.
- 복원 시 `render.lock`·`*-wal`·`*-shm`은 가져오지 않고, 대기·처리 중이던 렌더는 실패로 바꿉니다.

## 5. 모니터링
- `GET /api/health`: 데이터 폴더 쓰기 가능 + 디스크 여유 `HEALTH_MIN_FREE_MB`(기본 1024) 이상이면 `200 {"status":"ok"}`, 아니면 `503 {"status":"unavailable"}`. DB 쿼리·경로·버전은 응답하지 않습니다. Docker HEALTHCHECK가 이 주소를 씁니다.
- 서버 오류는 표준 출력에 한 줄 JSON(`time`·`level`·`path`·`status`)으로 남깁니다(`lib/server/error-log.ts`). 요청 본문·쿼리·헤더·오류 메시지는 넣지 않습니다.

## 6. Docker 비root 실행
- 컨테이너는 `node` 사용자(uid/gid 1000)로 실행됩니다. 호스트 폴더 `.local-data`, `out`, `backups`는 uid 1000이 쓸 수 있어야 합니다.
  ```bash
  mkdir -p .local-data out backups && sudo chown -R 1000:1000 .local-data out backups && chmod 700 backups
  ```
  Docker Desktop(Windows·macOS)은 바인드 마운트 권한을 자동으로 맞추므로 보통 추가 작업이 필요 없습니다.
- HTTPS용 Caddy는 `compose.yaml`에 주석 예시만 있습니다(도메인 확정 후 2단계).

## 7. 검증 스크립트
- `npm test`의 `scripts/test-operations.cjs`가 모든 `app/api/**/route.ts` 메서드를 자동으로 찾아 미인증 401을 확인합니다.
- `scripts/verify-*.cjs`(실서버 검증)는 `scripts/verify-session.cjs`가 세션을 붙입니다. 검증 서버는 `SIGNUP_ENABLED=true`로 실행하거나 `VERIFY_EMAIL`·`VERIFY_PASSWORD`로 기존 계정을 지정합니다. 운영자 화면 검증에는 `REQUIREMENTS_ADMIN_EMAILS`도 지정합니다.
