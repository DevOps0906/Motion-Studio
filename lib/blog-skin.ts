export type BlogMenu={label:string;url:string};
export type BlogSkinDraft={brand:string;headline:string;description:string;accent:string;style:'corporate'|'personal'|'magazine';imageId:string;logoImageId:string;widgetImageUrl:string;widgetTop:number;widgetOffsetX:number;menus:BlogMenu[]};
export type BlogSkinProject={id:string;schemaVersion:1;createdAt:string;updatedAt:string;draft:BlogSkinDraft};
export const DEFAULT_BLOG_SKIN:BlogSkinDraft={brand:'DIGITAL NOMAD LAB',headline:'아이디어를 현실로 만드는 연구소',description:'AI · WEB · DESIGN · AUTOMATION',accent:'#c4b5fd',style:'corporate',imageId:'',logoImageId:'',widgetImageUrl:'',widgetTop:580,widgetOffsetX:0,menus:[{label:'소개',url:'https://blog.naver.com/'},{label:'서비스',url:'https://blog.naver.com/'},{label:'포트폴리오',url:'https://blog.naver.com/'},{label:'블로그',url:'https://blog.naver.com/'},{label:'문의',url:'https://blog.naver.com/'}]};
export function validateBlogSkin(value:unknown):BlogSkinDraft{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('스킨 정보를 입력해 주세요.');
 const data=value as Record<string,unknown>;
 function text(key:string,max:number,required=false){if(typeof data[key]!=='string'||(data[key] as string).length>max)throw new Error(`${key}: ${max}자 이하로 입력해 주세요.`);const result=(data[key] as string).trim();if(required&&!result)throw new Error(`${key}: 내용을 입력해 주세요.`);return result;}
 function url(value:string){let parsed:URL;try{parsed=new URL(value);}catch{throw new Error('링크는 http 또는 https 주소로 입력해 주세요.');}if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('인증 정보 없는 http 또는 https 링크만 지원합니다.');return value;}
 const brand=text('brand',80,true),headline=text('headline',160,true),description=text('description',300),accent=text('accent',7),imageId=text('imageId',80),logoImageId=data.logoImageId===undefined?'':text('logoImageId',80),widgetImageUrl=text('widgetImageUrl',2000);
 if(!/^#[0-9a-f]{6}$/i.test(accent))throw new Error('6자리 HEX 색상을 선택해 주세요.');
 if([imageId,logoImageId].some(id=>id&&!/^[a-zA-Z0-9-]+$/.test(id)))throw new Error('이미지 ID를 확인해 주세요.');if(widgetImageUrl)url(widgetImageUrl);
 if(!['corporate','personal','magazine'].includes(data.style as string))throw new Error('스킨 스타일을 선택해 주세요.');
 if(!Number.isInteger(data.widgetTop)||Number(data.widgetTop)<420||Number(data.widgetTop)>620||!Number.isInteger(data.widgetOffsetX)||Math.abs(Number(data.widgetOffsetX))>200)throw new Error('위젯 배치 범위를 확인해 주세요.');
 if(!Array.isArray(data.menus)||data.menus.length<1||data.menus.length>5)throw new Error('메뉴는 1~5개로 구성해 주세요.');
 const menus=data.menus.map((item:unknown)=>{if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('메뉴를 확인해 주세요.');const menu=item as Record<string,unknown>;if(typeof menu.label!=='string'||!menu.label.trim()||menu.label.length>16||typeof menu.url!=='string'||menu.url.length>2000)throw new Error('메뉴 이름은 1~16자, URL은 2000자 이하입니다.');return {label:menu.label.trim(),url:url(menu.url.trim())};});
 return {brand,headline,description,accent,imageId,logoImageId,widgetImageUrl,style:data.style as BlogSkinDraft['style'],widgetTop:Number(data.widgetTop),widgetOffsetX:Number(data.widgetOffsetX),menus};
}
export function blogWidgetCoordinates(draft:BlogSkinDraft){const total=draft.menus.length*170+(draft.menus.length-1)*24;return draft.menus.map((menu,index)=>({...menu,x:Math.round((1920-total)/2+index*194+draft.widgetOffsetX),y:draft.widgetTop,width:170,height:100}));}
export function escapeBlogText(text:string){return text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}
