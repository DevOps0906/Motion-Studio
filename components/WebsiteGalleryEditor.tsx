'use client';
import type {WebsiteGalleryItem} from '../lib/website';
import type {MediaAsset} from '../lib/model';

// Picks gallery images from the media library: add, caption, reorder, remove. Max 12, no duplicates.
export default function WebsiteGalleryEditor({items,media,onChange}:{items:WebsiteGalleryItem[];media:MediaAsset[];onChange:(items:WebsiteGalleryItem[])=>void}) {
  const unused=media.filter(asset=>!items.some(item=>item.imageId===asset.id));
  function patch(index:number,change:Partial<WebsiteGalleryItem>){onChange(items.map((item,i)=>i===index?{...item,...change}:item));}
  function move(index:number,offset:number){
    const next=index+offset,list=[...items];
    if(next<0||next>=list.length)return;
    [list[index],list[next]]=[list[next],list[index]];onChange(list);
  }
  return <div className="website-gallery-editor">
    {items.length===0&&<p className="small">아직 고른 이미지가 없습니다. 이미지가 없으면 갤러리 섹션은 화면에 나타나지 않습니다.</p>}
    {items.map((item,index)=>{
      const asset=media.find(entry=>entry.id===item.imageId);
      return <fieldset key={item.imageId}><legend>이미지 {index+1}</legend>
        {asset?<img className="website-gallery-thumb" src={`/api/media/${encodeURIComponent(item.imageId)}`} alt={asset.name}/>:<p className="small">삭제되었거나 확인할 수 없는 이미지입니다. 화면과 내보내기에서는 건너뜁니다. 저장하려면 제거해 주세요.</p>}
        <label>설명 · 선택<input maxLength={120} value={item.caption||''} onChange={e=>patch(index,{caption:e.target.value})}/></label>
        <div className="actions"><button type="button" disabled={index===0} aria-label={`이미지 ${index+1} 위로`} onClick={()=>move(index,-1)}>↑</button><button type="button" disabled={index===items.length-1} aria-label={`이미지 ${index+1} 아래로`} onClick={()=>move(index,1)}>↓</button><button type="button" onClick={()=>onChange(items.filter((_,i)=>i!==index))}>이 이미지 제거</button></div>
      </fieldset>;
    })}
    <label>이미지 추가 · 최대 12장<select value="" disabled={items.length>=12||unused.length===0} onChange={e=>{if(e.target.value)onChange([...items,{imageId:e.target.value}]);}}><option value="">{unused.length===0?'추가할 이미지가 없습니다':'미디어에서 선택'}</option>{unused.map(asset=><option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></label>
  </div>;
}
