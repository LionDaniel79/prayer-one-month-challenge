import type {SendResult} from "./provider";
export type DeliveryDependencies = {
  prepare():Promise<string>;
  begin():Promise<boolean>;
  send(accessToken:string):Promise<SendResult>;
  finish(result:SendResult):Promise<void>;
  beforeSendFailure(code:string):Promise<void>;
};
// Keep the irreversible provider call between a durable sending state and a durable result.
// If persisting an accepted result fails, the database lease later becomes unknown, never pending.
export async function deliverWithLease(deps:DeliveryDependencies):Promise<string>{
  let access:string;
  try{access=await deps.prepare();}catch(error){
    const code=error instanceof Error && error.message==="GMAIL_RECONNECT_REQUIRED"?"GMAIL_RECONNECT_REQUIRED":"GMAIL_REFRESH_UNAVAILABLE";
    await deps.beforeSendFailure(code);return "not_sent";
  }
  if(!await deps.begin())return "cancelled";
  const result=await deps.send(access).catch(()=>({status:"unknown" as const,code:"DELIVERY_UNKNOWN"}));
  await deps.finish(result);
  return result.status;
}
