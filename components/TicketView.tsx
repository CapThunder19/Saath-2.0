"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { Ticket, TicketScaler, downloadTicketPng, type TicketProps } from "@/components/Ticket";

// One member's ticket with download and copy-link buttons.
export default function TicketView({ approved, ...props }: TicketProps & { approved: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string>();

  // The QR code opens this page (the signed ticket link), so entry volunteers can
  // scan a ticket and check it against the live record: an edited image won't match.
  useEffect(() => {
    QRCode.toDataURL(window.location.href, { margin: 1, width: 240, errorCorrectionLevel: "M", color: { dark: "#4a0f1e", light: "#fdf0d5" } })
      .then(setQr)
      .catch(() => setQr(undefined));
  }, []);

  async function download() {
    if (!ref.current) return;
    setBusy(true);
    try {
      await downloadTicketPng(ref.current, props.name);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked; the link is still in the address bar
    }
  }

  return (
    <div className="tickets-page">
      <div className="success tickets-intro">
        <p className={approved ? "ticket-verified" : "ticket-unverified"}>
          {approved ? "✓ Verified ticket · approved by HUHC" : "Admin preview · not approved yet"}
        </p>
        <h2>{props.name.split(" ")[0]}&apos;s ticket</h2>
        <p>
          Registration ID <strong className="reg-id-inline">{props.registrationId}</strong>
          {props.teamSize > 1 && ` · Member ${props.memberNo} of ${props.teamSize}`}
        </p>
        <p>Show this ticket at the entry. Bookmark this page or copy the link to open it again anytime.</p>
        <div className="tickets-actions">
          <button className="btn btn-primary" onClick={download} disabled={busy || !qr}>
            {busy ? "Preparing..." : "Download ticket"}
          </button>
          <button className="btn btn-outline" onClick={copyLink}>
            {copied ? "Link copied ✓" : "Copy ticket link"}
          </button>
        </div>
      </div>
      <div className="ticket-card">
        <TicketScaler>
          <Ticket ref={ref} {...props} qr={qr} />
        </TicketScaler>
      </div>
    </div>
  );
}
