import { NextResponse } from "next/server";
import { isAdminLogin, isScannerLogin, startAdminSession, startScannerSession } from "@/lib/admin";
import { findMember, findMembersByPhone } from "@/lib/storage";
import { sameName, ticketPath } from "@/lib/tickets";

const NOT_FOUND =
  "No registration found with these details. Check your admission number or mobile number, and enter your name exactly as you registered.";

// (Admission number or mobile number) + name → the member's ticket link (once approved),
// or the admin dashboard / gate scanner for those sign-in details.
export async function POST(req: Request) {
  let body: { admissionNo?: unknown; phone?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const admissionNo = typeof body.admissionNo === "string" ? body.admissionNo.trim().toUpperCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.replace(/\D/g, "").slice(-10) : "";
  const name = typeof body.name === "string" ? body.name : "";
  if ((!admissionNo && !phone) || !name.trim()) {
    return NextResponse.json({ error: "Please enter your admission number or mobile number, and your name." }, { status: 400 });
  }
  if (!admissionNo && !/^[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json({ error: "Please enter a valid 10-digit mobile number." }, { status: 400 });
  }

  if (admissionNo && isAdminLogin(admissionNo, name)) {
    await startAdminSession();
    return NextResponse.json({ admin: true });
  }
  if (admissionNo && isScannerLogin(admissionNo, name)) {
    await startScannerSession();
    return NextResponse.json({ scanner: true });
  }

  try {
    // By mobile number: pick the member with that number whose name matches.
    let lookupAdmission = admissionNo;
    if (!lookupAdmission) {
      const match = (await findMembersByPhone(phone)).find((m) => sameName(m.name, name));
      if (!match) return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
      lookupAdmission = match.admissionNo;
    }
    const member = await findMember(lookupAdmission);
    // Same message for "no such admission number" and "wrong name", so the form
    // can't be used to discover who has registered.
    if (!member || !sameName(member.name, name)) return NextResponse.json({ error: NOT_FOUND }, { status: 404 });
    return NextResponse.json({
      name: member.name,
      registrationId: member.registrationId,
      memberNo: member.memberNo,
      teamSize: member.teamSize,
      status: member.status,
      // The ticket link is only revealed after an admin approves the registration.
      url: member.status === "Approved" ? ticketPath(member.registrationId, member.memberNo) : null,
    });
  } catch (err) {
    console.error("Ticket lookup failed", err);
    return NextResponse.json({ error: "Could not look up your ticket. Please try again." }, { status: 500 });
  }
}
