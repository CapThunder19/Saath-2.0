import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { sameName } from "@/lib/tickets";

// The admin signs in through "View ticket" with ADMIN_ADMISSION_NO + ADMIN_NAME
// (set in .env.local). A signed cookie then keeps them signed in for 12 hours.

const COOKIE = "huhc_admin";
const SESSION_HOURS = 12;

function secret() {
  const s = process.env.TICKET_SECRET;
  if (s) return s + ":admin";
  if (process.env.NODE_ENV === "production") throw new Error("TICKET_SECRET must be set in production.");
  return "dev-only-admin-secret";
}

const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function isAdminLogin(admissionNo: string, name: string) {
  const id = process.env.ADMIN_ADMISSION_NO;
  const adminName = process.env.ADMIN_NAME;
  if (!id || !adminName) return false;
  return safeEqual(admissionNo.trim().toUpperCase(), id.trim().toUpperCase()) && sameName(name, adminName);
}

export async function startAdminSession() {
  const expires = Date.now() + SESSION_HOURS * 3600 * 1000;
  (await cookies()).set(COOKIE, `${expires}.${sign(String(expires))}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endAdminSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [expires, sig] = value.split(".");
  return !!sig && Number(expires) > Date.now() && safeEqual(sig, sign(expires));
}
