import {cookies} from "next/headers";
import {z} from "zod";
import {requireAdminActor,json,sameOrigin} from "../../../../src/features/pastoral/http";
import {readLimited,ReportError} from "../../../../src/features/pastoral/policy";
import {SESSION_COOKIE_NAME} from "../../../../src/features/auth/session";
import {DomainError} from "../../../../src/lib/http";
import {disconnectEmail,emailStatus,enqueueVerificationEmail,getEmailSettings,requireEmailProduction,saveEmailSettings} from "../../../../src/features/email/repository";
import {startEmailConnection} from "../../../../src/features/email/oauth";
import {EMAIL_CALLBACK,EMAIL_STATE_COOKIE} from "../../../../src/features/email/policy";
import {dispatchEmails} from "../../../../src/features/email/dispatcher";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=60;
function errorResponse(error:unknown){
 if(error instanceof DomainError || error instanceof ReportError)return json({code:error.code},error.status);
 return json({code:"EMAIL_SERVICE_UNAVAILABLE"},503);
}
async function input(request:Request){
 if(!request.headers.get("content-type")?.startsWith("application/json"))throw new DomainError("INVALID_INPUT",400);
 try{return JSON.parse(Buffer.from(await readLimited(request,4096)).toString("utf8"));}
 catch(error){if(error instanceof ReportError)throw error;throw new DomainError("INVALID_INPUT",400);}
}
export async function GET(request:Request){
 try{await requireAdminActor();return json(await emailStatus(new URL(request.url).origin));}catch(error){return errorResponse(error);}
}
export async function PUT(request:Request){
 try{
  await requireAdminActor();sameOrigin(request);const origin=new URL(request.url).origin;
  requireEmailProduction(origin,await getEmailSettings());
  const parsed=z.object({recipient:z.string(),enabled:z.boolean()}).strict().safeParse(await input(request));
  if(!parsed.success)throw new DomainError("INVALID_INPUT",400);
  return json(await saveEmailSettings(origin,parsed.data.recipient,parsed.data.enabled));
 }catch(error){return errorResponse(error);}
}
export async function POST(request:Request){
 try{
  const actor=await requireAdminActor();sameOrigin(request);const origin=new URL(request.url).origin;
  requireEmailProduction(origin,await getEmailSettings());
  const parsed=z.object({action:z.enum(["connect","test","disconnect","dispatch"])}).strict().safeParse(await input(request));
  if(!parsed.success)throw new DomainError("INVALID_INPUT",400);
  if(parsed.data.action==="connect"){
   const session=(await cookies()).get(SESSION_COOKIE_NAME)?.value??"";
   const connection=await startEmailConnection(origin,actor.id,session);const response=json({url:connection.url});
   response.cookies.set(EMAIL_STATE_COOKIE,connection.state,{httpOnly:true,secure:true,sameSite:"lax",path:EMAIL_CALLBACK,maxAge:600});
   return response;
  }
  if(parsed.data.action==="disconnect")await disconnectEmail(origin);
  if(parsed.data.action==="test"){await enqueueVerificationEmail(origin);await dispatchEmails(origin,1);}
  if(parsed.data.action==="dispatch")await dispatchEmails(origin,2);
  return json(await emailStatus(origin));
 }catch(error){return errorResponse(error);}
}
