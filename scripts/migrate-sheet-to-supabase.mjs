// One-off: copies every registration (and photo) from the old Google Sheet into Supabase.
//
//   node --env-file=.env.local scripts/migrate-sheet-to-supabase.mjs
//
// Needs GOOGLE_SCRIPT_URL + GOOGLE_SCRIPT_SECRET (the old Apps Script, still deployed)
// and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Safe to run again: registrations that
// are already in Supabase are skipped.
import { createClient } from "@supabase/supabase-js";

const { GOOGLE_SCRIPT_URL, GOOGLE_SCRIPT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
for (const [k, v] of Object.entries({ GOOGLE_SCRIPT_URL, GOOGLE_SCRIPT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })) {
  if (!v) {
    console.error(`Missing ${k} in .env.local`);
    process.exit(1);
  }
}

const FEES = { solo: 20, duo: 30, triplet: 40 };
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function sheet(payload) {
  const res = await fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    redirect: "follow",
    body: JSON.stringify({ secret: GOOGLE_SCRIPT_SECRET, ...payload }),
  });
  const json = JSON.parse(await res.text());
  if (!json.ok) throw new Error(`Apps Script: ${json.error}`);
  return json.result;
}

// Sheet dates arrive as display text: "10/15/2026" style (month first) for "Submitted at",
// "16/10/2026 10:30" (day first) for "Approved at", which the script wrote itself.
function parseDate(s, order) {
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s.trim());
  if (m) {
    let [a, b] = [Number(m[1]), Number(m[2])];
    let [month, day] = order === "mdy" ? [a, b] : [b, a];
    if (month > 12) [month, day] = [day, month];
    const iso = `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(m[4] ?? 0).padStart(2, "0")}:${m[5] ?? "00"}:${m[6] ?? "00"}+05:30`;
    return new Date(iso).toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const regs = await sheet({ action: "list" });
console.log(`Found ${regs.length} registrations in the sheet.`);
let imported = 0, skipped = 0, failed = 0;

for (const r of regs) {
  const members = [];
  for (const m of r.members) {
    const t = await sheet({ action: "ticket", registrationId: r.registrationId, memberNo: m.memberNo });
    const match = /^data:([^;]+);base64,(.+)$/.exec(t?.photo ?? "");
    let photoPath = "";
    if (match) {
      const ext = match[1].split("/")[1].replace("jpeg", "jpg");
      photoPath = `${r.registrationId}-${m.memberNo}.${ext}`;
      const { error } = await db.storage
        .from("member-photos")
        .upload(photoPath, Buffer.from(match[2], "base64"), { contentType: match[1], upsert: true });
      if (error) throw new Error(`Photo upload for ${r.registrationId}-${m.memberNo}: ${error.message}`);
    }
    members.push({ ...m, photoPath });
  }

  const { data, error } = await db.rpc("import_registration", {
    p_id: r.registrationId,
    p_submitted_at: parseDate(r.submittedAt, "mdy"),
    p_team_type: r.teamType,
    p_amount: Number(r.amount) || FEES[r.teamType] || null,
    p_txn_id: r.txnId || null,
    p_status: r.status,
    p_approved_at: parseDate(r.approvedAt, "dmy"),
    p_members: members,
  });
  if (error) throw new Error(`Import ${r.registrationId}: ${error.message}`);
  if (!data.ok) {
    failed++;
    console.log(`✗ ${r.registrationId}: ${data.error}`);
  } else if (data.skipped) {
    skipped++;
    console.log(`– ${r.registrationId}: ${data.skipped}`);
  } else {
    imported++;
    console.log(`✓ ${r.registrationId} (${r.teamType}, ${r.members.map((m) => m.name).join(", ")}, ${r.status})`);
  }
}

console.log(`\nDone: ${imported} imported, ${skipped} already there, ${failed} failed.`);
