import { EVENT, ORG_NAME, TICKET } from "@/lib/registration";
import type { Email } from "@/lib/storage";

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// The "your registration is approved" email with the member's private ticket link.
export function ticketEmail(p: {
  to: string;
  name: string;
  registrationId: string;
  memberNo: number;
  teamSize: number;
  link: string;
}): Email {
  const first = escape(p.name.split(" ")[0]);
  const member = p.teamSize > 1 ? ` · Member ${p.memberNo} of ${p.teamSize}` : "";
  const html = `
<div style="background:#e8e1d5;padding:24px;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#4a0f1e;border-radius:14px;padding:32px;color:#fdf0d5">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:3px;color:#f4b740;text-transform:uppercase">${escape(TICKET.label)}</p>
    <h1 style="margin:0;font-size:34px;color:#fdf0d5">${escape(EVENT.name)}</h1>
    <p style="margin:4px 0 22px;font-size:18px;color:#f4b740">${escape(EVENT.tagline)}</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 14px">Hi ${first}, your registration has been <strong>approved</strong>! 🎉</p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 22px;color:#e9c6bc">
      Registration ID <strong style="color:#f4b740">${escape(p.registrationId)}</strong>${member}<br>
      ${escape(TICKET.date)} · ${escape(TICKET.time)} · ${escape(TICKET.venue)}
    </p>
    <a href="${escape(p.link)}" style="display:inline-block;background:#f4b740;color:#4a0f1e;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:8px">View &amp; download your ticket</a>
    <p style="font-size:12px;line-height:1.6;margin:24px 0 0;color:#e9c6bc">
      Show your ticket at the entry. This link is personal to you; please don't share it.<br>
      If the button doesn't work, open: <span style="color:#fdf0d5">${escape(p.link)}</span>
    </p>
  </div>
  <p style="text-align:center;font-size:11px;color:#6b5a52;margin:14px 0 0">${escape(ORG_NAME)} (HUHC)</p>
</div>`;
  return { to: p.to, subject: `Your ${EVENT.name} ticket is ready (${p.registrationId})`, html };
}
