export type ReferenceProvider='awwwards'|'dribbble';
export type ReferenceCard={provider:ReferenceProvider;title:string;url:string;thumbnail:string;tags:string[]};
export type ReferenceSearch={provider:ReferenceProvider;results:ReferenceCard[];browseUrl:string;notice:string};
export const referenceProviders=[{id:'awwwards',name:'Awwwards',url:'https://www.awwwards.com/'},{id:'dribbble',name:'Dribbble',url:'https://dribbble.com/'}] as const;
export function referenceSearchUrl(provider:ReferenceProvider,query:string){return provider==='awwwards'?`https://www.awwwards.com/websites/?text=${encodeURIComponent(query)}`:`https://dribbble.com/search/${encodeURIComponent(query.trim().replace(/\s+/g,'-'))}`;}
export function referenceDesign(tags:string[],title:string):'studio'|'editorial'|'gallery'{
 const text=(tags.join(' ')+' '+title).toLowerCase();
 if(/architecture|editorial|minimal|interior|건축|인테리어/.test(text))return 'editorial';
 if(/photo|portfolio|art|gallery|작품|사진/.test(text))return 'gallery';
 return 'studio';
}
export function decodeReferenceText(value:string){return value.replace(/&quot;/g,'"').replace(/&#039;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');}
export function parseReferenceCards(html:string,provider:ReferenceProvider):ReferenceCard[]{
 const cards:ReferenceCard[]=[],seen=new Set<string>();
 if(provider==='awwwards'){
  for(const match of html.matchAll(/data-collectable-model-value="([^"]+)"/g)){
   try{const model=JSON.parse(decodeReferenceText(match[1]));if(model.type!=='submission'||!model.slug||!/^[a-zA-Z0-9-]+$/.test(model.slug))continue;
    const url=`https://www.awwwards.com/sites/${model.slug}`;if(seen.has(url))continue;seen.add(url);
    const image=String(model.images?.thumbnail||model.collectableImage||'');
    cards.push({provider,title:String(model.title||model.collectableTitle||model.slug).slice(0,180),url,
      thumbnail:/^submissions\/[a-zA-Z0-9/_\-.]+$/.test(image)?`https://assets.awwwards.com/awards/media/cache/thumb_440_330/${image}`:'',
      tags:Array.isArray(model.tags)?model.tags.filter((tag:unknown)=>typeof tag==='string').slice(0,12):[]});
   }catch{continue;}
   if(cards.length>=12)break;
  }
 }else{
  for(const match of html.matchAll(/<a\b[^>]*href="(\/shots\/\d+[^"?#]*)"[^>]*>([\s\S]*?)<\/a>/g)){
   const url=`https://dribbble.com${match[1]}`;if(seen.has(url))continue;
   const title=match[2].match(/alt="([^"]+)"/)?.[1]||match[2].replace(/<[^>]+>/g,' ').trim();if(!title)continue;
   seen.add(url);const image=match[2].match(/(?:src|data-src)="(https:\/\/cdn\.dribbble\.com\/[^" ]+)"/)?.[1]||'';
   cards.push({provider,url,title:decodeReferenceText(title).slice(0,180),thumbnail:decodeReferenceText(image),tags:[]});if(cards.length>=12)break;
  }
 }
 return cards;
}
