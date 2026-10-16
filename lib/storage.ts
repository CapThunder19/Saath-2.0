import { promises as fs } from "fs";
import path from "path";
import type { Member } from "@/lib/registration";

/**
 * With GOOGLE_SCRIPT_URL and GOOGLE_SCRIPT_SECRET set, registrations live in the Google
 * Sheet and photos in Drive (see google-apps-script/Code.gs). Without them (local
 * development), everything is saved under ./data instead.
 */

export type Photo = { bytes: Buffer; ext: string; mimeType: string };
export type NewRegistration = { registrationId: string; teamType: string; members: Member[]; photos: Photo[] };
export type Status = "Pending" | "Approved";

// ok, or the indexes of members whose admission number is already registered.
export type SaveResult = { ok: true } | { ok: false; duplicates: number[] };

export type FoundMember = { registrationId: string; memberNo: number; teamSize: number; name: string; status: Status };
export type TicketData = { name: string; branch: string; teamSize: number; status: Status; photo: string /* data URL */ };
export type AdminRegistration = {
  registrationId: string;
  submittedAt: string;
  teamType: string;
  status: Status;
  approvedAt: string;
  members: (Member & { memberNo: number })[];
};

export function saveRegistration(reg: NewRegistration): Promise<SaveResult> {
  const google = googleConfig();
  if (!google) return saveLocally(reg);
  return callGoogle<SaveResult>(google, {
    registrationId: reg.registrationId,
    teamType: reg.teamType,
    members: reg.members.map((m, i) => ({
      ...m,
      photo: { data: reg.photos[i].bytes.toString("base64"), ext: reg.photos[i].ext, mimeType: reg.photos[i].mimeType },
    })),
  }).then((r) => r ?? { ok: true });
}

/** Finds the registered member with this admission number, if any. */
export async function findMember(admissionNo: string): Promise<FoundMember | null> {
  const google = googleConfig();
  if (google) return callGoogle(google, { action: "lookup", admissionNo });
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
  const google = googleConfig();
  if (google) return callGoogle(google, { action: "ticket", registrationId, memberNo });
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

/** All registrations, newest first, for the admin dashboard (no photos). */
export async function listRegistrations(): Promise<AdminRegistration[]> {
  const google = googleConfig();
  const regs: AdminRegistration[] = google
    ? ((await callGoogle<AdminRegistration[]>(google, { action: "list" })) ?? [])
    : (await readLocal()).map((r) => ({
        registrationId: r.registrationId,
        submittedAt: r.submittedAt,
        teamType: r.teamType,
        status: statusOf(r),
        approvedAt: r.approvedAt ?? "",
        members: r.members.map(({ photo: _photo, ...m }, i) => ({ ...m, memberNo: i + 1 })),
      }));
  return regs.reverse();
}

/** Marks a registration approved, so its members can open their tickets. */
export async function approveRegistration(registrationId: string): Promise<{ approvedAt: string } | null> {
  const google = googleConfig();
  if (google) return callGoogle(google, { action: "approve", registrationId });

  const regs = await readLocal();
  const r = regs.find((x) => x.registrationId === registrationId);
  if (!r) return null;
  r.status = "Approved";
  r.approvedAt = new Date().toISOString();
  await fs.writeFile(DATA_FILE, JSON.stringify(regs, null, 2));
  return { approvedAt: r.approvedAt };
}

// ---------- Google Apps Script ----------

function googleConfig() {
  const url = process.env.GOOGLE_SCRIPT_URL;
  const secret = process.env.GOOGLE_SCRIPT_SECRET;
  if (url && secret) return { url, secret };
  if (process.env.NODE_ENV === "production") {
    throw new Error("GOOGLE_SCRIPT_URL and GOOGLE_SCRIPT_SECRET must be set in production.");
  }
  return null;
}

async function callGoogle<T>({ url, secret }: { url: string; secret: string }, payload: object): Promise<T | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    redirect: "follow", // Apps Script answers via a redirect to googleusercontent.com
    cache: "no-store",
    body: JSON.stringify({ secret, ...payload }),
  });
  const text = await res.text();
  let json: { ok?: boolean; result?: T; duplicates?: number[]; error?: string };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Google Apps Script returned non-JSON (status ${res.status}): ${text.slice(0, 200)}`);
  }
  if (json.duplicates) return { ok: false, duplicates: json.duplicates } as T;
  if (!json.ok) {
    // An old deployment doesn't know the newer actions and fails reading `members`.
    if (json.error?.includes("reading 'map'")) {
      throw new Error(
        "The deployed Apps Script is an old version. Paste the latest google-apps-script/Code.gs and redeploy (Deploy → Manage deployments → Edit → Version: New version).",
      );
    }
    throw new Error(`Google Apps Script error: ${json.error ?? "unknown"}`);
  }
  return json.result ?? null;
}

// ---------- Local development storage ----------

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "registrations.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

type StoredRegistration = Omit<NewRegistration, "photos" | "members"> & {
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

  const taken = new Set(existing.flatMap((r) => (r.members ?? []).map((m) => m.admissionNo)));
  const duplicates = reg.members.map((m, i) => (taken.has(m.admissionNo) ? i : -1)).filter((i) => i >= 0);
  if (duplicates.length) return { ok: false, duplicates };

  const members = [];
  for (let i = 0; i < reg.members.length; i++) {
    const file = `${reg.registrationId}-${i + 1}.${reg.photos[i].ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, file), reg.photos[i].bytes);
    members.push({ ...reg.members[i], photo: `uploads/${file}` });
  }
  existing.push({
    registrationId: reg.registrationId,
    teamType: reg.teamType,
    submittedAt: new Date().toISOString(),
    status: "Pending",
    members,
  });
  await fs.writeFile(DATA_FILE, JSON.stringify(existing, null, 2));
  return { ok: true };
}
