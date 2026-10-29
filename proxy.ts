import {NextResponse,type NextRequest} from 'next/server';
export function proxy(request:NextRequest){if(!['GET','HEAD','OPTIONS'].includes(request.method)){const origin=request.headers.get('origin');const expected=`${request.nextUrl.protocol}//${request.headers.get('host')}`;if(request.headers.get('sec-fetch-site')==='cross-site'||(origin&&origin!==expected))return NextResponse.json({error:'다른 사이트에서 보낸 변경 요청은 허용하지 않습니다.'},{status:403});}return NextResponse.next();}
export const config={matcher:'/api/:path*'};
