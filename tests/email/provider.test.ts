import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshAccessToken, sendGmail } from '../../src/features/email/provider';
afterEach(()=>vi.unstubAllGlobals());
describe('Gmail transport does not retry ambiguous send requests',()=>{
 it('sends only a raw RFC2822 message to the fixed Gmail endpoint',async()=>{
  const f=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:'mail-id'}),{status:200}));vi.stubGlobal('fetch',f);
  expect(await sendGmail('ACCESS','RAW')).toEqual({status:'sent',messageId:'mail-id',code:null});
  expect(f).toHaveBeenCalledTimes(1);expect(f.mock.calls[0][0]).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({raw:'RAW'});
 });
 it.each([429,400,403,500])('classifies %i without hidden transport retries',async status=>{
  const f=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{message:'PRIVATE_PROVIDER_ECHO'}}),{status}));vi.stubGlobal('fetch',f);
  const result=await sendGmail('ACCESS','RAW');expect(f).toHaveBeenCalledTimes(1);
  expect(result.status).toBe(status===429?'retry':status===500?'unknown':'failed');
  expect(JSON.stringify(result)).not.toContain('PRIVATE_PROVIDER_ECHO');
 });
 it('holds network timeouts and malformed accepted responses as unknown',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('TOKEN PRIVATE_ECHO')));
  expect(await sendGmail('ACCESS','RAW')).toEqual({status:'unknown',code:'DELIVERY_UNKNOWN'});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:200})));
  expect((await sendGmail('ACCESS','RAW')).status).toBe('unknown');
 });
 it('refreshes with the fixed OAuth token endpoint and never sends mail on invalid_grant',async()=>{
  const f=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:'invalid_grant'}),{status:400}));vi.stubGlobal('fetch',f);
  await expect(refreshAccessToken({clientId:'client',clientSecret:'secret'},'refresh')).rejects.toThrow('GMAIL_RECONNECT_REQUIRED');
  expect(f).toHaveBeenCalledTimes(1);expect(f.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
 });
});
