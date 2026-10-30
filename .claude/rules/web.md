---
paths:
  - "app/**"
  - "components/**"
  - "lib/**"
---
# 웹 영역 규칙 (app·components·lib 작업 때만 로드)
- 먼저 `~/.claude/skills/stack-nextjs/SKILL.md`를 읽고, 이 저장소는 Next.js 변경이 있으니 `node_modules/next/dist/docs/`의 해당 안내도 확인한다(AGENTS.md).
- 화면은 `docs/design/DESIGN.md`를 따른다. 반응형 3구간(~767 / 768~1199 / 1200~)과 구간별 폰트 크기를 지킨다.
- 상태(빈·로딩·오류·성공)를 모두 구현하고, 화면 변경은 `shot <URL>`로 3구간을 확인한다.
- 완료 전 `npm run typecheck` · `npm test` · `npm run build`를 `q`로 실행한다.
