import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { removeRegistration } from "@/lib/storage";

// Permanently deletes a registration (all its members and photos).
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Please sign in as admin." }, { status: 401 });

  const { registrationId } = (await req.json().catch(() => ({}))) as { registrationId?: string };
  if (!registrationId) return NextResponse.json({ error: "Registration not found." }, { status: 404 });

  try {
    const removed = await removeRegistration(registrationId);
    if (!removed) return NextResponse.json({ error: "Registration not found (it may already be removed)." }, { status: 404 });
    return NextResponse.json({ removed: registrationId });
  } catch (err) {
    console.error("Remove failed", err);
    return NextResponse.json({ error: "Could not remove. Please try again." }, { status: 500 });
  }
}
