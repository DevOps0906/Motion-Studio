// task-011: transcript types and pure helpers shared by the server and the editor (no 'server-only').
import type {CaptionSegment} from './model';
export const TRANSCRIBE_MAX_SECONDS=300;
export type TranscriptEngine='local'|'remote';
export type TranscriptMode='accurate'|'fast';
export type TranscriptLanguage='ko'|'en'|'auto';
export type TranscriptStatus='queued'|'processing'|'done'|'failed'|'canceled';
export type TranscriptJob={ownerId?:string;id:string;mediaId:string;mediaName:string;durationSeconds:number;engine:TranscriptEngine;mode:TranscriptMode;language:TranscriptLanguage;status:TranscriptStatus;progress:number;stage:string;createdAt:string;updatedAt:string;pid?:number;error?:string;segments?:CaptionSegment[];edited?:boolean;consentAt?:string};
const pad=(value:number,size=2)=>String(value).padStart(size,'0');
export function srtTime(seconds:number){const ms=Math.max(0,Math.round(seconds*1000));return `${pad(Math.floor(ms/3600000))}:${pad(Math.floor(ms/60000)%60)}:${pad(Math.floor(ms/1000)%60)},${pad(ms%1000,3)}`;}
// One cue text: CR and blank lines removed, <...> and {...} tags stripped, "-->" neutralised (it would end the timing line), at most 2 lines.
export function srtCueText(text:string){
 const cleaned=text.replace(/\r\n?/g,'\n').replace(/<[^>\n]*>/g,'').replace(/\{[^}\n]*\}/g,'').replace(/-{2,}>/g,'->');
 const lines=cleaned.split('\n').map(line=>line.replace(/[^\S\n]+/g,' ').trim()).filter(Boolean);
 return (lines.length>2?[lines[0],lines.slice(1).join(' ')]:lines).join('\r\n');
}
// UTF-8 without BOM, CRLF. Cues whose text is empty after cleaning are skipped and the rest renumbered.
export function toSrt(segments:CaptionSegment[]){
 let index=0,out='';
 for(const segment of segments){const text=srtCueText(segment.text);if(!text)continue;index++;out+=`${index}\r\n${srtTime(segment.start)} --> ${srtTime(segment.end)}\r\n${text}\r\n\r\n`;}
 return out;
}
// Header-safe names: an ASCII fallback and a percent-encoded filename* (RFC 5987/6266).
export function srtDisposition(mediaName:string){
 const base=mediaName.replace(/\.[^./\\]{1,5}$/,'').replace(/[\u0000-\u001f\u007f"\\/:*?<>|]/g,'').trim().slice(0,80)||'captions';
 const ascii=base.replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'')||'captions';
 const encoded=encodeURIComponent(base+'.srt').replace(/['()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase());
 return `attachment; filename="${ascii}.srt"; filename*=UTF-8''${encoded}`;
}
// True when the template (8 rows, 120 chars each) cannot hold every sentence.
export function captionRowsTruncated(segments:CaptionSegment[],maxRows=8){
 return segments.length>maxRows||groupSegments(segments,maxRows).some(group=>[...group.map(segment=>segment.text).join(' ')].length>120);
}
function groupSegments(segments:CaptionSegment[],maxRows:number){
 const rows=Math.min(maxRows,segments.length),groups:CaptionSegment[][]=Array.from({length:rows},()=>[]);
 segments.forEach((segment,index)=>groups[Math.floor(index*rows/segments.length)].push(segment));
 return groups;
}
// Fills the captioned-video rows (1~8, title 120 chars) from segments; more than 8 segments are grouped in order.
export function fillCaptionRows(segments:CaptionSegment[],maxRows=8){
 return groupSegments(segments,maxRows).map(group=>({title:[...group.map(segment=>segment.text).join(' ')].slice(0,120).join(''),detail:'',sourceUrl:''}));
}
