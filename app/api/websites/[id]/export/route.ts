import {promises as fs} from 'node:fs';
import {strToU8, zipSync, type Zippable} from 'fflate';
import {getOwnedWebsite} from '../../../../../lib/server/websites';
import {authorize} from '../../../../../lib/server/owner';
import {resolveMedia, apiError} from '../../../../../lib/server/store';
import {exportWebsiteHtml} from '../../../../../lib/website-export';
import {websiteGalleryImageIds} from '../../../../../lib/website';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const EXTENSIONS: Record<string, string> = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp'};
const TOTAL_LIMIT = 60 * 1024 ** 2;
export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  const actor = await authorize(request);
  if (actor instanceof Response) return actor;
  const {id} = await params;
  let project;
  try { project = await getOwnedWebsite(id, actor); }
  catch (error) { return apiError(error, 404); }
  try {
    // Every distinct image is read once. The hero image is required; gallery images that no longer exist are skipped.
    const images = new Map<string, {mimeType: string; file: string; size: number}>();
    async function load(mediaId: string, optional: boolean) {
      if (images.has(mediaId)) return;
      let asset;
      try { asset = await resolveMedia(mediaId); }
      catch (error) { if (optional) return; throw error; }
      if (!EXTENSIONS[asset.mimeType]) throw new Error(optional ? '갤러리 이미지는 PNG·JPG·WebP여야 합니다.' : '대표 이미지는 PNG·JPG·WebP여야 합니다.');
      let stat;
      try { stat = await fs.stat(asset.file); }
      catch (error) { if (optional) return; throw error; }
      if (stat.size > 20 * 1024 ** 2) throw new Error('이미지는 20MiB 이하로 내보낼 수 있습니다.');
      images.set(mediaId, {mimeType: asset.mimeType, file: asset.file, size: stat.size});
    }
    const hasPages = project.pages.length > 0;
    const heroIds = [project.heroImageId, ...project.pages.map(page => page.heroImageId || project.heroImageId)].filter(Boolean);
    for (const mediaId of new Set(heroIds)) await load(mediaId, false);
    for (const mediaId of websiteGalleryImageIds(project)) await load(mediaId, true);
    if ([...images.values()].reduce((sum, item) => sum + item.size, 0) > TOTAL_LIMIT) throw new Error('이미지 합계가 60MB를 넘어 내보낼 수 없습니다. 갤러리 이미지를 줄여 주세요.');
    // ZIP: each image is stored once under assets/ and referenced by relative path. Single HTML: inlined data URL.
    const assets: Zippable = {};
    const sources = new Map<string, string>();
    for (const [mediaId, item] of images) {
      const bytes = await fs.readFile(item.file);
      if (hasPages) {
        const name = `assets/${mediaId}.${EXTENSIONS[item.mimeType]}`;
        assets[name] = [bytes, {level: 0}];
        sources.set(mediaId, `./${name}`);
      } else sources.set(mediaId, `data:${item.mimeType};base64,${bytes.toString('base64')}`);
    }
    const sourceOf = (mediaId: string) => (mediaId ? sources.get(mediaId) || '' : '');
    const gallerySources = Object.fromEntries(websiteGalleryImageIds(project).filter(mediaId => sources.has(mediaId)).map(mediaId => [mediaId, sources.get(mediaId)!]));
    const home = exportWebsiteHtml(project, sourceOf(project.heroImageId), undefined, gallerySources);
    const pageFiles: Record<string, Uint8Array> = {};
    for (const page of project.pages) pageFiles[`${page.id}.html`] = strToU8(exportWebsiteHtml(project, sourceOf(page.heroImageId || project.heroImageId), page, gallerySources));
    const output = hasPages ? zipSync({
      'index.html':strToU8(home),
      ...pageFiles,
      ...assets,
      'README.txt':strToU8('웹사이트 파일 안내\n\nindex.html을 열어 미리볼 수 있습니다. 추가 페이지와 assets 폴더(이미지)도 같은 위치에 두고 링크를 유지하세요. index.html을 홈페이지 기본 문서로 배포합니다.\n'),
    }) : home;
    return new Response(output, {headers: {
      'Content-Type': hasPages ? 'application/zip' : 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="motion-studio-${id}.${hasPages?'zip':'html'}"`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; sandbox allow-top-navigation-by-user-activation",
    }});
  } catch (error) { return apiError(error); }
}
