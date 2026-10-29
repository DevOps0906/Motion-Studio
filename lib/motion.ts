export const DURATION=10;export const FPS=30;export const PHOTO_COUNT=36;
export const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(t:number)=>{const v=clamp(t);return v*v*(3-2*v);};const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
function cameraBase(progress:number,template:string='mosaic'){
 if(!['mosaic','diagonal','reveal'].includes(template)){
  const t=clamp(progress),p=smooth(t),angle=t*Math.PI*2;
  let pose={z:15,x:0,y:0,tilt:0};
  switch(template){
   case 'ken-burns':pose={z:mix(17,10,p),x:mix(-1.8,1.3,p),y:mix(.7,-.5,p),tilt:0};break;
   case 'horizontal-slide':pose={z:13,x:mix(-5,5,p),y:0,tilt:0};break;
   case 'vertical-rise':pose={z:13.8,x:0,y:mix(-3.8,3.8,p),tilt:.015};break;
   case 'orbit':pose={z:14+Math.sin(angle)*1.5,x:Math.sin(angle)*3.3,y:Math.cos(angle)*1.7,tilt:Math.sin(angle)*.045};break;
   case 'stomp':{const beat=t*8,phase=beat-Math.floor(beat);pose={z:11.5+5*smooth(phase/.55),x:Math.sin(Math.floor(beat)*1.7)*2,y:Math.cos(Math.floor(beat)*1.4),tilt:Math.sin(Math.floor(beat))*.035};break;}
   case 'carousel':pose={z:14,x:Math.sin(angle)*4.2,y:.4*Math.sin(angle*2),tilt:-.025*Math.sin(angle)};break;
   case 'stagger':pose={z:mix(16,13,p),x:mix(-1,1,p),y:mix(-1,.5,p),tilt:0};break;
   case 'spiral':pose={z:mix(6,18,p),x:Math.sin(angle)*1.3*(1-p),y:Math.cos(angle)*(1-p),tilt:mix(-.6,0,p)};break;
   case 'split':pose={z:mix(18,13,p),x:0,y:0,tilt:0};break;
   case 'flip':pose={z:mix(17,14,p),x:mix(1,-1,p),y:.3,tilt:0};break;
  }
  const end=smooth((t-.76)/.24);return {z:mix(pose.z,18,end),x:mix(pose.x,0,end),y:mix(pose.y,0,end),tilt:mix(pose.tilt,0,end)};
 }
 const t=clamp(progress);if(template==='diagonal'){const p=smooth(t);return {z:mix(11,17,p),x:mix(-3.5,3.5,p),y:mix(2,-2,p),tilt:mix(-.12,.12,p)};}
 if(template==='reveal'){const p=smooth(t/.78);return {z:mix(5,18,p),x:mix(-1.5,0,p),y:mix(.7,0,p),tilt:mix(-.2,0,p)};}
 if(t<.34){const p=smooth(t/.34);return {z:mix(3.3,18,p),x:mix(-1.7,0,p),y:mix(1,0,p),tilt:mix(-.05,.12,p)};}
 if(t<.7){const p=smooth((t-.34)/.36);return {z:mix(18,13,p),x:mix(0,3.8,p),y:mix(0,-1.8,p),tilt:mix(.12,-.08,p)};}
 const p=smooth((t-.7)/.28);return {z:mix(13,16,p),x:mix(3.8,0,p),y:mix(-1.8,0,p),tilt:mix(-.08,0,p)};
}
export function tileMotion(index:number,count:number,progress:number,template:string){
 const t=clamp(progress),order=index/Math.max(1,count-1),enter=smooth((t-order*.13)/.25),remain=1-enter;
 let x=0,y=0,z=0,rx=0,ry=0,rz=0,scale=1;
 if(template==='orbit')z=Math.sin(index*1.8)*.9*(1-smooth((t-.7)/.3));
 if(template==='stagger'){y=-4*remain;z=-2*remain;scale=.4+.6*enter;}
 if(template==='spiral'){const angle=(index/count)*Math.PI*2;x=Math.cos(angle)*3*remain;y=Math.sin(angle)*3*remain;rz=remain*.6;scale=.5+.5*enter;}
 if(template==='split')x=(index%2?-1:1)*7*remain;
 if(template==='flip'){ry=Math.PI*.49*remain;rx=.15*remain;y=-.5*remain;}
 if(template==='carousel')z=Math.sin(index*.9+t*Math.PI*2)*.35*(1-smooth((t-.75)/.25));
 return {x,y,z,rx,ry,rz,scale};
}
export function tileLayout(index:number,count=36){const cols=Math.min(9,Math.max(1,Math.ceil(Math.sqrt(count*2))));const rows=Math.ceil(count/cols);const col=index%cols,row=Math.floor(index/cols);const w=[1.28,1.55,1.1,1.8,1.3,1.5,1.2,1.7,1.28][col],h=[1.72,1.22,1.56,1.4][(row+col)%4];return {x:(col-(cols-1)/2)*1.8,y:((rows-1)/2-row)*2.1+(col%2)*.12,z:((row*13+col*7)%5)*.025,w,h};}
export function sceneState(timeSeconds:number,durationSeconds:number,template='mosaic',brandStart=durationSeconds*.7,brandEnd=durationSeconds){const t=clamp(timeSeconds,0,durationSeconds);return {progress:t/durationSeconds,camera:cameraPose(t/durationSeconds,template),brandOpacity:t<brandStart||t>brandEnd?0:smooth((t-brandStart)/Math.min(.65,Math.max(.01,brandEnd-brandStart)))};}
export function audioVolume(t:number,duration:number,a:{volume:number;startSeconds:number;fadeInSeconds:number;fadeOutSeconds:number}){if(t<a.startSeconds||t>=duration)return 0;return a.volume*Math.min(1,a.fadeInSeconds?((t-a.startSeconds)/a.fadeInSeconds):1,a.fadeOutSeconds?((duration-t)/a.fadeOutSeconds):1);}

export function cameraPose(progress:number,template='mosaic',count=36){const base=cameraBase(progress,template);const cols=Math.min(9,Math.max(1,Math.ceil(Math.sqrt(count*2)))),rows=Math.ceil(Math.max(1,count)/cols);const fit=Math.max(rows*2.1,cols*1.8/(16/9))/(2*Math.tan(26*Math.PI/180));return {...base,z:base.z/18*fit*.9,x:base.x*.65,y:base.y*.65};}
