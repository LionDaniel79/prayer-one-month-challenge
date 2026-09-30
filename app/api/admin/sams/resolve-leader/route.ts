import { requireAdminActor, boundedJson, sameOrigin, json, errorResponse } from "../../../../../src/features/pastoral/http";
import { object, clean, parseVillageLeader, ReportError } from "../../../../../src/features/pastoral/policy";
import { normalizeSamLabel, normalizeSamLeaderName } from "../../../../../src/features/sams/labels";
import { registrationTarget, resolveLeaderForAdmin } from "../../../../../src/features/sams/identity-service";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request){
  try{
    await requireAdminActor();sameOrigin(request);const input=object(await boundedJson(request));
    const kind=input.kind;if(kind!=="sam"&&kind!=="village")throw new ReportError("INVALID_INPUT");
    const name=clean(input.name,100,true),leaderName=normalizeSamLeaderName(clean(input.leaderName,120,true));
    if(!leaderName)throw new ReportError("INVALID_INPUT");
    const registration=kind==="village"?parseVillageLeader({name,leaderName}):{name:normalizeSamLabel(name)??"",leaderName};
    if(!registration.name)throw new ReportError("INVALID_INPUT");
    return json(await resolveLeaderForAdmin(registrationTarget(kind,registration)));
  }catch(e){return errorResponse(e);}
}
