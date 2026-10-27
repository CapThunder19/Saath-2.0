import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";
import { isAdmin } from "@/lib/admin";
import { checkInSetupNeeded, listRegistrations, type AdminRegistration } from "@/lib/storage";
import { ticketPath } from "@/lib/tickets";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) redirect("/ticket");

  let registrations: (AdminRegistration & { ticketLinks: string[] })[] = [];
  let error = "";
  const setupNeeded = await checkInSetupNeeded().catch(() => false);
  try {
    registrations = (await listRegistrations()).map((r) => ({
      ...r,
      ticketLinks: r.members.map((m) => ticketPath(r.registrationId, m.memberNo)),
    }));
  } catch (err) {
    console.error("Admin list failed", err);
    error = "Could not load registrations. Check that the latest Apps Script is deployed, then refresh.";
  }

  return (
    <main className="form-page">
      <div className="container admin-container">
        <AdminDashboard initial={registrations} error={error} checkInSetupNeeded={setupNeeded} />
      </div>
    </main>
  );
}
