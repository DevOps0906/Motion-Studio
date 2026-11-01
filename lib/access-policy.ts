// Access rules for proxy.ts (no 'server-only': proxy bundles cannot import it). Everything not listed here needs a session.
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
export type ApiAccess = 'public'|'public-media'|'private';
// Exact path + method. HEAD is treated as GET.
const PUBLIC_API: Record<string, string[]> = {
  '/api/auth': ['GET', 'POST', 'DELETE'],
  '/api/inquiries': ['POST'],
  '/api/website-requirements': ['POST'],
  '/api/health': ['GET'],
};
const MEDIA_ITEM = /^\/api\/media\/([a-zA-Z0-9-]{1,80})$/;
export function apiAccess(method: string, pathname: string): ApiAccess {
  const verb = method.toUpperCase() === 'HEAD' ? 'GET' : method.toUpperCase();
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (PUBLIC_API[path]?.includes(verb)) return 'public';
  if (verb === 'GET' && MEDIA_ITEM.test(path)) return 'public-media';
  return 'private';
}
export function mediaIdFromPath(pathname: string) {return MEDIA_ITEM.exec(pathname.replace(/\/+$/, ''))?.[1] || '';}
// Static routes under /websites that are not saved previews.
const WEBSITE_RESERVED = new Set(['editor', 'inquiries']);
export function isPublicPage(pathname: string) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/login' || path === '/website-requirements') return true;
  const preview = /^\/websites\/([^/]+)$/.exec(path);
  return Boolean(preview && /^[a-zA-Z0-9-]{1,80}$/.test(preview[1]) && !WEBSITE_RESERVED.has(preview[1]));
}
// Next internals, app/icon.svg and files served from public/ (root files with an extension, photos/models/templates).
export function isStaticAsset(pathname: string) {
  return pathname.startsWith('/_next/') || /^\/[^/]+\.[a-zA-Z0-9]{1,12}$/.test(pathname) || /^\/(photos|models|templates)\//.test(pathname);
}
// A media item is public only while some saved website uses it as the home or page cover image.
export async function isWebsiteCoverImage(id: string) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) return false;
  const directory = path.join(process.cwd(), '.local-data', 'websites');
  for (const name of await readdir(directory).catch(() => [] as string[])) {
    if (!name.endsWith('.json')) continue;
    try {
      const site = JSON.parse(await readFile(path.join(directory, name), 'utf8')) as {heroImageId?: unknown; pages?: {heroImageId?: unknown}[]};
      if (site.heroImageId === id || (Array.isArray(site.pages) && site.pages.some(page => page?.heroImageId === id))) return true;
    } catch {}
  }
  return false;
}
