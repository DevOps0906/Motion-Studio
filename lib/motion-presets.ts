// Independently implemented motion families; sources are in MOTION_BENCHMARK.md.
export const motionPresets = [
  {id:'mosaic',name:'모자이크 줌',description:'가까운 사진에서 전체 사진월로',number:'01',family:'줌'},
  {id:'diagonal',name:'대각 패닝',description:'사진 사이를 따라 흐르는 카메라',number:'02',family:'패닝'},
  {id:'reveal',name:'로고 리빌',description:'사진월에서 브랜드 엔딩으로',number:'03',family:'브랜드'},
  {id:'ken-burns',name:'켄 번즈',description:'사진을 천천히 확대하는 다큐멘터리 스타일',number:'04',family:'시네마틱'},
  {id:'horizontal-slide',name:'수평 슬라이드',description:'좌우로 흐르는 사진 스트립',number:'05',family:'슬라이드'},
  {id:'vertical-rise',name:'버티컬 라이즈',description:'아래에서 위로 올라오는 사진 구성',number:'06',family:'슬라이드'},
  {id:'orbit',name:'패럴랙스 아크',description:'깊이를 달리한 사진 주위를 도는 카메라',number:'07',family:'공간'},
  {id:'stomp',name:'리듬 스톰프',description:'단계적인 줌 펄스로 만드는 경쾌한 오프닝',number:'08',family:'리듬'},
  {id:'carousel',name:'포토 캐러셀',description:'사진 카드가 좌우로 순환하는 쇼케이스',number:'09',family:'카드'},
  {id:'stagger',name:'스태거 카드',description:'사진이 순차적으로 떠오르는 그리드',number:'10',family:'카드'},
  {id:'spiral',name:'스핀 줌',description:'회전하며 모인 사진이 전체 화면으로 전환',number:'11',family:'회전'},
  {id:'split',name:'스플릿 리빌',description:'좌우로 나뉜 사진들이 중앙으로 모이는 연출',number:'12',family:'분할'},
  {id:'flip',name:'플립 그리드',description:'카드가 차례로 뒤집히며 나타나는 오프닝',number:'13',family:'회전'},
] as const;
export type MotionPresetId = typeof motionPresets[number]['id'];
export const renderResolutions = [
  {id:'720p',label:'HD · 720p',width:1280,height:720},
  {id:'1080p',label:'Full HD · 1080p',width:1920,height:1080},
  {id:'1440p',label:'QHD · 1440p',width:2560,height:1440},
  {id:'2160p',label:'4K UHD · 2160p',width:3840,height:2160},
] as const;
export type RenderResolutionId = typeof renderResolutions[number]['id'];
