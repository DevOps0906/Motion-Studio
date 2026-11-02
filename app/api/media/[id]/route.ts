import {fileFor,readJson,resolveMedia,streamFile,apiError,deleteMedia,validId} from '../../../../lib/server/store';
import {allow,authorize,notFoundResponse} from '../../../../lib/server/owner';
import {isWebsiteCoverImage} from '../../../../lib/access-policy';
import type {MediaAsset} from '../../../../lib/model';
export const runtime='nodejs';export const dynamic='force-dynamic';
// Allowed: own item, shared source-* sample, an image a public page of the media owner shows (cover/gallery), or the operator (audited). Everything else is the fixed 404.
// The proxy only pre-filters visitors; this decision is made here for every request, session or not.
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;if(!validId(id))return notFoundResponse();
  if(!id.startsWith('source-')){
   let record:MediaAsset;try{record=await readJson<MediaAsset>(fileFor('media',id));}catch{return notFoundResponse();}
   const actor=await authorize(request),signedIn=!(actor instanceof Response);
   if(!(signedIn&&record.ownerId===actor.id)&&!await isWebsiteCoverImage(id,record.ownerId??'')){
    if(!signedIn||!actor.operator)return notFoundResponse();
    await allow(actor,record,'media',id,'view');
   }
  }
  const m=await resolveMedia(id);return await streamFile(m.file,m.mimeType,request);
 }catch(e){return apiError(e,404);}
}

export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){try{const actor=await authorize(request);if(actor instanceof Response)return actor;await deleteMedia((await params).id,actor);return Response.json({ok:true});}catch(e){return apiError(e);}}
