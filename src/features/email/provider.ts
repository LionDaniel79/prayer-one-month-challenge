import { classifySendFailure, type DeliveryStatus } from "./policy";
export type OAuthConfig={clientId:string;clientSecret:string};
export type SendResult={status:DeliveryStatus;messageId?:string;code:string|null};
const TOKEN_URL="https://oauth2.googleapis.com/token";
const SEND_URL="https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export async function refreshAccessToken(config:OAuthConfig, refreshToken:string):Promise<string>{
  let response:Response;
  try{
    response=await fetch(TOKEN_URL,{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(7000),
      headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,refresh_token:refreshToken,grant_type:"refresh_token"})});
  }catch{throw new Error("GMAIL_REFRESH_UNAVAILABLE");}
  const data=await response.json().catch(()=>null) as {access_token?:unknown;error?:unknown}|null;
  if(data?.error==="invalid_grant")throw new Error("GMAIL_RECONNECT_REQUIRED");
  if(!response.ok || typeof data?.access_token!=="string" || !data.access_token)throw new Error("GMAIL_REFRESH_UNAVAILABLE");
  return data.access_token;
}

// Never retry a messages.send call here: after a network error Google might already have accepted it.
export async function sendGmail(accessToken:string,raw:string):Promise<SendResult>{
  try{
    const response=await fetch(SEND_URL,{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(10000),
      headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({raw})});
    const data=await response.json().catch(()=>null) as {id?:unknown;error?:{errors?:{reason?:string}[]}}|null;
    if(response.ok && typeof data?.id==="string" && data.id.length>0 && data.id.length<=256)return {status:"sent",messageId:data.id,code:null};
    const status=classifySendFailure(response.status,data?.error?.errors?.[0]?.reason);
    const code=status==="unknown"?"DELIVERY_UNKNOWN":response.status===401?"GMAIL_RECONNECT_REQUIRED":status==="retry"?"GMAIL_RATE_LIMITED":"GMAIL_SEND_REJECTED";
    return {status,code};
  }catch{return {status:"unknown",code:"DELIVERY_UNKNOWN"};}
}
