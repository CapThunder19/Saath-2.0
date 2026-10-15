import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  emptyMember,
  getTeamType,
  hasErrors,
  validatePhoto,
  validateTeam,
  type Member,
} from "@/lib/registration";

// Registrations are appended to a local JSON file and photos are saved next to it.
// Swap this out for a database + file storage (Supabase, Cloudinary, S3...) before
// going live: most hosts (e.g. Vercel) don't keep files written at runtime.
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "registrations.json");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

type StoredMember = Member & { photo: string };
type StoredRegistration = { registrationId: string; submittedAt: string; teamType: string; members: StoredMember[] };

// Check the file's actual bytes, not just the type the browser claims.
function imageExtension(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

const invalid = (errors: object[], error = "Please correct the highlighted fields.", status = 422) =>
  NextResponse.json({ error, errors }, { status });

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const team = getTeamType(String(form.get("teamType") ?? ""));
  if (!team) return NextResponse.json({ error: "Please choose Solo, Duo or Triplet." }, { status: 400 });

  // Fields arrive as m0_name, m0_photo, m1_name, ... Only known fields are kept.
  const members: Member[] = [];
  const photos: (File | null)[] = [];
  for (let i = 0; i < team.size; i++) {
    const m = { ...emptyMember };
    for (const key of Object.keys(emptyMember) as (keyof Member)[]) {
      const v = form.get(`m${i}_${key}`);
      m[key] = typeof v === "string" ? v.trim().slice(0, 200) : "";
    }
    m.admissionNo = m.admissionNo.toUpperCase();
    m.email = m.email.toLowerCase();
    members.push(m);
    const p = form.get(`m${i}_photo`);
    photos.push(p instanceof File ? p : null);
  }

  const errors = validateTeam(members);
  const photoBytes: Buffer[] = [];
  const exts: string[] = [];
  for (let i = 0; i < team.size; i++) {
    const photoError = validatePhoto(photos[i]);
    if (photoError) {
      errors[i].photo = photoError;
      continue;
    }
    photoBytes[i] = Buffer.from(await photos[i]!.arrayBuffer());
    const ext = imageExtension(photoBytes[i]);
    if (ext) exts[i] = ext;
    else errors[i].photo = "Photo must be a JPG, PNG or WebP image.";
  }
  if (hasErrors(errors)) return invalid(errors);

  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    let existing: StoredRegistration[] = [];
    try {
      existing = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
    } catch {
      // first registration, file doesn't exist yet
    }

    // Each student can only be registered once, in any team.
    const taken = new Set(existing.flatMap((r) => (r.members ?? []).map((m) => m.admissionNo)));
    members.forEach((m, i) => {
      if (taken.has(m.admissionNo)) errors[i].admissionNo = "This admission number is already registered.";
    });
    if (hasErrors(errors)) return invalid(errors, "Some members are already registered.", 409);

    const registrationId = "SAATH-" + Date.now().toString(36).toUpperCase().slice(-6);
    const stored: StoredMember[] = [];
    for (let i = 0; i < team.size; i++) {
      const photoFile = `${registrationId}-${i + 1}.${exts[i]}`;
      await fs.writeFile(path.join(UPLOAD_DIR, photoFile), photoBytes[i]);
      stored.push({ ...members[i], photo: `uploads/${photoFile}` });
    }

    existing.push({ registrationId, submittedAt: new Date().toISOString(), teamType: team.id, members: stored });
    await fs.writeFile(DATA_FILE, JSON.stringify(existing, null, 2));

    return NextResponse.json({ registrationId }, { status: 201 });
  } catch (err) {
    console.error("Failed to save registration", err);
    return NextResponse.json({ error: "Could not save your registration. Please try again." }, { status: 500 });
  }
}
