import { PrayerRequestForm } from "../../../components/prayer-requests/PrayerRequestForm";

export default function PrayerRequestsPage() {
  return (
    <main className="shell">
      <section className="feature-heading">
        <h2>기도요청</h2>
      </section>
      <PrayerRequestForm />
    </main>
  );
}
