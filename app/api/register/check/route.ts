import { NextResponse } from "next/server";
import { checkAdmissions } from "@/lib/storage";

// Checked before the payment step, so nobody pays for a registration that would
// then be refused as "already registered". The final submit checks again.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { admissionNos?: unknown };
  const admissionNos = Array.isArray(body.admissionNos) ? body.admissionNos.slice(0, 3).map((a) => String(a).trim().toUpperCase()) : [];
  if (admissionNos.length === 0) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    return NextResponse.json({ taken: await checkAdmissions(admissionNos) });
  } catch (err) {
    console.error("Admission check failed", err);
    return NextResponse.json({ error: "Could not check your details right now. Please try again." }, { status: 500 });
  }
}
