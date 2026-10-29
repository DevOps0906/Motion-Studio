import {promises as fs} from 'node:fs';
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
    let image = '';
    if (project.heroImageId) {
      const asset = await resolveMedia(project.heroImageId);
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(asset.mimeType)) throw new Error('대표 이미지는 PNG·JPG·WebP여야 합니다.');
      const stat = await fs.stat(asset.file);
      if (stat.size > 20 * 1024 ** 2) throw new Error('대표 이미지는 20MiB 이하로 내보낼 수 있습니다.');
      image = `data:${asset.mimeType};base64,${(await fs.readFile(asset.file)).toString('base64')}`;
    }
    return new Response(exportWebsiteHtml(project, image), {headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="motion-studio-${id}.html"`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; sandbox allow-top-navigation-by-user-activation",
    }});
  } catch (error) { return apiError(error); }
}
