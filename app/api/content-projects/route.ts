import {saveProject,apiError} from '../../../lib/server/store';
export const runtime='nodejs';
export async function POST(request:Request){try{const project=await request.json();if(!project.contentType||project.contentType==='intro')throw Error('콘텐츠 형식을 확인해 주세요.');return Response.json(await saveProject(project,project.id==='preview'?undefined:project.id),{status:201});}catch(error){return apiError(error);}}
