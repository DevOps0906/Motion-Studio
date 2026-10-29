import 'server-only';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DATA, listJson, readJson, writeJson, listMedia} from './store';
import {validateWebsiteBrief, type WebsiteProject} from '../website';

const directory = path.join(DATA, 'websites');
export function websiteFile(id: string) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('잘못된 웹 프로젝트 ID입니다.');
  return path.join(directory, `${id}.json`);
}
export async function getWebsite(id: string) {
  const project = await readJson<WebsiteProject>(websiteFile(id));
  return {...project, ...validateWebsiteBrief(project)};
}
export async function listWebsites() {
  return (await listJson<WebsiteProject>(directory)).map(project => ({...project, ...validateWebsiteBrief(project)})).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function saveWebsite(input: unknown, id?: string) {
  const brief = validateWebsiteBrief(input);
  const existing = id ? await getWebsite(id) : undefined;
  if (brief.heroImageId) {
    const media = await listMedia();
    if (!media.some(m => m.id === brief.heroImageId && m.type === 'image' && m.role !== 'source-capture')) throw new Error('대표 이미지로 사용할 사진을 다시 선택해 주세요.');
  }
  const now = new Date().toISOString();
  const project: WebsiteProject = {...brief, id: existing?.id ?? randomUUID(), schemaVersion: 1,
    templateId: 'brand-landing-v1', createdAt: existing?.createdAt ?? now, updatedAt: now};
  await writeJson(websiteFile(project.id), project);
  return project;
}
