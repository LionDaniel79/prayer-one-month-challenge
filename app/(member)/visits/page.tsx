import { redirect } from "next/navigation";
import { VisitBookingClient } from "../../../components/visits/VisitBookingClient";
import { getCurrentSessionUser } from "../../../src/features/auth/http-session";

export default async function VisitsPage() {
  const user = await getCurrentSessionUser();
  if (!user) redirect("/login");

  return (
    <main className="shell visit-page-shell">
      <section className="feature-heading">
        <p className="eyebrow">상담 & 심방</p>
        <h2>심방신청</h2>
        <p>가능한 날짜를 선택하면 신청 내용을 입력할 수 있습니다.</p>
      </section>

      <VisitBookingClient requesterName={user.displayName} />
    </main>
  );
}
