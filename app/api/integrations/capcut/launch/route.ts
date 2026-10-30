import {CAPCUT_DOWNLOAD_URL, findCapCut, isLocalLaunchRequest, launchCapCut} from '../../../../../lib/server/capcut-launch';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!isLocalLaunchRequest(request)) return Response.json({status: 'local-only', downloadUrl: CAPCUT_DOWNLOAD_URL}, {status: 403});
  try {
    const executable = await findCapCut();
    if (!executable) return Response.json({status: 'not-installed', downloadUrl: CAPCUT_DOWNLOAD_URL});
    await launchCapCut(executable);
    return Response.json({status: 'launched'});
  } catch {
    return Response.json({status: 'launch-failed', downloadUrl: CAPCUT_DOWNLOAD_URL});
  }
}
