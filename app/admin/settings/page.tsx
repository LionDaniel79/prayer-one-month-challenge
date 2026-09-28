import {
  requireGoogleCalendarConfig,
  requireWebPushConfig,
} from "../../../src/lib/env";
import { GoogleCalendarSettings } from "../../../components/admin/settings/GoogleCalendarSettings";
import { PushSettingsStatus } from "../../../components/admin/settings/PushSettingsStatus";

function hasConfig(check: () => unknown) {
  try {
    check();
    return true;
  } catch {
    return false;
  }
}

export default function AdminSettingsPage() {
  const googleConfigured = hasConfig(requireGoogleCalendarConfig);
  const pushConfigured = hasConfig(requireWebPushConfig);

  return (
    <main className="admin-shell">
      <div className="admin-settings-page">
        <section className="admin-page-heading">
          <p className="eyebrow">운영 설정</p>
          <h1>설정</h1>
          <p>Google Calendar 연동과 서버 알림 상태를 관리합니다.</p>
        </section>

        <GoogleCalendarSettings configured={googleConfigured} />
        <PushSettingsStatus configured={pushConfigured} />
      </div>
    </main>
  );
}
