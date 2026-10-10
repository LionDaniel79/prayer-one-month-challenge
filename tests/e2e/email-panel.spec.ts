import {test,expect} from '@playwright/test';
import {login,expectNoOverflow} from './helpers';
test('email settings open from consent redirect and fit desktop',async({page},info)=>{
 test.skip(process.env.E2E_DATABASE_READY!=='1','Disposable CI only');
 await login(page,'admin');
 await page.route('**/api/admin/email-notifications',route=>route.fulfill({json:{recipient:'admin@example.test',enabled:false,connected:true,googleEmail:'admin@example.test',verified:false,configured:true,production:true,counts:{pending:0,sent:0,failed:0,unknown:0},lastError:null}}));
 await page.setViewportSize({width:1280,height:900});
 await page.goto('/admin?email=connected#email-notifications');
 const panel=page.locator('#email-notifications');
 await expect(panel).toHaveAttribute('open','');
 await expect(panel.getByRole('button',{name:'확인 메일 보내기'})).toBeVisible();
 await expect(panel.getByLabel('접수 이메일 알림 사용')).toBeDisabled();
 await expect(panel.getByRole('link',{name:'이메일 알림 개인정보 이용 안내'})).toHaveAttribute('href','/privacy#email-notifications');
 await expectNoOverflow(page);await page.screenshot({path:info.outputPath('email-panel-1280.png'),fullPage:true});
 await page.setViewportSize({width:360,height:820});await expectNoOverflow(page);
 await page.screenshot({path:info.outputPath('email-panel-360.png'),fullPage:true});
});
