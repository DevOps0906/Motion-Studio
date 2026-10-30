import {DEFAULT_PROJECT,type Project} from './model';
import {CONTENT_TEMPLATES} from './content-template-data';
export function newContentProject(templateId:string):Project{
 const definition=CONTENT_TEMPLATES.find(item=>item.id===templateId);if(!definition)throw Error('지원하지 않는 콘텐츠 템플릿입니다.');
 const titles=definition.category==='ranking-short'?['세 번째 항목','두 번째 항목','첫 번째 항목']:definition.category==='captioned-video'?['첫 문장을 입력하세요','전하고 싶은 내용을 적으세요','마지막 메시지를 입력하세요']:['제품 A','제품 B'];
 return {...JSON.parse(JSON.stringify(DEFAULT_PROJECT)),contentType:definition.category,templateId:definition.id,templateVersion:1,title:definition.name,resolution:definition.aspect==='9:16'?{width:720,height:1280}:{width:1280,height:720},creative:{heading:definition.name,rows:titles.map(title=>({title,detail:definition.category==='product-comparison'?'동일한 비교 기준을 입력하세요':'설명을 입력하세요',sourceUrl:''}))}};
}
