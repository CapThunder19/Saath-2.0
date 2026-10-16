import type { Metadata } from "next";
import Link from "next/link";
import TicketView from "@/components/TicketView";
import VerificationPending from "@/components/VerificationPending";
import { isAdmin } from "@/lib/admin";
import { getTicket } from "@/lib/storage";
import { parseTicketId, verifyTicket } from "@/lib/tickets";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> };

export const metadata: Metadata = { title: "Your ticket", robots: { index: false } };

export default async function TicketPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { t } = await searchParams;
  const parsed = parseTicketId(id);

  let ticket = null;
  let failed = false;
  if (parsed && verifyTicket(id, t)) {
    try {
      ticket = await getTicket(parsed.registrationId, parsed.memberNo);
    } catch (err) {
      console.error("Ticket page failed", err);
      failed = true;
    }
  }

  if (ticket && ticket.status !== "Approved" && !(await isAdmin())) {
    return (
      <main className="form-page">
        <div className="container">
          <VerificationPending registrationId={parsed!.registrationId} />
        </div>
      </main>
    );
  }

  return (
    <main className="form-page">
      <div className="container">
        {ticket && parsed ? (
          <TicketView
            name={ticket.name}
            branch={ticket.branch}
            photo={ticket.photo}
            registrationId={parsed.registrationId}
            memberNo={parsed.memberNo}
            teamSize={ticket.teamSize}
            approved={ticket.status === "Approved"}
          />
        ) : (
          <div className="form-wrapper">
            <div className="success">
              <h2>{failed ? "Couldn't load your ticket" : "Ticket not found"}</h2>
              <p>
                {failed
                  ? "Something went wrong on our side. Please try again in a minute."
                  : "This ticket link is invalid or the registration no longer exists."}
              </p>
              <Link href="/ticket" className="btn btn-primary" style={{ marginTop: 20 }}>
                Find my ticket
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
