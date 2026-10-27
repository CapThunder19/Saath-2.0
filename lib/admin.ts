import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { sameName } from "@/lib/tickets";

// Two sign-ins, both typed into "View ticket" (admission number + name), set in .env.local:
//   admin   — ADMIN_ADMISSION_NO + ADMIN_NAME     → dashboard (approve, remove, Excel) + scanner
//   scanner — SCANNER_ADMISSION_NO + SCANNER_NAME → ticket scanner only (for gate volunteers)
// A signed cookie then keeps each one signed in for 12 hours.

type Role = "admin" | "scanner";
const COOKIE: Record<Role, string> = { admin: "huhc_admin", scanner: "huhc_scanner" };
const SESSION_HOURS = 12;

function secret() {
  const s = process.env.TICKET_SECRET;
  if (s) return s + ":admin";
  if (process.env.NODE_ENV === "production") throw new Error("TICKET_SECRET must be set in production.");
  return "dev-only-admin-secret";
}

// The role is part of what's signed, so a scanner cookie can never pass as an admin one.
const sign = (role: Role, expires: string) =>
  createHmac("sha256", secret()).update(role === "admin" ? expires : `${role}:${expires}`).digest("base64url");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function matches(admissionNo: string, name: string, idVar: string | undefined, nameVar: string | undefined) {
  if (!idVar || !nameVar) return false;
  return safeEqual(admissionNo.trim().toUpperCase(), idVar.trim().toUpperCase()) && sameName(name, nameVar);
}

async function startSession(role: Role) {
  const expires = String(Date.now() + SESSION_HOURS * 3600 * 1000);
  (await cookies()).set(COOKIE[role], `${expires}.${sign(role, expires)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

async function hasSession(role: Role) {
  const value = (await cookies()).get(COOKIE[role])?.value;
  if (!value) return false;
  const [expires, sig] = value.split(".");
  return !!sig && Number(expires) > Date.now() && safeEqual(sig, sign(role, expires));
}

export const isAdminLogin = (admissionNo: string, name: string) =>
  matches(admissionNo, name, process.env.ADMIN_ADMISSION_NO, process.env.ADMIN_NAME);
export const isScannerLogin = (admissionNo: string, name: string) =>
  matches(admissionNo, name, process.env.SCANNER_ADMISSION_NO, process.env.SCANNER_NAME);

export const startAdminSession = () => startSession("admin");
export const startScannerSession = () => startSession("scanner");

export async function endAdminSession() {
  (await cookies()).delete(COOKIE.admin);
}
export async function endScannerSession() {
  (await cookies()).delete(COOKIE.scanner);
}

export const isAdmin = () => hasSession("admin");
/** Gate volunteers and admins may use the ticket scanner. */
export async function canScan() {
  return (await hasSession("scanner")) || (await hasSession("admin"));
}
