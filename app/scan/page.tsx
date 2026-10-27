import type { Metadata } from "next";
import { redirect } from "next/navigation";
import TicketScanner from "@/components/TicketScanner";
import { canScan, isAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Ticket scanner", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ScanPage() {
  if (!(await canScan())) redirect("/ticket");
  return (
    <main className="form-page">
      <div className="container scan-container">
        <TicketScanner isAdmin={await isAdmin()} />
      </div>
    </main>
  );
}
