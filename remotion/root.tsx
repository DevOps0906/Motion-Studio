import {Composition} from 'remotion';
import {Intro} from './Intro';
import {Walkthrough3D} from './Walkthrough3D';
import {DEFAULT_PROJECT,type Project} from '../lib/model';
const metadata=({props}:{props:{project?:unknown}})=>{const p=props.project as Project;return {durationInFrames:Math.round(p.durationSeconds*p.fps),fps:p.fps,width:p.resolution.width,height:p.resolution.height};};
export function RemotionRoot(){return <><Composition id="PhotoWallIntro" component={Intro} width={1920} height={1080} fps={30} durationInFrames={450} defaultProps={{project:DEFAULT_PROJECT,media:[]}} calculateMetadata={({props})=>{const p=props.project as Project;return {durationInFrames:Math.round(p.durationSeconds*p.fps),fps:p.fps,width:p.resolution.width,height:p.resolution.height};}}/><Composition id="Walkthrough3D" component={Walkthrough3D} width={1280} height={720} fps={30} durationInFrames={90} defaultProps={{project:DEFAULT_PROJECT,media:[],model:null,edits:null}} calculateMetadata={metadata}/></>;}
