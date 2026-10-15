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
  activity: "Artwork Collection & Drawing Competition",
};

// What's printed on each member's entry ticket.
export const TICKET = {
  label: "Diwali Special Entry",
  date: "27 October",
  time: "4:00 PM – 6:30 PM",
  venue: "College Amphitheater",
};

// Suggestions only: students can still type a course or branch that isn't listed.
export const COURSES = ["B.Tech", "BCA", "BBA", "B.Com", "B.Sc", "BA", "MCA", "MBA", "M.Tech", "Diploma"];
export const BRANCHES = ["CSE", "CSE (AI & ML)", "CSE (Data Science)", "IT", "ECE", "EE", "ME", "CE", "Biotechnology"];

// Only official college email addresses are accepted. Set to "" to allow any email.
export const COLLEGE_EMAIL_DOMAIN = "abes.ac.in";

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export const TEAM_TYPES = [
  { id: "solo", label: "Solo", size: 1, icon: "👤", blurb: "Register on your own." },
  { id: "duo", label: "Duo", size: 2, icon: "👥", blurb: "Register as a team of two." },
  { id: "triplet", label: "Triplet", size: 3, icon: "👨‍👩‍👦", blurb: "Register as a team of three." },
] as const;

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

// Validates every member, plus checks that no two members share an admission number or email.
export function validateTeam(members: Member[]): MemberErrors[] {
  const errors = members.map(validateMember);
  const seen = { admissionNo: new Set<string>(), email: new Set<string>() };
  members.forEach((m, i) => {
    for (const key of ["admissionNo", "email"] as const) {
      const v = m[key].trim().toLowerCase();
      if (!v || errors[i][key]) continue;
      if (seen[key].has(v)) errors[i][key] = `This ${key === "email" ? "email" : "admission number"} is already used by another member.`;
      seen[key].add(v);
    }
  });
  return errors;
}

export const hasErrors = (errors: MemberErrors[]) => errors.some((e) => Object.keys(e).length > 0);

export function validatePhoto(file: { type: string; size: number } | null): string | undefined {
  if (!file || file.size === 0) return "Please upload a photo.";
  if (!PHOTO_TYPES.includes(file.type)) return "Photo must be a JPG, PNG or WebP image.";
  if (file.size > PHOTO_MAX_BYTES) return "Photo must be 2 MB or smaller.";
}
