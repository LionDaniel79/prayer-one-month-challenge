import {getDb,rows,sql} from "../pastoral/db";
import {beginEmailSend,claimEmail,emailConfig,getEmailSettings,requireEmailProduction,type EmailJob} from "./repository";
import {encodeMessage,formatNotification,unseal} from "./policy";
import {refreshAccessToken,sendGmail,type SendResult} from "./provider";
import {deliverWithLease} from "./delivery";

async function finish(job:EmailJob,result:SendResult,beforeSend=false){
 const status=result.status==="retry"&&job.attempts>=5?"failed":result.status;
 const delay=Math.min(3600,30*2**job.attempts);
 await getDb().transaction(async tx=>{
  // Same lock order as settings changes and beginning a send: settings, then outbox.
  await getEmailSettings(tx,true);
  const updated=await rows(tx,sql`update prayer_app.email_notification_outbox set status=${status},error_code=${result.code},provider_message_id=${result.messageId??null},
    not_before=now()+${delay}*interval '1 second',finished_at=case when ${status}='retry' then null else now() end,lease_token=null,lease_until=null,
    recipient=case when ${status}='sent' then null else recipient end,sam_label=case when ${status}='sent' then null else sam_label end,
    requester_name=case when ${status}='sent' then null else requester_name end,visit_date=case when ${status}='sent' then null else visit_date end,visit_time=case when ${status}='sent' then null else visit_time end
    where id=${job.id}::uuid and lease_token=${job.lease_token}::uuid and status=${beforeSend?"leased":"sending"} returning id`);
  if(!updated.length)return;
  if(job.kind==="test"&&status==="sent")await tx.execute(sql`update prayer_app.email_notification_settings set verified_at=now(),last_error=null,updated_at=now()
    where id=1 and generation=${job.generation} and recipient=${job.recipient} and google_email=${job.recipient}`);
  else if(result.code)await tx.execute(sql`update prayer_app.email_notification_settings set last_error=${result.code},updated_at=now() where id=1 and generation=${job.generation}`);
 });
}
export async function dispatchEmails(origin:string,limit=2){
 if(process.env.VERCEL_ENV!=="production"||process.env.NODE_ENV!=="production")return {processed:0};
 requireEmailProduction(origin,await getEmailSettings());
 const config=emailConfig();
 await getDb().execute(sql`select prayer_app.maintain_submission_email()`);
 let processed=0;
 for(let i=0;i<Math.max(1,Math.min(limit,2));i++){
  const claimed=await claimEmail(origin);if(!claimed)break;
  const {job,settings}=claimed;
  let raw:string;
  try{raw=encodeMessage({email:job.recipient,id:job.id,date:new Date(job.created_at),...formatNotification(job.kind,{samLabel:job.sam_label,requesterName:job.requester_name,visitDate:job.visit_date,visitTime:job.visit_time})});}
  catch{await finish(job,{status:"failed",code:"EMAIL_PAYLOAD_INVALID"},true);continue;}
  await deliverWithLease({
   prepare:()=>refreshAccessToken(config,unseal(settings.refresh_token_ciphertext!,config.key,"token")),
   begin:()=>beginEmailSend(origin,job),
   send:access=>sendGmail(access,raw),
   finish:result=>finish(job,result),
   beforeSendFailure:code=>finish(job,{status:code==="GMAIL_RECONNECT_REQUIRED"?"failed":"retry",code},true),
  });
  processed++;
 }
 return {processed};
}
