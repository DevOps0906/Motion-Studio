import 'server-only';
import {Resvg} from '@resvg/resvg-js';
// Application-generated SVG only: text is escaped and images are embedded bytes.
export function rasterizeSvg(svg:string){
 if(svg.length>32*1024**2)throw new Error('SVG가 너무 큽니다.');
 const font=process.platform==='win32'?'Malgun Gothic':'Noto Sans CJK KR';
 const renderer=new Resvg(svg,{font:{loadSystemFonts:true,defaultFontFamily:font,sansSerifFamily:font},languages:['ko','en']});
 if(renderer.width<=0||renderer.height<=0||renderer.width>4096||renderer.height>4096||renderer.imagesToResolve().length)throw new Error('이미지 크기 또는 외부 참조를 확인해 주세요.');
 return renderer.render().asPng();
}
