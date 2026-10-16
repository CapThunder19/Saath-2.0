"use client";

import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import { toPng } from "html-to-image";
import { forwardRef, useEffect, useRef, useState } from "react";
import { EVENT, ORG_SHORT, TICKET } from "@/lib/registration";

const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["700", "800"] });
const body = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export type TicketProps = {
  name: string;
  branch: string;
  photo: string; // data URL, so the downloaded PNG can embed it
  registrationId: string;
  memberNo: number;
  teamSize: number;
};

// The ticket is laid out at a fixed 1000px width so the downloaded PNG always
// looks the same; on screen it's scaled down to fit its container.
const TICKET_WIDTH = 1000;

export const Ticket = forwardRef<HTMLDivElement, TicketProps>(function Ticket(
  { name, branch, photo, registrationId, memberNo, teamSize },
  ref,
) {
  return (
    <div ref={ref} className={`ticket-frame ${body.className}`}>
      <div className="ticket">
        <Rangoli />
        <div className="ticket-inner">
          <div className="ticket-main">
            <div className="ticket-top">
              <span className="ticket-pill">{TICKET.label}</span>
              <span className="ticket-org">{ORG_SHORT}</span>
              <span className="ticket-admit">Admit one</span>
            </div>

            <div className="ticket-title-row">
              <div>
                <h2 className={`ticket-title ${display.className}`}>{EVENT.name}</h2>
                <p className={`ticket-tagline ${display.className}`}>{EVENT.tagline.toLowerCase()}</p>
              </div>
              <Diya />
            </div>

            <div className="ticket-details">
              <div><span>Date</span><strong>{TICKET.date}</strong></div>
              <div><span>Time</span><strong>{TICKET.time}</strong></div>
              <div><span>Venue</span><strong>{TICKET.venue}</strong></div>
            </div>

            <div className="ticket-member">
              <div><span>Member name</span><strong>{name}</strong></div>
              <div><span>Branch</span><strong>{branch}</strong></div>
            </div>
          </div>

          <div className="ticket-stub">
            <div className="ticket-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={`Photo of ${name}`} />
            </div>
            <p className="ticket-id">
              {registrationId}
              {teamSize > 1 && <span> · {memberNo} of {teamSize}</span>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

export async function downloadTicketPng(node: HTMLElement, name: string) {
  const url = await toPng(node, { pixelRatio: 2, cacheBust: true });
  const a = document.createElement("a");
  a.href = url;
  a.download = `Saath-2.0-ticket-${name.trim().replace(/\s+/g, "-")}.png`;
  a.click();
}

// Scales a fixed-width ticket down to the available width.
export function TicketScaler({ children }: { children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const el = outer.current!;
    const update = () => {
      const s = Math.min(1, el.clientWidth / TICKET_WIDTH);
      setScale(s);
      setHeight((el.firstElementChild as HTMLElement).offsetHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outer} className="ticket-scaler" style={{ height }}>
      <div style={{ width: TICKET_WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
    </div>
  );
}

function Diya() {
  return (
    <svg className="ticket-diya" viewBox="0 0 120 100" aria-hidden="true">
      <g stroke="#f4b740" strokeWidth="2.5" strokeLinecap="round">
        <line x1="60" y1="4" x2="60" y2="10" />
        <line x1="34" y1="16" x2="40" y2="22" />
        <line x1="86" y1="16" x2="80" y2="22" />
        <line x1="22" y1="44" x2="29" y2="45" />
        <line x1="98" y1="44" x2="91" y2="45" />
      </g>
      <path d="M60 14 C48 30 47 42 60 56 C73 42 72 30 60 14 Z" fill="#ec7f23" />
      <path d="M60 30 C54 39 54 46 60 54 C66 46 66 39 60 30 Z" fill="#fde9c6" />
      <path d="M8 62 H112 Q106 92 60 94 Q14 92 8 62 Z" fill="#f4b740" />
      <rect x="6" y="59" width="108" height="5" rx="2.5" fill="#f4b740" />
      <circle cx="42" cy="75" r="3" fill="#4a0f1e" />
      <circle cx="60" cy="80" r="3" fill="#4a0f1e" />
      <circle cx="78" cy="75" r="3" fill="#4a0f1e" />
    </svg>
  );
}

function Rangoli() {
  const petals = Array.from({ length: 8 }, (_, i) => i * 45);
  return (
    <svg className="ticket-rangoli" viewBox="0 0 300 300" aria-hidden="true">
      <circle cx="150" cy="150" r="140" fill="none" stroke="#f4b740" strokeWidth="2" />
      <circle cx="150" cy="150" r="112" fill="none" stroke="#f4b740" strokeWidth="2" />
      {petals.map((a) => (
        <ellipse key={a} cx="150" cy="80" rx="22" ry="54" fill="#c2412d" transform={`rotate(${a} 150 150)`} />
      ))}
      <circle cx="150" cy="150" r="18" fill="#f4b740" />
      <circle cx="28" cy="150" r="6" fill="#f4b740" />
      <circle cx="272" cy="150" r="6" fill="#f4b740" />
    </svg>
  );
}
