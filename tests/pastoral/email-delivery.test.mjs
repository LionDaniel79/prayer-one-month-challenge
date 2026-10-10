import test from 'node:test';
import assert from 'node:assert/strict';
import {deliverWithLease} from '../../src/features/email/delivery.ts';
function fixture(overrides={}){
 const events=[];
 const deps={async prepare(){events.push('prepare');return 'ACCESS';},async begin(){events.push('begin');return true;},async send(){events.push('send');return {status:'sent',messageId:'id',code:null};},async finish(result){events.push('finish:'+result.status);},async beforeSendFailure(code){events.push(code);},...overrides};
 return {deps,events};
}
test('delivery sends only after a fresh lease and persists the accepted result',async()=>{
 const {deps,events}=fixture();assert.equal(await deliverWithLease(deps),'sent');assert.deepEqual(events,['prepare','begin','send','finish:sent']);
});
test('changed recipient or disabled setting cancels the lease before messages.send',async()=>{
 const {deps,events}=fixture({async begin(){return false;}});assert.equal(await deliverWithLease(deps),'cancelled');assert.deepEqual(events,['prepare']);
});
test('refresh failure is safely retryable before any send and errors are not echoed',async()=>{
 const {deps,events}=fixture({async prepare(){throw new Error('PRIVATE_SECRET');}});assert.equal(await deliverWithLease(deps),'not_sent');assert.deepEqual(events,['GMAIL_REFRESH_UNAVAILABLE']);
});
test('revoked tokens require reconnection without sending or treating it as acceptance',async()=>{
 const {deps,events}=fixture({async prepare(){throw new Error('GMAIL_RECONNECT_REQUIRED');}});await deliverWithLease(deps);assert.deepEqual(events,['GMAIL_RECONNECT_REQUIRED']);
});
test('ambiguous network send gets exactly one attempt and an unknown durable status',async()=>{
 const {deps,events}=fixture({async send(){events.push('send');throw new Error('PRIVATE_PROVIDER');}});assert.equal(await deliverWithLease(deps),'unknown');assert.deepEqual(events,['prepare','begin','send','finish:unknown']);
});
test('failure saving an accepted delivery never resends it',async()=>{
 const {deps,events}=fixture({async finish(){throw new Error('DATABASE_UNAVAILABLE');}});await assert.rejects(deliverWithLease(deps));assert.deepEqual(events,['prepare','begin','send']);
});
