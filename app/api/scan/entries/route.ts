import { NextResponse } from "next/server";
import { canScan } from "@/lib/admin";
import { listEntries, listRegistrations } from "@/lib/storage";

// Live entry list for the scanner page, plus how many approved members are expected.
export async function GET() {
  if (!(await canScan())) return NextResponse.json({ error: "Please sign in as scanner or admin." }, { status: 401 });
  try {
    const [entries, regs] = await Promise.all([listEntries(), listRegistrations()]);
    const expected = regs.filter((r) => r.status === "Approved").reduce((n, r) => n + r.members.length, 0);
    return NextResponse.json({ entries, expected }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Entries list failed", err);
    return NextResponse.json({ error: "Could not load entries." }, { status: 500 });
  }
}
