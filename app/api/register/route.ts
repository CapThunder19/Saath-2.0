import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import {
  emptyMember,
  getTeamType,
  hasErrors,
  normalizeTxnId,
  validatePhoto,
  validateTeam,
  validateTxnId,
  type Member,
} from "@/lib/registration";
import { BusyError, saveRegistration, type Photo } from "@/lib/storage";

// No 0/O or 1/I, so IDs are easy to read out at the entry.
const ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Apps Script can take a few seconds to save photos to Drive.
export const maxDuration = 60;

// Check the file's actual bytes, not just the type the browser claims.
function imageType(buf: Buffer): { ext: string; mimeType: string } | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mimeType: "image/jpeg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mimeType: "image/png" };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return { ext: "webp", mimeType: "image/webp" };
  return null;
}

const invalid = (errors: object[], error = "Please correct the highlighted fields.", status = 422, txnError?: string) =>
  NextResponse.json({ error, errors, txnError }, { status });

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const team = getTeamType(String(form.get("teamType") ?? ""));
  if (!team) return NextResponse.json({ error: "Please choose Solo or Duo." }, { status: 400 });

  // Fields arrive as m0_name, m0_photo, m1_name, ... Only known fields are kept.
  const members: Member[] = [];
  const files: (File | null)[] = [];
  for (let i = 0; i < team.size; i++) {
    const m = { ...emptyMember };
    for (const key of Object.keys(emptyMember) as (keyof Member)[]) {
      const v = form.get(`m${i}_${key}`);
      m[key] = typeof v === "string" ? v.trim().slice(0, 200) : "";
    }
    m.admissionNo = m.admissionNo.toUpperCase();
    m.email = m.email.toLowerCase();
    members.push(m);
    const f = form.get(`m${i}_photo`);
    files.push(f instanceof File ? f : null);
  }

  const errors = validateTeam(members);
  const photos: Photo[] = [];
  for (let i = 0; i < team.size; i++) {
    const photoError = validatePhoto(files[i]);
    if (photoError) {
      errors[i].photo = photoError;
      continue;
    }
    const bytes = Buffer.from(await files[i]!.arrayBuffer());
    const type = imageType(bytes);
    if (type) photos[i] = { bytes, ...type };
    else errors[i].photo = "Photo must be a JPG, PNG or WebP image.";
  }
  if (hasErrors(errors)) return invalid(errors);

  const txnId = normalizeTxnId(String(form.get("txnId") ?? ""));
  const txnError = validateTxnId(txnId);
  if (txnError) return invalid(errors, txnError, 422, txnError);

  // Derived from the form's random submission key, so automatic retries of the same
  // submission reuse one ID (and the sheet can recognise a repeat), while different
  // people never collide. Falls back to random if the key is missing.
  const key = String(form.get("submissionKey") ?? "");
  const seed = /^[A-Za-z0-9-]{16,64}$/.test(key) ? createHash("sha256").update(key).digest() : randomBytes(6);
  const registrationId = "SAATH-" + Array.from(seed.subarray(0, 6), (b) => ID_CHARS[b % ID_CHARS.length]).join("");
  try {
    const result = await saveRegistration({ registrationId, teamType: team.id, amount: team.fee, txnId, members, photos });
    if (!result.ok && result.duplicateTxn) {
      const msg = "This transaction ID has already been used for another registration.";
      return invalid(errors, msg, 409, msg);
    }
    if (!result.ok) {
      // Each student can only be registered once, in any team.
      for (const i of result.duplicates) errors[i].admissionNo = "This admission number is already registered.";
      return invalid(errors, "Some members are already registered.", 409);
    }
    // Tickets become available in "View ticket" once an admin approves the registration.
    return NextResponse.json({ registrationId }, { status: 201 });
  } catch (err) {
    if (err instanceof BusyError) {
      return NextResponse.json({ error: "Many people are registering right now.", retry: true }, { status: 503 });
    }
    console.error("Failed to save registration", err);
    return NextResponse.json({ error: "Could not save your registration. Please try again." }, { status: 500 });
  }
}
