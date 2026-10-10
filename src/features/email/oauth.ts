import {randomBytes} from "node:crypto";
import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
import {getDb,rows,sql} from "../pastoral/db";
import {getCurrentSessionUser} from "../auth/http-session";
import {SESSION_COOKIE_NAME} from "../auth/session";
import {DomainError} from "../../lib/http";
import {withDeadline} from "../../lib/deadline";
import {emailConfig,getEmailSettings,requireEmailProduction} from "./repository";
import {digest,EMAIL_CALLBACK,EMAIL_STATE_COOKIE,GMAIL_SCOPES,seal,unseal,validateGoogleIdentity} from "./policy";

export async function startEmailConnection(origin:string,adminId:string,sessionToken:string){
 const config=emailConfig();const state=`mail.${randomBytes(32).toString("base64url")}`,verifier=randomBytes(48).toString("base64url");
 const recipient=await getDb().transaction(async tx=>{
  const s=await getEmailSettings(tx,true);requireEmailProduction(origin,s);
  if(!s.recipient || !sessionToken)throw new DomainError("EMAIL_RECIPIENT_REQUIRED",400);
  await tx.execute(sql`delete from prayer_app.email_oauth_states where admin_id=${adminId}::uuid or expires_at<now()`);
  await tx.execute(sql`insert into prayer_app.email_oauth_states(state_hash,admin_id,session_hash,generation,verifier_ciphertext,expires_at)
   values(${digest(state)},${adminId}::uuid,${digest(sessionToken)},${s.generation},${seal(verifier,config.key,"pkce")},now()+interval '10 minutes')`);
  return s.recipient;
 });
 const params=new URLSearchParams({client_id:config.clientId,redirect_uri:origin+EMAIL_CALLBACK,response_type:"code",scope:GMAIL_SCOPES.join(" "),
   state,nonce:state,code_challenge:Buffer.from(digest(verifier),"hex").toString("base64url"),code_challenge_method:"S256",
   access_type:"offline",prompt:"consent",include_granted_scopes:"false",login_hint:recipient});
 return {state,url:`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`};
}

type MailState={generation:number;verifier_ciphertext:string};
export async function consumeEmailState(state:string,expectedState:string|undefined,adminId:string,sessionToken:string):Promise<MailState>{
 if(!/^mail\.[A-Za-z0-9_-]{43}$/u.test(state) || state!==expectedState || !sessionToken)throw new DomainError("EMAIL_OAUTH_STATE_INVALID",400);
 const [saved]=await rows<MailState>(getDb(),sql`delete from prayer_app.email_oauth_states where state_hash=${digest(state)} and admin_id=${adminId}::uuid
   and session_hash=${digest(sessionToken)} and expires_at>now() returning generation,verifier_ciphertext`);
 if(!saved)throw new DomainError("EMAIL_OAUTH_STATE_INVALID",400);
 return saved;
}

export async function emailOAuthCallback(request:NextRequest){
 let result="failed";
 try{
  const user=await getCurrentSessionUser();if(!user||user.role!=="admin")throw new DomainError("FORBIDDEN",403);
  const origin=request.nextUrl.origin,s=await getEmailSettings();requireEmailProduction(origin,s);
  const state=request.nextUrl.searchParams.get("state")??"";
  const store=await cookies();
  const saved=await consumeEmailState(state,request.cookies.get(EMAIL_STATE_COOKIE)?.value,user.id,store.get(SESSION_COOKIE_NAME)?.value??"");
  if(request.nextUrl.searchParams.has("error"))throw new DomainError("GMAIL_CONSENT_REQUIRED",400);
  const code=request.nextUrl.searchParams.get("code");if(!code||code.length>4096||saved.generation!==s.generation)throw new DomainError("EMAIL_OAUTH_STATE_INVALID",400);
  const config=emailConfig();
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10000),
   headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,
   redirect_uri:origin+EMAIL_CALLBACK,code,code_verifier:unseal(saved.verifier_ciphertext,config.key,"pkce"),grant_type:"authorization_code"})});
  const tokens=await response.json().catch(()=>null) as {id_token?:string;refresh_token?:string;scope?:string}|null;
  if(!response.ok || !tokens?.id_token || !tokens.refresh_token || !tokens.scope?.split(" ").includes(GMAIL_SCOPES[2]))throw new DomainError("GMAIL_SEND_PERMISSION_REQUIRED",400);
  const {google}=await import("googleapis");
  const ticket=await withDeadline(new google.auth.OAuth2(config.clientId).verifyIdToken({idToken:tokens.id_token,audience:config.clientId}),10000);
  validateGoogleIdentity(ticket.getPayload()??{},s.recipient,state);
  await getDb().transaction(async tx=>{
   const current=await getEmailSettings(tx,true);
   if(current.generation!==saved.generation || current.recipient!==s.recipient)throw new DomainError("EMAIL_SETTINGS_CHANGED",409);
   await tx.execute(sql`update prayer_app.email_notification_settings set refresh_token_ciphertext=${seal(tokens.refresh_token!,config.key,"token")},
     google_email=${s.recipient},token_client_id=${config.clientId},connected_by=${user.id}::uuid,connected_at=now(),verified_at=null,last_test_at=null,
     enabled=false,enabled_at=null,generation=generation+1,last_error=null,updated_at=now() where id=1`);
  });
  result="connected";
 }catch(error){
  // Fixed error vocabulary only. OAuth responses, tokens, and provider text never reach redirects or logs.
  if(error instanceof Error && ["GMAIL_ACCOUNT_MISMATCH","GMAIL_SEND_PERMISSION_REQUIRED","EMAIL_NOT_CONFIGURED","EMAIL_PRODUCTION_REQUIRED","GMAIL_CONSENT_REQUIRED","EMAIL_SETTINGS_CHANGED","EMAIL_OAUTH_STATE_INVALID"].includes(error.message))result=error.message;
 }
 const response=NextResponse.redirect(new URL(`/admin?email=${encodeURIComponent(result)}#email-notifications`,request.url));
 response.headers.set("Cache-Control","private, no-store");response.headers.set("Referrer-Policy","no-referrer");
 response.cookies.set(EMAIL_STATE_COOKIE,"",{httpOnly:true,secure:true,sameSite:"lax",path:EMAIL_CALLBACK,maxAge:0});
 return response;
}
