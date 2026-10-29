# 로컬 제작 도구와 CapCut 내보내기

Motion Studio의 로컬 스튜디오는 직접 만든 템플릿 기반 웹 제작·편집 화면이다. R3F/GSAP 미리보기와 Remotion/FFmpeg 렌더를 사용하며 CapCut을 내부 엔진으로 호출하지 않는다.

## 지원하는 전달 경로

- 완료된 H.264/yuv420p MP4 다운로드: CapCut의 새 프로젝트 → 가져오기에서 선택한다. 음악이 있으면 AAC가 포함된다.
- 미디어 ZIP: `video/intro.mp4`, `media/`의 사진·로고·음악, Motion Studio 설정 JSON, 가져오기 안내를 포함한다. ZIP은 압축 해제 후 사용한다.
- 패키지는 작업 제출 당시의 이미지·설정 사본으로 생성한다. 현재 편집 내용과 완료된 렌더의 스냅샷을 섞지 않는다.
- ZIP 자체나 `motion-studio.json`은 CapCut 네이티브 프로젝트가 아니다. 합성된 모션을 개별 CapCut 키프레임·트랙으로 자동 복원하지 않는다. 원본 음악을 다시 추가하면 MP4에 포함된 오디오와 중복되지 않도록 조정한다.
- 웹페이지가 로컬 CapCut 앱을 자동 실행하거나 파일을 몰래 업로드하지 않는다. 사용자가 파일을 가져온다. 패키지 합계는 메모리 보호를 위해 256MiB 이하로 제한한다.

공식 자료 확인일: 2026-10-30. [CapCut MP4/JPG 가져오기 안내](https://www.capcut.com/help/can-not-import-mp4-and-jpg-files), [공식 가져오기 흐름](https://www.capcut.com/tools/online-video-converter?template_scene=1). 확인한 문서에는 외부 편집기용 공개 프로젝트 교환 계약을 찾지 못했다. 지원 범위는 실제 MP4·일반 미디어 가져오기이며, CapCut 버전별 실제 재생은 사용 환경에서 확인한다.
