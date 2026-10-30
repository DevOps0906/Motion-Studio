import 'server-only';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import {DATA,readJson,writeJson,listJson,listMedia,resolveMedia,validId} from './store';
import {rasterizeSvg} from './rasterize';
import {validateBlogSkin,blogWidgetCoordinates,escapeBlogText as e,type BlogSkinDraft,type BlogSkinProject} from '../blog-skin';
const directory=path.join(DATA,'blog-skins');
export async function listBlogSkins(){return (await listJson<BlogSkinProject>(directory)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
export async function saveBlogSkin(input:unknown,id?:string){
 const draft=validateBlogSkin(input);if(id&&!validId(id))throw new Error('프로젝트 ID를 확인해 주세요.');
 const available=await listMedia();let previous:BlogSkinProject|undefined;if(id)previous=await readJson<BlogSkinProject>(path.join(directory,id+'.json'));
 if([draft.imageId,draft.logoImageId].filter(Boolean).some(id=>!available.some(asset=>asset.id===id&&asset.type==='image')))throw new Error('대표 이미지를 다시 선택해 주세요.');
 const now=new Date().toISOString(),project:BlogSkinProject={id:previous?.id||randomUUID(),schemaVersion:1,createdAt:previous?.createdAt||now,updatedAt:now,draft};
 await writeJson(path.join(directory,project.id+'.json'),project);return project;
}
function textLines(text:string,max:number){
 const lines:string[]=[];let line='';const width=(value:string)=>Array.from(value).reduce((sum,char)=>sum+(/[\x00-\x7f]/.test(char)?.55:1),0);
 for(const char of text){
  if(char==='\n'){if(line.trim())lines.push(line.trim());line='';continue;}
  if(width(line+char)>max&&line){const space=line.lastIndexOf(' ');if(space>0){lines.push(line.slice(0,space));line=line.slice(space+1);}else{lines.push(line);line='';}}
  line+=char;
 }
 if(line.trim())lines.push(line.trim());return lines;
}
function svgText(text:string,x:number,y:number,size:number,color:string,max:number,lines=3){const wrapped=textLines(text,max);return `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="700">${wrapped.slice(0,lines).map((line,index)=>`<tspan x="${x}" dy="${index?size*1.3:0}">${e(line+(index===lines-1&&wrapped.length>lines?'…':''))}</tspan>`).join('')}</text>`;}
export function blogSkinSvg(draft:BlogSkinDraft,image='',logo=''){
 const dark=draft.style==='corporate',bg=dark?'#0b1020':draft.style==='personal'?'#f6efe7':'#f5f6f8',fg=dark?'#f1f5f9':'#162032',muted=dark?'#b6c2d6':'#526176',panel=dark?'#192338':'#ffffff';
 const widgets=blogWidgetCoordinates(draft).filter(widget=>widget.height===100);
 const asideX=draft.asidePosition==='left'?275:1500;
 const aside=draft.asidePosition&&draft.asidePosition!=='none'?`<g data-blog-aside="${draft.asidePosition}"><rect x="${asideX}" y="165" width="170" height="430" rx="12" fill="${panel}"/>${svgText(draft.brand,asideX+16,205,17,fg,8,2)}${svgText('프로필 · 카테고리',asideX+16,270,12,muted,13,1)}${draft.menus.map((menu,index)=>`<rect x="${asideX}" y="${300+index*54}" width="170" height="48" rx="6" fill="${draft.accent}" opacity=".14"/>${svgText(menu.label,asideX+16,331+index*54,14,fg,10,1)}`).join('')}</g>`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1920" height="900"><defs><clipPath id="cover"><rect x="1100" y="165" width="335" height="330" rx="${draft.style==='personal'?145:20}"/></clipPath></defs><rect width="1920" height="900" fill="${bg}"/>${aside}<circle cx="1460" cy="220" r="310" fill="${draft.accent}" opacity=".08"/>${logo?`<image x="487" y="55" width="42" height="42" preserveAspectRatio="xMidYMid meet" xlink:href="${logo}"/>`:""}${svgText(draft.brand,logo?547:487,95,30,fg,logo?29:32,1)}<text x="487" y="160" fill="${muted}" font-size="14" letter-spacing="4">CREATIVE BRAND EXPERIENCE</text>${svgText(draft.headline,487,245,58,fg,9.4,3)}${svgText(draft.description,487,505,18,muted,49,2)}${image?`<image x="1100" y="165" width="335" height="330" preserveAspectRatio="xMidYMid slice" clip-path="url(#cover)" xlink:href="${image}"/>`:`<rect x="1100" y="165" width="335" height="330" rx="${draft.style==='personal'?145:20}" fill="${draft.accent}"/><g transform="rotate(-10 1267 330)" fill="${bg}"><rect x="1187" y="250" width="72" height="72" rx="14"/><rect x="1275" y="250" width="72" height="72" rx="14" opacity=".6"/><rect x="1187" y="338" width="72" height="72" rx="14" opacity=".6"/><rect x="1275" y="338" width="72" height="72" rx="14"/></g>`}${widgets.map((widget,index)=>`<rect x="${widget.x}" y="${widget.y}" width="170" height="100" rx="12" fill="${panel}"/><text x="${widget.x+20}" y="${widget.y+24}" font-size="13" fill="${muted}">0${index+1} ↗</text>${svgText(widget.label,widget.x+20,widget.y+55,20,fg,6.5,2)}`).join('')}<text x="487" y="${draft.widgetTop+142}" fill="${muted}" font-size="13" letter-spacing="3">LATEST CONTENTS · BLOG</text>${draft.menus.slice(0,3).map((menu,index)=>`<rect x="${487+index*322}" y="${draft.widgetTop+160}" width="302" height="105" rx="10" fill="${panel}"/>${svgText(menu.label,507+index*322,draft.widgetTop+205,20,fg,12,2)}`).join('')}</svg>`;
}
async function imageFor(draft:BlogSkinDraft){
 if(!draft.imageId)return '';
 const asset=await resolveMedia(draft.imageId);if(!['image/png','image/jpeg','image/webp'].includes(asset.mimeType))throw new Error('PNG·JPG·WebP 이미지를 선택해 주세요.');
 const stat=await fs.stat(asset.file);if(stat.size>20*1024**2)throw new Error('이미지는 20MiB 이하로 선택해 주세요.');
 return `data:${asset.mimeType};base64,${(await fs.readFile(asset.file)).toString('base64')}`;
}
export async function renderBlogSkin(input:unknown){const draft=validateBlogSkin(input),image=await imageFor(draft),logo=await imageFor({...draft,imageId:draft.logoImageId});return {draft,svg:blogSkinSvg(draft,image,logo)};}
export async function exportBlogSkin(input:unknown){
 const {draft,svg}=await renderBlogSkin(input),files:Record<string,Uint8Array>={},coordinates=blogWidgetCoordinates(draft);
 files['skin-background-1920x900.png']=rasterizeSvg(svg);files['skin-background.svg']=strToU8(svg);
 for(const [name,width,height]of [['title-966x200',966,200],['thumbnail-1200x630',1200,630],['mobile-cover-1080x1080',1080,1080]] as const){
  const dark=draft.style==='corporate',bg=dark?'#0b1020':'#f6f3ee',fg=dark?'#f1f5f9':'#162032',size=height===200?32:height===1080?64:55;
  const asset=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${bg}"/><rect x="0" y="0" width="12" height="${height}" fill="${draft.accent}"/>${svgText(draft.brand,60,height===200?55:120,24,fg,40,1)}${svgText(draft.headline,60,height===200?110:220,size,fg,(width-120)/size,height===200?2:5)}</svg>`;
  files[name+'.png']=rasterizeSvg(asset);
 }
 for(const height of [100,500])files[`transparent-170x${height}.png`]=rasterizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="170" height="${height}"/>`);
 const imageUrl=draft.widgetImageUrl||'__TRANSPARENT_IMAGE_URL__';
 coordinates.forEach((widget,index)=>{const code=`<a href="${e(widget.url)}" target="_blank" rel="noopener noreferrer"><img src="${e(imageUrl)}" width="170" height="${widget.height}" border="0" alt="${e(widget.label)}"></a>`;if(Array.from(code).reduce((sum,char)=>sum+(char.charCodeAt(0)>127?2:1),0)>2000)throw new Error('위젯 코드가 너무 깁니다. 메뉴·이미지 URL을 짧게 지정해 주세요.');files[`widgets/menu-${index+1}.html`]=strToU8(code);});
 files['coordinates.json']=strToU8(JSON.stringify({canvas:{width:1920,height:900},coordinates,naverPositionVerified:false},null,2));
 const csv=(value:string)=>'"'+(/^[=+@\-\t\r]/.test(value)?"'"+value:value).replace(/"/g,'""')+'"';
 files['coordinates.csv']=strToU8('\uFEFFlabel,url,x,y,width,height\n'+coordinates.map(w=>[csv(w.label),csv(w.url),w.x,w.y,w.width,w.height].join(',')).join('\n'));
 files['metadata.json']=strToU8(JSON.stringify(draft,null,2));
 files['설치-안내.txt']=strToU8(`네이버 홈페이지형 블로그 수동 적용 패키지\n\n1. 먼저 PC 관리 → 꾸미기 설정 → 레이아웃·위젯 설정에서 레이아웃을 정합니다.\n2. skin-background PNG는 배경 자료, title PNG는 타이틀용 별도 자료입니다. 1920×900은 제작 캔버스 예시이며 네이버 고정 규격이 아닙니다.\n3. transparent-170x100.png를 공개 HTTPS 이미지 주소로 업로드합니다. ${draft.widgetImageUrl?'입력한 공개 이미지 URL이 위젯 코드에 포함되어 있습니다.':'widgets/*.html의 __TRANSPARENT_IMAGE_URL__을 업로드한 실제 주소로 반드시 바꾸세요.'}\n4. 메뉴 링크를 자신의 카테고리·게시글·문의 주소로 확인한 뒤 위젯 직접 등록에 코드를 붙여 넣습니다.\n5. coordinates는 PNG 캔버스 좌표입니다. 실제 네이버 레이아웃에서 위치·배율을 맞춰 미리보기로 확인하세요.\n6. 공식 위젯 안내는 가로 170px, 세로 최대 600px, 총 20개입니다. 이 패키지는 기본 메뉴 최대5개와 선택형 사이드 링크 최대5개를 만듭니다. 사이드 영역은 선택한 네이버 레이아웃에 맞춰 수동 배치합니다. 일부 태그가 제한될 수 있으므로 등록 전 확인합니다.\n7. 모바일은 PC 스킨과 다르게 표시됩니다. mobile-cover는 별도 자료이며 모바일 홈에 자동 설치되지 않습니다.\n\n전체 HTML/CSS/JavaScript 홈페이지나 계정 자동 설치·게시 기능은 포함하지 않습니다.\nPNG 엔진: Rust resvg / @resvg/resvg-js 2.6.2. 시스템 한글 폰트를 사용하므로 OS별 결과를 확인하세요.\n공식 참고: https://help.naver.com/service/5593/contents/15269?lang=ko&osType=PC\nhttps://help.naver.com/service/5593/contents/15275?lang=ko&osType=PC\n`);
 return zipSync(files,{level:1});
}
