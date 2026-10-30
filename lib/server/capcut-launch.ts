import 'server-only';
import {access} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';

export const CAPCUT_DOWNLOAD_URL = 'https://www.capcut.com/tools/desktop-video-editor';
export function isLocalLaunchRequest(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const url = new URL(request.url);
  const local = ['localhost', '127.0.0.1', '[::1]'];
  if (!host || !origin || request.headers.get('sec-fetch-site') === 'cross-site') return false;
  try {
    const source = new URL(origin), target = new URL(`${url.protocol}//${host}`);
    return local.includes(target.hostname) && source.origin === target.origin;
  } catch { return false; }
}
export function capCutCandidates(platform = process.platform, env = process.env) {
  if (platform === 'darwin') return ['/Applications/CapCut.app', ...(env.HOME ? [path.join(env.HOME, 'Applications/CapCut.app')] : [])];
  if (platform !== 'win32') return [];
  return [env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'CapCut', 'Apps', 'CapCut.exe'),
    env.ProgramFiles && path.join(env.ProgramFiles, 'CapCut', 'CapCut.exe'),
    env['ProgramFiles(x86)'] && path.join(env['ProgramFiles(x86)'], 'CapCut', 'CapCut.exe')].filter((value): value is string => Boolean(value));
}
export async function findCapCut() {
  for (const candidate of capCutCandidates()) {
    try { await access(candidate); return candidate; } catch { /* Try the next known installation path. */ }
  }
  return '';
}
export async function launchCapCut(executable: string) {
  // No shell, URL handler, request-supplied path or command arguments.
  await new Promise<void>((resolve, reject) => {
    const child = process.platform === 'darwin'
      ? spawn('/usr/bin/open', ['-a', executable], {detached: true, stdio: 'ignore'})
      : spawn(executable, [], {detached: true, stdio: 'ignore', windowsHide: true});
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}
