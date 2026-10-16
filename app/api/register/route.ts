import { NextResponse } from "next/server";
import { emptyMember, getTeamType, hasErrors, validatePhoto, validateTeam, type Member } from "@/lib/registration";
import { saveRegistration, type Photo } from "@/lib/storage";

// Apps Script can take a few seconds to save photos to Drive.
export const maxDuration = 60;

// Check the file's actual bytes, not just the type the browser claims.
function imageType(buf: Buffer): { ext: string; mimeType: string } | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mimeType: "image/jpeg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mimeType: "image/png" };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return { ext: "webp", mimeType: "image/webp" };
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

  const registrationId = "SAATH-" + Date.now().toString(36).toUpperCase().slice(-6);
  try {
    const result = await saveRegistration({ registrationId, teamType: team.id, members, photos });
    if (!result.ok) {
      // Each student can only be registered once, in any team.
      for (const i of result.duplicates) errors[i].admissionNo = "This admission number is already registered.";
      return invalid(errors, "Some members are already registered.", 409);
    }
    // Tickets become available in "View ticket" once an admin approves the registration.
    return NextResponse.json({ registrationId }, { status: 201 });
  } catch (err) {
    console.error("Failed to save registration", err);
    return NextResponse.json({ error: "Could not save your registration. Please try again." }, { status: 500 });
  }
}
