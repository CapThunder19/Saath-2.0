import { NextResponse } from "next/server";
import { isAdminLogin, startAdminSession } from "@/lib/admin";
import { findMember } from "@/lib/storage";
import { sameName, ticketPath } from "@/lib/tickets";

const NOT_FOUND = "No registration found with these details. Check your admission number and enter your name exactly as you registered.";

// Admission number + name → the member's ticket link (once approved), or the admin dashboard.
export async function POST(req: Request) {
  let body: { admissionNo?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const admissionNo = typeof body.admissionNo === "string" ? body.admissionNo.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name : "";
  if (!admissionNo || !name.trim()) {
    return NextResponse.json({ error: "Please enter your admission number and name." }, { status: 400 });
  }

  if (isAdminLogin(admissionNo, name)) {
    await startAdminSession();
    return NextResponse.json({ admin: true });
  }

  try {
    const member = await findMember(admissionNo);
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
