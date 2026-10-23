// Shared between the form (client) and the API route (server) so both
// enforce exactly the same rules.

export const ORG_NAME = "Help Us To Help The Child";
export const ORG_SHORT = "HUHC";
export const ORG_TAGLINE = "Every child we encounter is a divine opportunity";

// Fill in the real event details here; they show up across the site.
export const EVENT = {
  name: "Saath 2.0",
  tagline: "Ek Chota Sa Prayas",
  date: "26–27 October 2026",
  time: "4:30 PM – 6:00 PM",
  venue: "College Amphitheatre",
  entry: "Free",
  activity: "Diwali Exhibition and Celebration",
};

// What's printed on each member's entry ticket.
export const TICKET = {
  label: "Diwali Special Entry",
  date: "27 October",
  time: "4:00 PM – 6:30 PM",
  venue: "College Amphitheatre",
};

// Suggestions only: students can still type a course or branch that isn't listed.
export const COURSES = ["B.Tech", "BCA", "BBA", "B.Com", "B.Sc", "BA", "MCA", "MBA", "M.Tech", "Diploma"];
export const BRANCHES = ["CSE", "CSE (AI & ML)", "CSE (Data Science)", "IT", "ECE", "ELCE", "EE", "ME", "CE", "Biotechnology"];

// Only official college email addresses are accepted. Set to "" to allow any email.
export const COLLEGE_EMAIL_DOMAIN = "abes.ac.in";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
// What the server accepts per photo, after the browser has shrunk it (see compressPhoto).
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
// Largest original a student can pick before it gets shrunk.
export const PHOTO_PICK_MAX_BYTES = 15 * 1024 * 1024;

// Registration fee per team size. One UPI QR code (no fixed amount) is used for both;
// students type the amount shown on the payment page.
export const TEAM_TYPES = [
  { id: "solo", label: "Solo", size: 1, icon: "👤", blurb: "Register on your own.", fee: 20, payQr: "/pay/upi-qr.png" },
  { id: "duo", label: "Duo", size: 2, icon: "👥", blurb: "Register as a team of two.", fee: 30, payQr: "/pay/upi-qr.png" },
] as const;

// Registered students are asked to join this group (shown after registering and in View ticket).
export const WHATSAPP_GROUP = "https://chat.whatsapp.com/DxSVR10E56C0rYfdnwgpnw";

// Where registration fees are paid (shown on the payment step).
// `label` is only a display hint in the UPI app link; payment apps still show the account holder's verified name.
// UPI transaction IDs (UTR) are usually 12 digits; some apps show longer letter-and-number IDs.
export const normalizeTxnId = (s: string) => s.replace(/\s+/g, "").toUpperCase();
export function validateTxnId(s: string): string | undefined {
  if (!/^[A-Z0-9]{8,35}$/.test(normalizeTxnId(s))) {
    return "Enter the UPI transaction ID (UTR) from your payment app, usually a 12-digit number.";
  }
}

export type TeamType = (typeof TEAM_TYPES)[number]["id"];

export const getTeamType = (id: string) => TEAM_TYPES.find((t) => t.id === id);

export type Member = {
  name: string;
  admissionNo: string;
  phone: string;
  course: string;
  branch: string;
  email: string;
};

export type MemberErrors = Partial<Record<keyof Member | "photo", string>>;

export const emptyMember: Member = {
  name: "",
  admissionNo: "",
  phone: "",
  course: "",
  branch: "",
  email: "",
};

export function validateMember(d: Member): MemberErrors {
  const e: MemberErrors = {};

  if (d.name.trim().length < 2) e.name = "Please enter the full name.";
  if (!/^[A-Za-z0-9/-]{3,30}$/.test(d.admissionNo.trim())) e.admissionNo = "Please enter a valid admission number.";
  if (!/^[6-9]\d{9}$/.test(d.phone)) e.phone = "Please enter a valid 10-digit mobile number.";
  if (!d.course.trim()) e.course = "Please enter the course.";
  if (!d.branch.trim()) e.branch = "Please enter the branch.";

  const email = d.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Please enter a valid email address.";
  else if (COLLEGE_EMAIL_DOMAIN && !email.endsWith("@" + COLLEGE_EMAIL_DOMAIN))
    e.email = `Please use the college email (@${COLLEGE_EMAIL_DOMAIN}).`;

  return e;
}

// Validates every member, plus checks that the Duo partners don't share an admission number or email
// (name, mobile, course and branch may be the same).
export function validateTeam(members: Member[]): MemberErrors[] {
  const errors = members.map(validateMember);
  const seen = { admissionNo: new Set<string>(), email: new Set<string>() };
  members.forEach((m, i) => {
    for (const key of ["admissionNo", "email"] as const) {
      const v = m[key].trim().toLowerCase();
      if (!v || errors[i][key]) continue;
      if (seen[key].has(v)) errors[i][key] = `Both members can't have the same ${key === "email" ? "college email" : "admission number"}. Enter Member ${i + 1}'s own.`;
      seen[key].add(v);
    }
  });
  return errors;
}

export const hasErrors = (errors: MemberErrors[]) => errors.some((e) => Object.keys(e).length > 0);

export function validatePhoto(file: { type: string; size: number } | null, maxBytes = PHOTO_MAX_BYTES): string | undefined {
  if (!file || file.size === 0) return "Please upload a photo.";
  if (!PHOTO_TYPES.includes(file.type)) return "Photo must be a JPG, PNG or WebP image.";
  if (file.size > maxBytes) return `Photo must be ${maxBytes / 1024 / 1024} MB or smaller.`;
}
