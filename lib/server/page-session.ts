import 'server-only';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {SESSION_COOKIE,readSession,type AccountIdentity} from '../account-store';
// Server components that read data re-check the session themselves instead of trusting proxy.ts alone.
export async function requirePageAccount():Promise<AccountIdentity>{
 const account=await readSession((await cookies()).get(SESSION_COOKIE)?.value||'');
 if(!account)redirect('/login');
 return account;
}
