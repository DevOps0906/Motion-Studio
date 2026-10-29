# 건축 씬 그래프 — 초안

상태: 계획 스키마. 기존 포토월 씬과 별도의 건축 씬이다.

```text
ArchitecturalProject
└─ Site
   └─ Building
      ├─ Floor:01
      │  ├─ Structure / Slab
      │  ├─ Facade / Openings
      │  └─ Interior / Exhibits
      ├─ Floor:02
      ├─ Floor:03
      └─ Shared:Roof / Circulation / Equipment
```

Node: objectId, sourceObjectId, parentId, buildingId, floorId?, category, displayName, sourceRevision, transform, bounds, materialIds, selectable, metadata.

objectId는 앱 식별자다. GLB 노드 이름·엔진 객체 이름과 분리하고 manifest 매핑으로 연결한다. 이름 변경·층 숨김·최적화 후에도 선택 이벤트가 원본 객체를 찾을 수 있어야 한다.

공유 요소는 여러 Floor의 자식으로 중복 삽입하지 않는다. 하나의 원본 노드와 층 참조 목록을 사용한다. 분해 보기는 원본 transform을 보존한 표시 오프셋이며 CAD 좌표를 변경하지 않는다.

검사: 순환 parent 참조 0개, ID 중복 0개, 누락된 재질·파일 참조 0개, 층 수와 manifest 일치. 파생 엔진마다 원본 ID→런타임 ID 매핑을 저장한다.
