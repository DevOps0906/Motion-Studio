import {AbsoluteFill,Audio,Sequence,staticFile,useCurrentFrame,useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {PhotoWall} from '../components/PhotoWall';
import {BrandOverlay} from '../components/BrandOverlay';
import {DEFAULT_PROJECT,type Project,type MediaAsset} from '../lib/model';
import {audioVolume} from '../lib/motion';
export type IntroProps={project:Project;media:MediaAsset[]};
export function Intro({project=DEFAULT_PROJECT,media=[]}:Partial<IntroProps>){const frame=useCurrentFrame(),{fps,width,height}=useVideoConfig();const time=frame/fps;const urls=project.photos.length?project.photos.map(id=>media.find(m=>m.id===id)?.url).filter((u):u is string=>Boolean(u)):Array.from({length:36},(_,i)=>staticFile(`photos/${String(i+1).padStart(2,'0')}.jpg`));const logo=media.find(m=>m.id===project.brand.logoAssetId)?.url,track=media.find(m=>m.id===project.audio.assetId)?.url;const startFrame=Math.round(project.audio.startSeconds*fps);
 return <AbsoluteFill style={{backgroundColor:project.background,containerType:'inline-size'}}><ThreeCanvas width={width} height={height} camera={{position:[0,0,16],fov:52}}><PhotoWall progress={time/project.durationSeconds} project={project} photoUrls={urls}/></ThreeCanvas><BrandOverlay project={project} time={time} logoUrl={logo} rendering/>{track&&startFrame<Math.round(project.durationSeconds*fps)&&<Sequence from={startFrame}><Audio src={track} trimBefore={Math.round(project.audio.trimStartSeconds*fps)} volume={f=>audioVolume((f+startFrame)/fps,project.durationSeconds,project.audio)}/></Sequence>}</AbsoluteFill>;
}

