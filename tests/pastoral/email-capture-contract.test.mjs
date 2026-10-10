import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('submission capture is authorized by transaction-local server runtime, never browser data',()=>{
 const db=read('src/db/client.ts');assert.match(db,/set_config\('prayer_app.email_capture'/u);assert.match(db,/VERCEL_ENV/u);
 const migration=read('drizzle/20261010010000_submission_email_notifications.sql');assert.match(migration,/current_setting\('prayer_app.email_capture'/u);
 assert.match(read('src/features/prayer-requests/service.ts'),/getDb\(\).transaction/u);
 assert.match(read('src/features/visits/service.ts'),/async markSynced[\s\S]*?getDb\(\).transaction/u);
});
test('capture serializes with disabling and rejects long-expired source events',()=>{
 const migration=read('drizzle/20261010010000_submission_email_notifications.sql');
 assert.match(migration,/select \* into cfg from prayer_app.email_notification_settings where id=1 for share/u);
 assert.match(migration,/NEW.created_at<now\(\)-interval '7 days'/u);
});
