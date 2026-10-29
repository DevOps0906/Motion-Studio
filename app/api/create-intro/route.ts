import {buildIntroProject,type IntroRequest} from '../../../lib/template-catalog';
import {saveProject,listMedia,apiError} from '../../../lib/server/store';
import {startRender} from '../../../lib/server/render';
export const runtime='nodejs';
export async function POST(request:Request){let createdProjectId:string|undefined;try{const body=await request.json() as IntroRequest;const config=buildIntroProject(body);const media=await listMedia();if(!media.some(m=>m.id===config.brand.logoAssetId&&m.type==='image'&&m.role!=='source-capture'))throw new Error('로고로 사용할 이미지 파일을 선택해 주세요.');const project=await saveProject(config);createdProjectId=project.id;const port=new URL(request.url).port||'80';const job=await startRender(project,`http://127.0.0.1:${port}`);return Response.json({project,job},{status:202});}catch(error){if(createdProjectId)return Response.json({error:error instanceof Error?error.message:'렌더를 시작하지 못했습니다.',projectId:createdProjectId},{status:409});return apiError(error);}}
