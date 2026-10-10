import {NextResponse} from "next/server";
import {getEmailSettings} from "../../../../src/features/email/repository";
import {runtimeAllowed,secretMatches} from "../../../../src/features/email/policy";
import {dispatchEmails} from "../../../../src/features/email/dispatcher";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
export async function POST(request:Request){
 if(process.env.VERCEL_ENV!=="production"||process.env.NODE_ENV!=="production")return NextResponse.json({code:"FORBIDDEN"},{status:403,headers});
 const authorization=request.headers.get("authorization")??"";
 if(!/^Bearer [A-Za-z0-9_-]{32,200}$/u.test(authorization))return NextResponse.json({code:"FORBIDDEN"},{status:403,headers});
 try{
  const s=await getEmailSettings(),origin=new URL(request.url).origin;
  if(!runtimeAllowed(process.env,origin,s.production_origin)||!secretMatches(authorization.slice(7),s.dispatch_secret_hash))return NextResponse.json({code:"FORBIDDEN"},{status:403,headers});
  return NextResponse.json(await dispatchEmails(origin,2),{headers});
 }catch{return NextResponse.json({code:"EMAIL_DISPATCH_UNAVAILABLE"},{status:503,headers});}
}
