// Access rules for proxy.ts (no 'server-only': proxy bundles cannot import it). Everything not listed here needs a session.
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {validateWebsiteBrief, websiteGalleryImageIds} from './website';
export type ApiAccess = 'public'|'public-media'|'render-asset'|'private';
// Exact path + method. HEAD is treated as GET.
const PUBLIC_API: Record<string, string[]> = {
  '/api/auth': ['GET', 'POST', 'DELETE'],
  '/api/inquiries': ['POST'],
  '/api/website-requirements': ['POST'],
  '/api/health': ['GET'],
};
const MEDIA_ITEM = /^\/api\/media\/([a-zA-Z0-9-]{1,80})$/;
// Render workers fetch assets without a cookie: the proxy lets a GET with a token query through, the route verifies the token (or the owner's session).
const RENDER_ASSET = /^\/api\/renders\/[a-zA-Z0-9-]{1,80}\/assets\/[a-zA-Z0-9-]{1,80}$/;
export function apiAccess(method: string, pathname: string): ApiAccess {
  const verb = method.toUpperCase() === 'HEAD' ? 'GET' : method.toUpperCase();
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (PUBLIC_API[path]?.includes(verb)) return 'public';
  if (verb === 'GET' && MEDIA_ITEM.test(path)) return 'public-media';
  if (verb === 'GET' && RENDER_ASSET.test(path)) return 'render-asset';
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
// A media item is public only while some saved website uses it as a cover image or in a gallery section that is switched on
// (same resolution as the preview/export via websiteGalleryImageIds). No cache: switching a section off or deleting applies at once.
// With ownerId, only websites of that owner count (the media owner's own pages); without it any website counts (proxy pre-filter for visitors).
export async function isWebsiteCoverImage(id: string, ownerId?: string) {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) return false;
  const directory = path.join(process.cwd(), '.local-data', 'websites');
  for (const name of await readdir(directory).catch(() => [] as string[])) {
    if (!name.endsWith('.json')) continue;
    try {
      const site = JSON.parse(await readFile(path.join(directory, name), 'utf8')) as {ownerId?: unknown; heroImageId?: unknown; pages?: {heroImageId?: unknown}[]};
      if (ownerId !== undefined && site.ownerId !== ownerId) continue;
      if (site.heroImageId === id || (Array.isArray(site.pages) && site.pages.some(page => page?.heroImageId === id))) return true;
      try { if (websiteGalleryImageIds(validateWebsiteBrief(site)).includes(id)) return true; } catch {}
    } catch {}
  }
  return false;
}
