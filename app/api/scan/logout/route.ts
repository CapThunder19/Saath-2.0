import { NextResponse } from "next/server";
import { endScannerSession } from "@/lib/admin";

export async function POST() {
  await endScannerSession();
  return NextResponse.json({ ok: true });
}
