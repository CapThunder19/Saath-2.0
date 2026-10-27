import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { checkInMember } from "@/lib/storage";

// Admin dashboard "Check in" button: records when an approved member arrived (once).
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Please sign in as admin." }, { status: 401 });
  const { registrationId, memberNo } = (await req.json().catch(() => ({}))) as { registrationId?: string; memberNo?: number };
  if (!registrationId || !Number.isInteger(memberNo)) return NextResponse.json({ status: "NOT_FOUND" });

  try {
    return NextResponse.json(await checkInMember(registrationId, memberNo!));
  } catch (err) {
    console.error("Check-in failed", err);
    return NextResponse.json({ error: "Could not check in. Please try again." }, { status: 500 });
  }
}
