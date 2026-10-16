import { createHmac, timingSafeEqual } from "crypto";

// Ticket links look like /ticket/SAATH-9J6B7S-2?t=<signature>. The signature
// stops anyone from opening other students' tickets by guessing registration IDs.

function secret() {
  const s = process.env.TICKET_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("TICKET_SECRET must be set in production.");
  return "dev-only-ticket-secret";
}

const sign = (ticketId: string) => createHmac("sha256", secret()).update(ticketId).digest("base64url").slice(0, 22);

export const ticketId = (registrationId: string, memberNo: number) => `${registrationId}-${memberNo}`;

export const ticketPath = (registrationId: string, memberNo: number) => {
  const id = ticketId(registrationId, memberNo);
  return `/ticket/${id}?t=${sign(id)}`;
};

export function verifyTicket(id: string, token: string | undefined) {
  if (!token) return false;
  const expected = Buffer.from(sign(id));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// "SAATH-9J6B7S-2" → { registrationId: "SAATH-9J6B7S", memberNo: 2 }
export function parseTicketId(id: string) {
  const m = /^(SAATH-[A-Z0-9]+)-([1-3])$/.exec(id);
  return m ? { registrationId: m[1], memberNo: Number(m[2]) } : null;
}

// Names are compared ignoring case and extra spaces.
export const sameName = (a: string, b: string) => {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return norm(a) === norm(b);
};
