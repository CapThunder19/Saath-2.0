"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import WhatsAppJoin from "@/components/WhatsAppJoin";

type Found = { name: string; registrationId: string; memberNo: number; teamSize: number; status: string; url: string | null };

export default function TicketLookup() {
  const router = useRouter();
  const [by, setBy] = useState<"admission" | "phone">("admission");
  const [admissionNo, setAdmissionNo] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<Found | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (by === "admission" && (!admissionNo.trim() || !name.trim())) return setError("Please enter your admission number and name.");
    if (by === "phone" && !/^[6-9]\d{9}$/.test(phone)) return setError("Please enter your 10-digit mobile number.");
    if (by === "phone" && !name.trim()) return setError("Please enter your name.");
    setLoading(true);
    setError("");
    setFound(null);
    try {
      const res = await fetch("/api/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(by === "admission" ? { admissionNo, name } : { phone, name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      if (json.admin) return router.push("/admin");
      setFound(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-wrapper lookup-wrapper">
      <div className="form-header">
        <h1>View your ticket</h1>
        <p>Enter your admission number or mobile number, and the name you registered with.</p>
      </div>
      <form noValidate onSubmit={handleSubmit}>
        <div className="lookup-by" role="tablist" aria-label="Find by">
          {([["admission", "Admission number"], ["phone", "Mobile number"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={by === key}
              className={by === key ? "is-active" : undefined}
              onClick={() => {
                setBy(key);
                setFound(null);
                setError("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {by === "admission" ? (
          <div className="field">
            <label htmlFor="lookup-admission">Admission number</label>
            <input
              id="lookup-admission"
              value={admissionNo}
              onChange={(e) => { setAdmissionNo(e.target.value); setFound(null); }}
              autoCapitalize="characters"
              placeholder="e.g. 2024BTCS0123"
            />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="lookup-phone">Mobile number</label>
            <input
              id="lookup-phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setFound(null); }}
              autoComplete="tel-national"
              placeholder="10-digit number you registered with"
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="lookup-name">Full name</label>
          <input id="lookup-name" value={name} onChange={(e) => { setName(e.target.value); setFound(null); }} autoComplete="name" />
        </div>

        {error && <p className="server-error">{error}</p>}

        {found?.url ? (
          <div className="lookup-result">
            <p>
              Ticket found for <strong>{found.name}</strong> · {found.registrationId}
              {found.teamSize > 1 && ` · Member ${found.memberNo} of ${found.teamSize}`}
            </p>
            <Link href={found.url} className="btn btn-primary">
              Open my ticket →
            </Link>
            <WhatsAppJoin compact />
          </div>
        ) : found ? (
          <div className="lookup-result is-pending">
            <p>
              <strong>⏳ Verification in progress</strong>
            </p>
            <p>
              Hi {found.name.split(" ")[0]}, registration {found.registrationId} is being reviewed by the HUHC team. Once
              it&apos;s approved, your ticket will show up here. Please check back later.
            </p>
            <WhatsAppJoin />
          </div>
        ) : (
          <div className="form-nav form-nav-end">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Searching..." : "Find my ticket"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
