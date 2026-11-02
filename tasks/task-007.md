# task-007 갤러리 섹션·페이지별 후기/FAQ (명세 — challenger REVISE 반영, 4장이 1~3장보다 우선)

- 결정: 팀장, 2026-11-02. 위험도 높음(공개 미디어 노출 면 확대: `lib/access-policy.ts` 공개 이미지 판정) → 착수 전 challenger, 변경 후 reviewer(code)+reviewer(security).
- 근거: task-002 명세(tasks/task-002.md)의 섹션·호환성 규칙을 그대로 따른다.

## 1. 갤러리 섹션
- 섹션 id `gallery` 추가(기본 `enabled:false`, 기존 데이터 호환: `withAddedSections`로 숨김 추가). 이미지가 0장이면 렌더하지 않음(CTA 대상 아님).
- 데이터: 브리프 `gallery: {imageId: string; caption?: string}[]` 최대 12장, caption 최대 120자. 같은 imageId 중복 금지. 미디어 라이브러리 이미지에서 고른다.
- 출력: 미리보기(`components/WebsitePreview.tsx`)·저장 미리보기(`/websites/[id]`)·단일 HTML·ZIP(`lib/website-export.ts`)에 같은 순서로. 내보내기는 기존 대표 이미지처럼 data URL로 넣는다(형식 검증 동일). alt는 caption 또는 "<브랜드> 갤러리 이미지 n".
- 공개 접근: `lib/access-policy.ts`의 공개 이미지 판정에 "저장된 웹사이트의 **사용 중인(enabled) 갤러리** 이미지"를 추가. 홈·페이지 중 갤러리 섹션이 켜진 곳의 이미지만.

## 2. 페이지별 후기·FAQ·갤러리 문구
- `WebsitePageContent`에 `testimonials`·`faqs`·`gallery`(선택)를 더한다. 페이지 "상세 문구 별도 편집"이 켜져 있으면 페이지 값, 아니면 홈 값(`resolveWebsitePage`).
- 한도·필수 규칙은 홈과 같다(후기 6·FAQ 8·갤러리 12).

## 3. 완료 조건
- typecheck·test·build 통과. 테스트: 기존 데이터(섹션 3·5개) 호환, gallery 한도·중복·형식 오류, 출력 HTML 이스케이프, 페이지별 후기/FAQ 상속·대체, 공개 판정(켜진 갤러리 이미지만 공개·꺼진 섹션·다른 이미지는 401).

## 4. challenger REVISE 반영 (2026-11-02, 팀장 결정)
1. 섹션 수 호환: `ADDED_SECTION_IDS`에 `gallery` 추가, 홈·페이지 sections 길이 3·5·6 모두 허용(`lib/website.ts:131,171`). 테스트: 5섹션 저장 파일을 `getWebsite`와 목록 둘 다로 읽기.
2. 내보내기 크기: ZIP은 이미지를 `assets/<id>.<ext>` 파일로 **한 번만** 넣고 HTML은 상대 경로로 참조(페이지마다 data URL 반복 금지). 단일 HTML만 data URL. 내보내기 이미지 원본 합계 상한 60MB, 넘으면 400 "이미지 합계가 60MB를 넘어 내보낼 수 없습니다. 갤러리 이미지를 줄여 주세요."
3. 공개 판정: 공개 집합 = 홈과 각 페이지에서 gallery 섹션이 enabled일 때 `resolveWebsitePage` 규칙(`page.content?.gallery ?? 홈 gallery`)으로 해석한 imageId + 기존 대표 이미지. 판정은 화면과 같은 해석 함수를 공용 모듈에서 함께 쓴다. 테스트: 상속된 홈 갤러리 공개, 쓰지 않는 content.gallery·꺼진 섹션 이미지 401.
4. 페이지 content 호환: content에 `testimonials`·`faqs`·`gallery`·`testimonialsHeading`·`faqHeading` 키가 없으면 홈 값을 상속하고 키를 만들지 않는다(undefined·[] 채우기 금지). 테스트: 기존 content 페이지가 홈 후기·FAQ를 그대로 유지.
5. 빈 항목 제거(`dropEmptyReviewItems`)와 "모든 페이지가 공유합니다" 안내 문구(`WebsiteBuilder.tsx`)를 페이지 content에도 맞게 고친다.
6. 삭제된 미디어: 없는 갤러리 이미지는 미리보기·내보내기에서 건너뛴다(오류 아님). 대표 이미지 기존 동작은 유지.
7. 성능: 공개 판정에 메모리 캐시를 두지 않는다(끈 섹션·삭제 즉시 반영). 사이트 수가 적은 운영자 전용 단계라 전수 읽기는 수용한 위험.
8. 결정: 후기·FAQ 제목도 페이지별 편집 대상. 갤러리는 CTA 이동 대상이 아니다(CTA는 지금처럼 문의 섹션).
9. (보안 리뷰 반영) 대표 이미지 공개 판정은 기존처럼 원본 JSON을 비교하고, 갤러리는 검증한 뒤 해석합니다(검증에 실패하면 닫힘). 대표 이미지만 "화면과 같은 규칙"의 예외입니다. 미인증 `/api/media/:id`와 `/websites/[id]` 요청이 올 때마다 사이트·미디어 전체를 읽는 비용은 7항에 따라 감수하기로 한 위험입니다. 계정 분리(task-008) 이후 사이트 수가 늘면 mtime 기준 캐시나 요청 수 제한을 다시 검토합니다.
