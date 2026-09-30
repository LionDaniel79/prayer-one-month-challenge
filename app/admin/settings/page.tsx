import { redirect } from "next/navigation";

/** Preserve old bookmarks; there is no separate Settings menu anymore. */
export default function AdminSettingsPage() {
  redirect("/admin/visits#google-calendar");
}
