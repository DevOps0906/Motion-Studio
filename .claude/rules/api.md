---
paths:
  - "app/api/**"
---
# API 영역 규칙 (app/api/** 작업 때만 로드)
- Route Handler는 입력을 검증하고, 사용자 데이터는 `.local-data/` 저장 계층을 통해서만 읽고 쓴다. 외부 API 키는 서버에서만 쓰고 응답·로그에 싣지 않는다.
- 응답 형식이 바뀌면 호출하는 화면·타입과 `npm test`의 계약 검사를 같은 작업에서 맞춘다.
- 인증·권한·파일 업로드·외부 호출을 바꾸면 `security-baseline`을 따르고 codex-reviewer(code)를 거친다.
