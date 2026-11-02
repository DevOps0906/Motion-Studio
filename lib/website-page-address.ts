const PAGE_ADDRESS_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_LENGTH = 48;

// Longest keys first so "회사소개" wins over "소개". Keys are matched with spaces removed.
const PAGE_NAME_DICTIONARY: [string, string][] = [
  ['자주묻는질문', 'faq'], ['회사소개', 'about'], ['오시는길', 'location'], ['포트폴리오', 'portfolio'],
  ['서비스', 'services'], ['블로그', 'blog'], ['문의', 'contact'], ['상담', 'contact'], ['위치', 'location'],
  ['작업', 'portfolio'], ['가격', 'pricing'], ['요금', 'pricing'], ['후기', 'reviews'], ['소식', 'blog'],
  ['채용', 'careers'], ['공지', 'notice'], ['소개', 'about'], ['팀', 'team'],
];

export const DEFAULT_PAGE_ADDRESS = 'new-page';

/** True for the placeholder address that addPage generates (`new-page`, `new-page-2`, ...). */
export function isDefaultPageAddress(id: string) {
  return /^new-page(?:-\d+)?$/.test(id);
}

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function baseFromTitle(title: string): string {
  if (!/[가-힣]/.test(title)) return slugify(title);
  // Korean names: exact match, then suffix (the page type usually comes last), then prefix.
  // One-character keys must match exactly so "스팀" or "팀원" never become "team".
  const compact = title.replace(/\s+/g, '');
  const exact = PAGE_NAME_DICTIONARY.find(([key]) => compact === key);
  if (exact) return exact[1];
  const long = PAGE_NAME_DICTIONARY.filter(([key]) => key.length > 1);
  const found = long.find(([key]) => compact.endsWith(key)) || long.find(([key]) => compact.startsWith(key));
  return found ? found[1] : '';
}

function uniqueAddress(base: string, taken: Set<string>) {
  const fit = (value: string) => value.slice(0, MAX_LENGTH).replace(/-+$/, '');
  let root = fit(base);
  if (!root || root === 'index') root = root === 'index' ? 'index-page' : '';
  if (!root) return '';
  let candidate = root, n = 2;
  while (taken.has(candidate) || candidate === 'index') {
    const suffix = `-${n++}`;
    candidate = `${fit(root.slice(0, MAX_LENGTH - suffix.length))}${suffix}`;
  }
  return PAGE_ADDRESS_PATTERN.test(candidate) && candidate.length <= MAX_LENGTH ? candidate : '';
}

/**
 * Suggests a page address from a page name. `matched` is false when nothing readable could be
 * derived (e.g. an unknown Korean name); the caller should then keep the current address.
 * `currentId` is the page's own address and never counts as a duplicate.
 */
export function suggestPageAddress(title: string, existingIds: string[], currentId = ''): {address: string; matched: boolean} {
  const base = baseFromTitle(title.trim());
  const address = base ? uniqueAddress(base, new Set(existingIds.filter(id => id !== currentId))) : '';
  return address ? {address, matched: true} : {address: currentId, matched: false};
}
