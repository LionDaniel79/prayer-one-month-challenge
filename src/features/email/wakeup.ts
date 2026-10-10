import {after} from "next/server";
// Only invoked AFTER the original request has been durably accepted.
export function scheduleEmailDelivery(request:Request){
 if(process.env.VERCEL_ENV!=="production"||process.env.NODE_ENV!=="production")return;
 const origin=new URL(request.url).origin;
 try{after(async()=>{
   try{const {dispatchEmails}=await import("./dispatcher");await dispatchEmails(origin,1);}
   catch{console.warn("Submission email dispatch deferred; durable queue retained");}
 });}catch{console.warn("Submission email wakeup deferred; scheduled worker will retry");}
}
