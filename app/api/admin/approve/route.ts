import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { ticketEmail } from "@/lib/email";
import { approveRegistration, listRegistrations } from "@/lib/storage";
import { ticketPath } from "@/lib/tickets";

export const maxDuration = 60;

// Approves a registration and emails every member their own ticket link.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Please sign in as admin." }, { status: 401 });

  const { registrationId } = (await req.json().catch(() => ({}))) as { registrationId?: string };
  try {
    const reg = (await listRegistrations()).find((r) => r.registrationId === registrationId);
    if (!reg) return NextResponse.json({ error: "Registration not found." }, { status: 404 });

    const site = (process.env.SITE_URL || new URL(req.url).origin).replace(/\/$/, "");
    const emails = reg.members.map((m) =>
      ticketEmail({
        to: m.email,
        name: m.name,
        registrationId: reg.registrationId,
        memberNo: m.memberNo,
        teamSize: reg.members.length,
        link: site + ticketPath(reg.registrationId, m.memberNo),
      }),
    );

    const result = await approveRegistration(reg.registrationId, emails);
    if (!result) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    return NextResponse.json({ status: "Approved", approvedAt: result.approvedAt, emailed: emails.length });
  } catch (err) {
    console.error("Approve failed", err);
    return NextResponse.json({ error: "Could not approve. Please try again." }, { status: 500 });
  }
}
