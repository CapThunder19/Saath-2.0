import type { Metadata } from "next";
import TicketLookup from "@/components/TicketLookup";

export const metadata: Metadata = { title: "View ticket" };

export default function TicketLookupPage() {
  return (
    <main className="form-page">
      <div className="container">
        <TicketLookup />
      </div>
    </main>
  );
}
