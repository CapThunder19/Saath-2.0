"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Found = { name: string; registrationId: string; memberNo: number; teamSize: number; status: string; url: string | null };

export default function TicketLookup() {
  const router = useRouter();
  const [admissionNo, setAdmissionNo] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<Found | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!admissionNo.trim() || !name.trim()) return setError("Please enter your admission number and name.");
    setLoading(true);
    setError("");
    setFound(null);
    try {
      const res = await fetch("/api/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admissionNo, name }),
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
        <p>Enter the admission number and name you registered with.</p>
      </div>
      <form noValidate onSubmit={handleSubmit}>
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
          </div>
        ) : found ? (
          <div className="lookup-result is-pending">
            <p>
              <strong>⏳ Verification in progress</strong>
            </p>
            <p>
              Hi {found.name.split(" ")[0]}, registration {found.registrationId} is being reviewed by the HUHC team. Once
              it&apos;s approved, your ticket will be emailed to your college email and will show up here.
            </p>
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
