import 'server-only';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {zipSync,strToU8} from 'fflate';
import {getOwnedJob,renderDir} from './render';
import type {Actor} from './owner';
import {readJson,validId} from './store';
import type {Project,MediaAsset} from '../model';
const extensions:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','audio/mpeg':'mp3','audio/wav':'wav','video/mp4':'mp4','video/webm':'webm'};
export async function buildCapCutPackage(id:string,actor:Actor){
  const job=await getOwnedJob(id,actor,'view');
  if(job.status!=='completed')throw new Error('완료된 렌더 작업에서 내보내 주세요.');
  const dir=renderDir(job.id),files:Record<string,Uint8Array>={};
  const input=await readJson<{project:Project;media:MediaAsset[]}>(path.join(dir,'input.json'));
  let total=0;
  async function add(name:string,file:string){const stat=await fs.stat(file);total+=stat.size;if(total>256*1024**2)throw new Error('패키지가 256MiB를 초과합니다. MP4와 미디어를 개별 다운로드해 주세요.');files[name]=await fs.readFile(file);}
  await add('video/intro.mp4',path.join(dir,'output.mp4'));
  const assets:{id:string;name:string;file:string;type:string}[]=[];
  for(const [index,asset]of input.media.entries()){
    if(!validId(asset.id)||!extensions[asset.mimeType])throw new Error('지원하지 않는 미디어가 포함되어 있습니다.');
    const name=asset.id===input.project.brand.logoAssetId?'logo':asset.id===input.project.audio.assetId?'music':`photo-${String(index+1).padStart(2,'0')}`;
    const file=`media/${name}.${extensions[asset.mimeType]}`;
    await add(file,path.join(dir,'assets',asset.id));assets.push({id:asset.id,name:asset.name,file,type:asset.type});
  }
  files['motion-studio.json']=strToU8(JSON.stringify({format:'motion-studio-media-package',version:1,capcutNativeProject:false,project:input.project,assets},null,2));
  files['CAPCUT-가져오기.txt']=strToU8(`Motion Studio → CapCut\n\n1. ZIP을 먼저 압축 해제합니다. ZIP 자체는 CapCut 프로젝트 파일이 아닙니다.\n2. CapCut에서 새 프로젝트 → 가져오기(Import) → video/intro.mp4를 선택합니다.\n3. 이미지를 다시 편집하려면 media 폴더의 사진·로고·음악도 가져옵니다.\n\nMP4에는 ${input.project.template} 모션이 합성되어 있습니다. 모션·브랜드·오디오는 하나의 영상이며 CapCut의 개별 트랙으로 자동 복원되지 않습니다.\n원본 파일은 별도 재편집용이며 motion-studio.json은 Motion Studio 설정 기록입니다. CapCut 네이티브 프로젝트가 아닙니다.\n출력: ${input.project.resolution.width}×${input.project.resolution.height}, ${input.project.fps}fps, ${input.project.durationSeconds}초.\n`);
  return zipSync(files,{level:0});
}
