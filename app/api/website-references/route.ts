import {parseReferenceCards,referenceSearchUrl,type ReferenceProvider,type ReferenceSearch} from '../../../lib/website-references';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const cache=new Map<string,{at:number;result:ReferenceSearch}>();
export async function GET(request:Request){
 const params=new URL(request.url).searchParams,provider=params.get('provider'),query=(params.get('q')||'').trim();
 if(!['awwwards','dribbble'].includes(provider||'')||query.length<2||query.length>100)return Response.json({error:'탐색처와 2~100자의 검색어를 입력해 주세요.'},{status:400});
 const typed=provider as ReferenceProvider,browseUrl=referenceSearchUrl(typed,query),key=typed+':'+query;
 const prior=cache.get(key);if(prior&&Date.now()-prior.at<600000)return Response.json(prior.result);
 try{
  // Fetch only the two fixed public search hosts. Never fetch a user-supplied URL or follow redirects.
  const response=await fetch(browseUrl,{signal:AbortSignal.timeout(10000),redirect:'error',headers:{Accept:'text/html'},cache:'no-store'});
  if(!response.ok||!response.body)throw new Error('조회 제한');
  const reader=response.body.getReader(),decoder=new TextDecoder();let html='',bytes=0;
  try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>2*1024*1024)throw new Error('검색 결과가 너무 큽니다.');html+=decoder.decode(chunk.value,{stream:true});}}finally{await reader.cancel();}
  const results=parseReferenceCards(html,typed),result={provider:typed,results,browseUrl,notice:results.length?'공개 검색 결과의 제목·분류를 바탕으로 디자인 방향을 제안합니다. 원본 사이트의 코드나 이미지를 복제하지 않습니다.':'현재 자동 조회가 제한되거나 결과가 없습니다. 사이트에서 검색 후 선택한 작품 URL을 아래에 붙여 넣어 주세요.'};
  if(cache.size>=40)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now(),result});return Response.json(result);
 }catch{return Response.json({provider:typed,results:[],browseUrl,notice:'탐색처의 자동 조회가 제한되었습니다. 사이트 검색을 열어 작품을 확인한 뒤 URL을 붙여 넣으면 레퍼런스로 저장할 수 있습니다.'});}
}
