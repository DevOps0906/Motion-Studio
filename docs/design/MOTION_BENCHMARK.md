# 인트로 프리셋 벤치마크와 해상도

2026-10-30. 공개 템플릿 카탈로그와 제작 튜토리얼에서 반복적으로 나타나는 연출 계열을 참고했다. 다운로드·판매·사용량 순위는 확인하지 않았으므로 인기 순위로 표시하지 않는다. 외부 프로젝트·코드·유료 에셋을 복사하지 않고 자체 카메라·타일 수식으로 구현했다.

| 추가 프리셋 | 구현 | 참고 근거 |
| --- | --- | --- |
| 켄 번즈 | 느린 줌과 위치 이동 | [Motion Array Ken Burns 가이드](https://motionarray.com/learn/final-cut-pro/how-to-zoom-in-final-cut-pro-x/) |
| 수평 슬라이드 | 좌우 사진 스트립 패닝 | [Clean Carousel Slideshow](https://motionarray.com/after-effects-templates/clean-carousel-slideshow-4360364/) |
| 버티컬 라이즈 | 아래에서 위로 이동 | [Clean Carousel Slideshow](https://motionarray.com/after-effects-templates/clean-carousel-slideshow-4360364/) |
| 패럴랙스 아크 | 깊이가 다른 사진과 곡선 카메라 | [Photo Slideshow 가이드](https://motionarray.com/learn/final-cut-pro/how-to-make-a-photo-slideshow/) |
| 리듬 스톰프 | 단계적인 줌 펄스 | [Stomp Opener](https://motionarray.com/premiere-pro-templates/stomp-opener-126593/) |
| 포토 캐러셀 | 좌우 순환과 깊이 변화 | [Carousel Blackout](https://motionarray.com/after-effects-templates/carousel-blackout-slideshow-3654867/) |
| 스태거 카드 | 순차적인 카드 상승 | [모션·오프너 카탈로그](https://motionarray.com/browse/search/opener/) |
| 스핀 줌 | 회전하며 모인 사진의 줌아웃 | [Photo Slideshow 가이드](https://motionarray.com/learn/final-cut-pro/how-to-make-a-photo-slideshow/) |
| 스플릿 리빌 | 좌우 사진이 중앙으로 진입 | [Split Frame Opener](https://motionarray.com/after-effects-templates/split-frame-opener-3860928/) |
| 플립 그리드 | 사진 카드의 순차 회전 | [Multi Flip Opener](https://motionarray.com/after-effects-templates/multi-flip-opener-36511/) |

기존 모자이크 줌·대각 패닝·로고 리빌과 함께 총 13개다. `lib/motion-presets.ts`가 선택 목록의 기준이며 `lib/motion.ts`의 cameraPose·tileMotion을 웹 R3F와 Remotion에서 공유한다. 모션은 frame/fps에서 환산한 진행률로 계산하고 실시간 난수·누적 시간을 사용하지 않는다. 카드의 작은 애니메이션은 연출 도식이며 실제 결과는 편집기에서 확인한다. 모션 감소 환경에서는 카드 애니메이션을 생략한다.

## 렌더 해상도

720p(1280×720), 1080p(1920×1080), 1440p(2560×1440), 4K(3840×2160)를 지원한다. 비율은 모두 16:9이며 기존 프로젝트는 1080p 설정을 유지한다. 빠른 생성·새 프로젝트·편집기에서 선택하고, 프로젝트 설정 → 작업 스냅샷 → Remotion calculateMetadata → 실제 인코딩으로 전달한다. 4K는 원본의 세부 정보를 복원하지 않으며 렌더 시간·메모리 사용량이 증가한다.
