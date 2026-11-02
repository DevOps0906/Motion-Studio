import {NextResponse,type NextRequest} from 'next/server';
import {readSession,sessionToken} from './lib/account-store';
import {apiAccess,isPublicPage,isStaticAsset,isWebsiteCoverImage,mediaIdFromPath} from './lib/access-policy';
// Next 16 proxy runs on the Node.js runtime, so the session file is verified here (pages reading data re-check on the server).
export async function proxy(request:NextRequest){
 const {pathname}=request.nextUrl;
 if(pathname.startsWith('/api/')||pathname==='/api'){
  if(!['GET','HEAD','OPTIONS'].includes(request.method)){const origin=request.headers.get('origin');const expected=`${request.nextUrl.protocol}//${request.headers.get('host')}`;if(request.headers.get('sec-fetch-site')==='cross-site'||(origin&&origin!==expected))return NextResponse.json({error:'다른 사이트에서 보낸 변경 요청은 허용하지 않습니다.'},{status:403});}
  const access=apiAccess(request.method,pathname);
  if(access==='public')return NextResponse.next();
  // Render assets: the route itself accepts only a matching token or the owner's session; the proxy just requires a token-shaped query.
  if(access==='render-asset'&&/^[a-f0-9]{32,128}$/.test(request.nextUrl.searchParams.get('token')||''))return NextResponse.next();
  if(await readSession(sessionToken(request.headers.get('cookie'))))return NextResponse.next();
  if(access==='public-media'&&await isWebsiteCoverImage(mediaIdFromPath(pathname)))return NextResponse.next();
  return NextResponse.json({error:'로그인이 필요합니다.'},{status:401,headers:{'Cache-Control':'no-store'}});
 }
 if(isStaticAsset(pathname)||isPublicPage(pathname))return NextResponse.next();
 if(await readSession(sessionToken(request.headers.get('cookie'))))return NextResponse.next();
 return NextResponse.redirect(new URL('/login',request.url));
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
