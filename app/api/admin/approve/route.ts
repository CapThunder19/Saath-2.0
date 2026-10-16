import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { approveRegistration, listRegistrations } from "@/lib/storage";

export const maxDuration = 60;

// Approves a registration; its members can then open their tickets from "View ticket".
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Please sign in as admin." }, { status: 401 });

  const { registrationId } = (await req.json().catch(() => ({}))) as { registrationId?: string };
  if (!registrationId) return NextResponse.json({ error: "Registration not found." }, { status: 404 });

  try {
    const result = await approveRegistration(registrationId);
    if (!result) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    return NextResponse.json({ status: "Approved", approvedAt: result.approvedAt });
  } catch (err) {
    console.error("Approve failed", err);
    // The sheet may have been updated even though the reply was lost (e.g. a timeout),
    // so check before reporting a failure.
    const now = await listRegistrations()
      .then((regs) => regs.find((r) => r.registrationId === registrationId))
      .catch(() => undefined);
    if (now?.status === "Approved") return NextResponse.json({ status: "Approved", approvedAt: now.approvedAt });
    return NextResponse.json({ error: "Could not approve. Please try again." }, { status: 500 });
  }
}
