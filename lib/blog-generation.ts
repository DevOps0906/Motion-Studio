import {canonicalNaverBlogUrl,DEFAULT_BLOG_SKIN,validateBlogSkin,type BlogSkinDraft} from './blog-skin';
export type BlogGenerationInput={blogUrl:string;referenceUrl:string;asidePosition:'none'|'left'|'right'};
export function validateBlogGenerationInput(input:unknown):BlogGenerationInput{
 if(!input||typeof input!=='object')throw Error('블로그 주소와 레퍼런스를 입력해 주세요.');const data=input as Record<string,unknown>;
 if(typeof data.blogUrl!=='string'||data.blogUrl.length>2000||typeof data.referenceUrl!=='string'||!data.referenceUrl||data.referenceUrl.length>2000)throw Error('네이버 블로그 주소와 레퍼런스 URL을 입력해 주세요.');
 const blogUrl=canonicalNaverBlogUrl(data.blogUrl),ref=new URL(data.referenceUrl);if(!['http:','https:'].includes(ref.protocol)||ref.username||ref.password)throw Error('레퍼런스는 http/https 주소를 입력해 주세요.');
 const asidePosition=data.asidePosition??'none';if(typeof asidePosition!=='string'||!['none','left','right'].includes(asidePosition))throw Error('사이드 영역 위치를 확인해 주세요.');return {blogUrl,referenceUrl:ref.href,asidePosition:asidePosition as BlogGenerationInput['asidePosition']};
}
export function automaticBlogDraft(input:BlogGenerationInput,metadata:{title?:string;description?:string}={}):BlogSkinDraft{
 const id=new URL(input.blogUrl).pathname.slice(1),brand=(metadata.title||id).replace(/\s*[:|\-]\s*네이버\s*블로그.*$/,'').slice(0,80)||id;
 const style=/minimal|editorial|magazine/i.test(input.referenceUrl)?'magazine':/portfolio|photo|art|dribbble/i.test(input.referenceUrl)?'personal':'corporate';
 return validateBlogSkin({...DEFAULT_BLOG_SKIN,...input,brand,style,headline:brand+'의 이야기를 만나보세요.',description:(metadata.description||'블로그의 소개와 콘텐츠를 확인하고 원하는 메뉴로 이동하세요.').slice(0,300),menus:[{label:'블로그 홈',url:input.blogUrl},{label:'전체 글',url:`https://blog.naver.com/PostList.naver?blogId=${encodeURIComponent(id)}&from=postList&categoryNo=0`}]});
}
