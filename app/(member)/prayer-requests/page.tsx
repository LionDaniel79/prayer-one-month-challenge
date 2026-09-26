import { PrayerRequestForm } from "../../../components/prayer-requests/PrayerRequestForm";

export default function PrayerRequestsPage() {
  return (
    <main className="shell">
      <section className="feature-heading">
        <p className="eyebrow">중보기도</p>
        <h2>기도요청</h2>
      </section>
      <PrayerRequestForm />
    </main>
  );
}
