import {beforeEach,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({rows:vi.fn(),execute:vi.fn(),settings:vi.fn(),production:vi.fn()}));
vi.mock('../../src/features/pastoral/db',async()=>({sql:(await import('drizzle-orm')).sql,rows:mocks.rows,getDb:()=>({execute:mocks.execute,transaction:async(fn:(tx:unknown)=>unknown)=>fn({execute:mocks.execute})})}));
vi.mock('../../src/features/email/repository',()=>({emailConfig:()=>({clientId:'client',clientSecret:'secret',key:Buffer.alloc(32,9).toString('base64')}),getEmailSettings:mocks.settings,requireEmailProduction:mocks.production}));
import {consumeEmailState,startEmailConnection} from '../../src/features/email/oauth';
import {PgDialect} from 'drizzle-orm/pg-core';
import {digest} from '../../src/features/email/policy';
beforeEach(()=>{vi.clearAllMocks();mocks.settings.mockResolvedValue({recipient:'admin@example.test',generation:3});mocks.execute.mockResolvedValue({rows:[]});});
describe('Gmail consent is session-bound and independent from Calendar',()=>{
 it('requests only send plus verified identity, with PKCE and separate state',async()=>{
  const result=await startEmailConnection('https://app.example.test','00000000-0000-4000-8000-000000000001','SESSION');
  const url=new URL(result.url);expect(url.origin).toBe('https://accounts.google.com');
  expect(url.searchParams.get('scope')?.split(' ')).toEqual(['openid','email','https://www.googleapis.com/auth/gmail.send']);
  expect(url.searchParams.get('state')).toMatch(/^mail\.[\w-]{43}$/);expect(url.searchParams.get('nonce')).toBe(result.state);
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');expect(url.searchParams.get('code_challenge')).toHaveLength(43);
  expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.test/api/admin/google-calendar/callback');
  expect(url.searchParams.has('code_verifier')).toBe(false);expect(url.searchParams.get('include_granted_scopes')).toBe('false');
  const statements=mocks.execute.mock.calls.map(([q])=>new PgDialect().sqlToQuery(q));
  expect(statements.every(s=>!s.sql.includes('google_calendar_connections'))).toBe(true);
  expect(JSON.stringify(statements)).not.toContain('SESSION');expect(JSON.stringify(statements)).toContain(digest('SESSION'));
 });
 it.each([['calendar-state','calendar-state','SESSION'],['mail.'+'a'.repeat(43),'different','SESSION'],['mail.'+'a'.repeat(43),'mail.'+'a'.repeat(43),'']])('rejects malformed or mismatched cookies before consuming state',async(state,cookie,session)=>{
  await expect(consumeEmailState(state,cookie,'admin',session)).rejects.toMatchObject({code:'EMAIL_OAUTH_STATE_INVALID'});expect(mocks.rows).not.toHaveBeenCalled();
 });
 it('consumes only a matching unexpired administrator session using DELETE RETURNING',async()=>{
  const state='mail.'+'b'.repeat(43);mocks.rows.mockResolvedValueOnce([{generation:3,verifier_ciphertext:'ENCRYPTED'}]).mockResolvedValueOnce([]);
  expect(await consumeEmailState(state,state,'admin','SESSION')).toEqual({generation:3,verifier_ciphertext:'ENCRYPTED'});
  const query=new PgDialect().sqlToQuery(mocks.rows.mock.calls[0][1]);
  expect(query.sql).toContain('delete from prayer_app.email_oauth_states');expect(query.sql).toContain('expires_at>now()');
  expect(query.sql).toContain('session_hash');expect(query.sql).toContain('admin_id');
  expect(query.params).toContain(digest('SESSION'));expect(query.params).toContain(digest(state));expect(query.params).not.toContain('SESSION');
  await expect(consumeEmailState(state,state,'admin','SESSION')).rejects.toMatchObject({code:'EMAIL_OAUTH_STATE_INVALID'});
 });
});
