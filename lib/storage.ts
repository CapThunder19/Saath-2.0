import { promises as fs } from "fs";
import path from "path";
import type { Member } from "@/lib/registration";

export type Photo = { bytes: Buffer; ext: string; mimeType: string };
export type NewRegistration = { registrationId: string; teamType: string; members: Member[]; photos: Photo[] };

// ok, or the indexes of members whose admission number is already registered.
export type SaveResult = { ok: true } | { ok: false; duplicates: number[] };

/**
 * With GOOGLE_SCRIPT_URL and GOOGLE_SCRIPT_SECRET set, registrations go to the Google
 * Sheet and photos to Drive (see google-apps-script/Code.gs). Without them (local
 * development), they're saved under ./data instead.
 */
export function saveRegistration(reg: NewRegistration): Promise<SaveResult> {
  const url = process.env.GOOGLE_SCRIPT_URL;
  const secret = process.env.GOOGLE_SCRIPT_SECRET;
  if (url && secret) return saveToGoogle(url, secret, reg);
  if (process.env.NODE_ENV === "production") {
    throw new Error("GOOGLE_SCRIPT_URL and GOOGLE_SCRIPT_SECRET must be set in production.");
  }
  return saveLocally(reg);
}

async function saveToGoogle(url: string, secret: string, reg: NewRegistration): Promise<SaveResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    redirect: "follow", // Apps Script answers via a redirect to googleusercontent.com
    body: JSON.stringify({
      secret,
      registrationId: reg.registrationId,
      teamType: reg.teamType,
      members: reg.members.map((m, i) => ({
        ...m,
        photo: { data: reg.photos[i].bytes.toString("base64"), ext: reg.photos[i].ext, mimeType: reg.photos[i].mimeType },
      })),
    }),
  });
  const text = await res.text();
  let json: { ok?: boolean; duplicates?: number[]; error?: string };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Google Apps Script returned non-JSON (status ${res.status}): ${text.slice(0, 200)}`);
  }
  if (json.ok) return { ok: true };
  if (json.duplicates) return { ok: false, duplicates: json.duplicates };
  throw new Error(`Google Apps Script error: ${json.error ?? "unknown"}`);
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "registrations.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

type StoredRegistration = Omit<NewRegistration, "photos"> & { submittedAt: string; members: (Member & { photo: string })[] };

async function saveLocally(reg: NewRegistration): Promise<SaveResult> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  let existing: StoredRegistration[] = [];
  try {
    existing = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  } catch {
    // first registration, file doesn't exist yet
  }

  const taken = new Set(existing.flatMap((r) => (r.members ?? []).map((m) => m.admissionNo)));
  const duplicates = reg.members.map((m, i) => (taken.has(m.admissionNo) ? i : -1)).filter((i) => i >= 0);
  if (duplicates.length) return { ok: false, duplicates };

  const members = [];
  for (let i = 0; i < reg.members.length; i++) {
    const file = `${reg.registrationId}-${i + 1}.${reg.photos[i].ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, file), reg.photos[i].bytes);
    members.push({ ...reg.members[i], photo: `uploads/${file}` });
  }
  existing.push({ registrationId: reg.registrationId, teamType: reg.teamType, submittedAt: new Date().toISOString(), members });
  await fs.writeFile(DATA_FILE, JSON.stringify(existing, null, 2));
  return { ok: true };
}
