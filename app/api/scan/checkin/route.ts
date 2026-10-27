import { NextResponse } from "next/server";
import { canScan } from "@/lib/admin";
import { BusyError, checkIn, findMember } from "@/lib/storage";
import { parseTicketLink, verifyTicket } from "@/lib/tickets";

// Gate check-in. Body: { qr: "<scanned ticket link>" } or { admissionNo } (manual fallback).
// status: OK | ALREADY_IN | NOT_APPROVED | NOT_FOUND | FORGED | INVALID
export async function POST(req: Request) {
  if (!(await canScan())) return NextResponse.json({ error: "Please sign in as scanner or admin." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { qr?: unknown; admissionNo?: unknown };

  let registrationId: string;
  let memberNo: number;
  if (typeof body.qr === "string") {
    const t = parseTicketLink(body.qr);
    if (!t) return NextResponse.json({ status: "INVALID" });
    // A real ticket always carries a valid signature; anything else was made up or edited.
    if (!verifyTicket(t.ticketId, t.token)) return NextResponse.json({ status: "FORGED", ticketId: t.ticketId });
    ({ registrationId, memberNo } = t);
  } else if (typeof body.admissionNo === "string" && body.admissionNo.trim()) {
    const m = await findMember(body.admissionNo.trim().toUpperCase()).catch(() => null);
    if (!m) return NextResponse.json({ status: "NOT_FOUND" });
    ({ registrationId, memberNo } = m);
  } else {
    return NextResponse.json({ status: "INVALID" });
  }

  try {
    const result = await checkIn(registrationId, memberNo);
    const photo = "member" in result ? `/api/admin/photo?id=${registrationId}-${memberNo}` : undefined;
    return NextResponse.json({ ...result, photo });
  } catch (err) {
    console.error("Check-in failed", err);
    const msg = err instanceof BusyError ? "Connection problem. Scan again." : "Could not check this ticket. Scan again.";
    return NextResponse.json({ status: "ERROR", error: msg }, { status: 503 });
  }
}
