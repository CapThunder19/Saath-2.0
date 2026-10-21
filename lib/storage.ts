import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Member } from "@/lib/registration";

/**
 * With SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set, registrations live in Supabase
 * (tables + functions from supabase/schema.sql) and photos in its "member-photos"
 * storage bucket. Without them (local development), everything is saved under ./data.
 */

export type Photo = { bytes: Buffer; ext: string; mimeType: string };
export type NewRegistration = {
  registrationId: string;
  teamType: string;
  amount: number;
  txnId: string;
  members: Member[];
  photos: Photo[];
};
export type Status = "Pending" | "Approved";

/** The database couldn't be reached or was overloaded; safe to retry shortly. */
export class BusyError extends Error {}

// ok, or the indexes of members whose admission number is already registered,
// or duplicateTxn when the payment's transaction ID was already used.
export type SaveResult = { ok: true } | { ok: false; duplicates: number[]; duplicateTxn?: boolean };

export type FoundMember = { registrationId: string; memberNo: number; teamSize: number; name: string; status: Status };
export type TicketData = { name: string; branch: string; teamSize: number; status: Status; photo: string /* data URL */ };
export type AdminRegistration = {
  registrationId: string;
  submittedAt: string;
  teamType: string;
  status: Status;
  approvedAt: string;
  amount: string;
  txnId: string;
  members: (Member & { memberNo: number })[];
};

const BUCKET = "member-photos";

export async function saveRegistration(reg: NewRegistration): Promise<SaveResult> {
  const db = supabase();
  if (!db) return saveLocally(reg);

  // Same path on every retry of one submission, so a repeat just overwrites it.
  const paths = reg.photos.map((p, i) => `${reg.registrationId}-${i + 1}.${p.ext}`);
  await Promise.all(
    reg.photos.map(async (p, i) => {
      const { error } = await db.storage.from(BUCKET).upload(paths[i], p.bytes, { contentType: p.mimeType, upsert: true });
      if (error) throw busyOr(error, "Photo upload failed");
    }),
  );

  const result = await rpc<{ ok: boolean; repeat?: boolean; duplicates?: number[]; duplicateTxn?: boolean }>(db, "register_team", {
    p_id: reg.registrationId,
    p_team_type: reg.teamType,
    p_amount: reg.amount,
    p_txn_id: reg.txnId,
    p_members: reg.members.map((m, i) => ({ ...m, photoPath: paths[i] })),
  });
  // If the call itself failed, the photos are kept on purpose: the registration may
  // have been saved and only the reply lost, and the retry reuses the same paths.

  if (result?.ok) return { ok: true };
  await db.storage.from(BUCKET).remove(paths); // refused: these photos belong to nothing
  return { ok: false, duplicates: result?.duplicates ?? [], duplicateTxn: result?.duplicateTxn };
}

/** Which of these admission numbers are already registered (indexes into the list). */
export async function checkAdmissions(admissionNos: string[]): Promise<number[]> {
  const db = supabase();
  if (db) return (await rpc<number[]>(db, "check_admissions", { p_admissions: admissionNos })) ?? [];
  const taken = new Set((await readLocal()).flatMap((r) => r.members.map((m) => m.admissionNo)));
  return admissionNos.map((a, i) => (taken.has(a.trim().toUpperCase()) ? i : -1)).filter((i) => i >= 0);
}

/** Finds the registered member with this admission number, if any. */
export async function findMember(admissionNo: string): Promise<FoundMember | null> {
  const db = supabase();
  if (db) return rpc<FoundMember>(db, "find_member", { p_admission: admissionNo });
  for (const r of await readLocal()) {
    const i = r.members.findIndex((m) => m.admissionNo === admissionNo);
    if (i >= 0) {
      return { registrationId: r.registrationId, memberNo: i + 1, teamSize: r.members.length, name: r.members[i].name, status: statusOf(r) };
    }
  }
  return null;
}

/** Everything needed to draw one member's ticket, including their photo. */
export async function getTicket(registrationId: string, memberNo: number): Promise<TicketData | null> {
  const db = supabase();
  if (db) {
    const m = await rpc<Omit<TicketData, "photo"> & { photoPath: string }>(db, "get_member", {
      p_id: registrationId,
      p_member_no: memberNo,
    });
    if (!m) return null;
    const { data, error } = await db.storage.from(BUCKET).download(m.photoPath);
    let photo = "";
    if (data && !error) photo = `data:${data.type || "image/jpeg"};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}`;
    return { name: m.name, branch: m.branch, teamSize: m.teamSize, status: m.status, photo };
  }

  const r = (await readLocal()).find((x) => x.registrationId === registrationId);
  const m = r?.members[memberNo - 1];
  if (!r || !m) return null;
  const bytes = await fs.readFile(path.join(DATA_DIR, m.photo));
  const ext = path.extname(m.photo).slice(1);
  const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  return {
    name: m.name,
    branch: m.branch,
    teamSize: r.members.length,
    status: statusOf(r),
    photo: `data:${mime};base64,${bytes.toString("base64")}`,
  };
}

/** All registrations, newest first, for the admin dashboard and Excel export (no photos). */
export async function listRegistrations(): Promise<AdminRegistration[]> {
  const db = supabase();
  if (db) return (await rpc<AdminRegistration[]>(db, "list_registrations", {})) ?? [];
  return (await readLocal())
    .map((r) => ({
      registrationId: r.registrationId,
      submittedAt: r.submittedAt,
      teamType: r.teamType,
      status: statusOf(r),
      approvedAt: r.approvedAt ?? "",
      amount: String(r.amount ?? ""),
      txnId: r.txnId ?? "",
      members: r.members.map(({ photo: _photo, ...m }, i) => ({ ...m, memberNo: i + 1 })),
    }))
    .reverse();
}

/** Marks a registration approved, so its members can open their tickets. */
export async function approveRegistration(registrationId: string): Promise<{ approvedAt: string } | null> {
  const db = supabase();
  if (db) return rpc(db, "approve_registration", { p_id: registrationId });

  const regs = await readLocal();
  const r = regs.find((x) => x.registrationId === registrationId);
  if (!r) return null;
  r.status = "Approved";
  r.approvedAt = new Date().toISOString();
  await fs.writeFile(DATA_FILE, JSON.stringify(regs, null, 2));
  return { approvedAt: r.approvedAt };
}

// ---------- Supabase ----------

let client: SupabaseClient | null | undefined;

function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production.");
  } else {
    client = null;
  }
  return client;
}

async function rpc<T>(db: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T | null> {
  const { data, error, status } = await db.rpc(fn, args);
  if (error) throw busyOr(error, `Database call ${fn} failed`, status);
  return (data as T) ?? null;
}

// Network failures, timeouts and 5xx/429 answers are temporary: let the caller retry.
function busyOr(error: { message?: string }, context: string, status?: number) {
  const msg = `${context}: ${error.message ?? "unknown error"}`;
  if (!status || status >= 500 || status === 429 || /fetch failed|timeout|network|ECONN/i.test(error.message ?? "")) {
    return new BusyError(msg);
  }
  return new Error(msg);
}

// ---------- Local development storage ----------

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "registrations.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

type StoredRegistration = Omit<NewRegistration, "photos" | "members" | "amount" | "txnId"> & {
  amount?: number;
  txnId?: string;
  submittedAt: string;
  status?: Status;
  approvedAt?: string;
  members: (Member & { photo: string })[];
};

const statusOf = (r: StoredRegistration): Status => (r.status === "Approved" ? "Approved" : "Pending");

async function readLocal(): Promise<StoredRegistration[]> {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

async function saveLocally(reg: NewRegistration): Promise<SaveResult> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const existing = await readLocal();

  if (existing.some((r) => r.registrationId === reg.registrationId)) return { ok: true }; // retry of a saved submission
  const taken = new Set(existing.flatMap((r) => (r.members ?? []).map((m) => m.admissionNo)));
  const duplicates = reg.members.map((m, i) => (taken.has(m.admissionNo) ? i : -1)).filter((i) => i >= 0);
  if (duplicates.length) return { ok: false, duplicates };
  if (existing.some((r) => r.txnId === reg.txnId)) return { ok: false, duplicates: [], duplicateTxn: true };

  const members = [];
  for (let i = 0; i < reg.members.length; i++) {
    const file = `${reg.registrationId}-${i + 1}.${reg.photos[i].ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, file), reg.photos[i].bytes);
    members.push({ ...reg.members[i], photo: `uploads/${file}` });
  }
  existing.push({
    registrationId: reg.registrationId,
    teamType: reg.teamType,
    amount: reg.amount,
    txnId: reg.txnId,
    submittedAt: new Date().toISOString(),
    status: "Pending",
    members,
  });
  await fs.writeFile(DATA_FILE, JSON.stringify(existing, null, 2));
  return { ok: true };
}
