import {promises as fs} from 'node:fs';
import {strToU8, zipSync} from 'fflate';
import {getWebsite} from '../../../../../lib/server/websites';
import {resolveMedia, apiError} from '../../../../../lib/server/store';
import {exportWebsiteHtml} from '../../../../../lib/website-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  let project;
  try { project = await getWebsite(id); }
  catch (error) { return apiError(error, 404); }
  try {
    // Each page may override the home image; resolve every distinct image once.
    const images = new Map<string, string>();
    async function image(mediaId: string) {
      if (!mediaId) return '';
      const cached = images.get(mediaId);
      if (cached) return cached;
      const asset = await resolveMedia(mediaId);
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(asset.mimeType)) throw new Error('대표 이미지는 PNG·JPG·WebP여야 합니다.');
      const stat = await fs.stat(asset.file);
      if (stat.size > 20 * 1024 ** 2) throw new Error('대표 이미지는 20MiB 이하로 내보낼 수 있습니다.');
      const dataUrl = `data:${asset.mimeType};base64,${(await fs.readFile(asset.file)).toString('base64')}`;
      images.set(mediaId, dataUrl);
      return dataUrl;
    }
    const hasPages = project.pages.length > 0;
    const home = exportWebsiteHtml(project, await image(project.heroImageId));
    const pageFiles: Record<string, Uint8Array> = {};
    for (const page of project.pages) pageFiles[`${page.id}.html`] = strToU8(exportWebsiteHtml(project, await image(page.heroImageId || project.heroImageId), page));
    const output = hasPages ? zipSync({
      'index.html':strToU8(home),
      ...pageFiles,
      'README.txt':strToU8('웹사이트 파일 안내\n\nindex.html을 열어 미리볼 수 있습니다. 추가 페이지도 같은 폴더에 두고 링크를 유지하세요. index.html을 홈페이지 기본 문서로 배포합니다.\n'),
    }) : home;
    return new Response(output, {headers: {
      'Content-Type': hasPages ? 'application/zip' : 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="motion-studio-${id}.${hasPages?'zip':'html'}"`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; sandbox allow-top-navigation-by-user-activation",
    }});
  } catch (error) { return apiError(error); }
}
