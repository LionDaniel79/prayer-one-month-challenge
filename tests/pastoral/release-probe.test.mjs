import test from 'node:test';
import assert from 'node:assert/strict';
import * as probe from '../../scripts/verify-production.mjs';
const { productionDeployment, deploymentOrigin } = probe;
const sample={id:1,sha:'a'.repeat(40),environment:'Production',creator:{login:'vercel[bot]'}};
test('production selection requires correct commit, provider and production target',()=>{
 assert.equal(productionDeployment([sample],'a'.repeat(40)).id,1);
 for(const changed of [{environment:'Preview'},{sha:'b'.repeat(40)},{creator:{login:'unknown'}}])assert.equal(productionDeployment([{...sample,...changed}],'a'.repeat(40)),undefined);
});
test('production URLs never include credentials or GitHub tokens; allow Vercel or explicit custom origin',()=>{
 assert.equal(deploymentOrigin('https://app.vercel.app/path'),'https://app.vercel.app');
 assert.equal(deploymentOrigin('https://church.example/a','https://church.example'),'https://church.example');
 for(const value of ['http://app.vercel.app','https://u:p@app.vercel.app','https://api.github.com','https://app.vercel.app.evil.test','https://localhost','https://127.0.0.1'])assert.throws(()=>deploymentOrigin(value));
});

test('public readiness uses the configured domain or repository homepage, not protected deployment URLs',()=>{
 assert.equal(typeof probe.publicVerificationOrigin,'function');
 const generated='https://app-random-team.vercel.app';
 assert.equal(probe.publicVerificationOrigin(generated,undefined,'https://app.vercel.app'),'https://app.vercel.app');
 assert.equal(probe.publicVerificationOrigin(generated,'https://church.example','https://app.vercel.app'),'https://church.example');
 assert.equal(probe.publicVerificationOrigin(generated,undefined,null),generated);
});
test('invalid public destinations fail closed without trying protected URL alternatives',()=>{
 assert.equal(typeof probe.publicVerificationOrigin,'function');
 for(const value of ['http://app.vercel.app','https://u:p@app.vercel.app','https://app.vercel.app:444','https://api.github.com','https://localhost'])
   assert.throws(()=>probe.publicVerificationOrigin('https://app-deploy.vercel.app',undefined,value));
 assert.throws(()=>probe.publicVerificationOrigin('https://app-deploy.vercel.app','http://church.example','https://app.vercel.app'));
});
