"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { AdminRegistration } from "@/lib/storage";

type Reg = AdminRegistration & { ticketLinks: string[] };
type Filter = "Pending" | "Approved" | "All";

export default function AdminDashboard({ initial, error }: { initial: Reg[]; error: string }) {
  const router = useRouter();
  const [regs, setRegs] = useState(initial);
  const [filter, setFilter] = useState<Filter>("Pending");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // "Refresh" re-renders the server page with fresh data; pick it up here.
  useEffect(() => setRegs(initial), [initial]);

  const counts = useMemo(
    () => ({
      Pending: regs.filter((r) => r.status === "Pending").length,
      Approved: regs.filter((r) => r.status === "Approved").length,
      All: regs.length,
      students: regs.reduce((n, r) => n + r.members.length, 0),
    }),
    [regs],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return regs.filter(
      (r) =>
        (filter === "All" || r.status === filter) &&
        (!q ||
          r.registrationId.toLowerCase().includes(q) ||
          r.txnId.toLowerCase().includes(q) ||
          r.members.some((m) => [m.name, m.admissionNo, m.email, m.phone].some((v) => v.toLowerCase().includes(q)))),
    );
  }, [regs, filter, query]);

  async function approve(reg: Reg) {
    const paid = reg.txnId ? `\n\nCheck that ₹${reg.amount} with UPI transaction ID ${reg.txnId} arrived before approving.` : "";
    if (!confirm(`Approve ${reg.registrationId} (${reg.members.map((m) => m.name).join(", ")})?${paid}`)) return;
    setBusy(reg.registrationId);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId: reg.registrationId }),
      });
      if (res.status === 401) return router.replace("/ticket");
      // A timeout can return an HTML error page instead of JSON.
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not approve. Please try again.");
      setRegs((all) =>
        all.map((r) => (r.registrationId === reg.registrationId ? { ...r, status: "Approved", approvedAt: json.approvedAt } : r)),
      );
      setNotice({ kind: "ok", text: `${reg.registrationId} approved. Members can now open their tickets from View ticket.` });
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(null);
      // Re-read the sheet so the list always shows what's really saved.
      router.refresh();
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/ticket");
  }

  return (
    <div className="admin">
      <div className="admin-head">
        <div>
          <span className="eyebrow">Saath 2.0 · Admin</span>
          <h1>Registrations</h1>
          <p>
            {counts.All} registrations · {counts.students} students · {counts.Pending} waiting for approval
          </p>
        </div>
        <div className="admin-head-actions">
          <a className="btn btn-primary" href="/api/admin/export">Download Excel</a>
          <button className="btn btn-outline" onClick={() => router.refresh()}>Refresh</button>
          <button className="btn btn-outline" onClick={logout}>Sign out</button>
        </div>
      </div>

      {error && <p className="server-error">{error}</p>}
      {notice && <p className={notice.kind === "ok" ? "admin-notice" : "server-error"}>{notice.text}</p>}

      <div className="admin-toolbar">
        <div className="admin-tabs" role="tablist">
          {(["Pending", "Approved", "All"] as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? "is-active" : undefined} onClick={() => setFilter(f)}>
              {f} <span>{counts[f]}</span>
            </button>
          ))}
        </div>
        <input
          className="admin-search"
          type="search"
          placeholder="Search name, admission no., email, phone, ID or txn ID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {shown.length === 0 && !error && <p className="admin-empty">No registrations here.</p>}

      <div className="admin-list">
        {shown.map((r) => (
          <article key={r.registrationId} className="admin-card">
            <header>
              <div>
                <strong>{r.registrationId}</strong>
                <span className="admin-meta">
                  <span>{r.teamType}</span> · {r.members.length} member{r.members.length > 1 ? "s" : ""} · submitted {formatDate(r.submittedAt)}
                </span>
              </div>
              <span className={`admin-status is-${r.status.toLowerCase()}`}>
                {r.status === "Approved" ? `Approved ${r.approvedAt ? formatDate(r.approvedAt) : ""}` : "Pending"}
              </span>
            </header>

            <div className="admin-payment">
              <span>Paid {r.amount ? `₹${r.amount}` : "—"}</span>
              <span>
                UPI txn ID <strong>{r.txnId || "not given"}</strong>
              </span>
            </div>

            <div className="admin-members">
              {r.members.map((m, i) => (
                <div className="admin-member" key={m.memberNo}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/admin/photo?id=${r.registrationId}-${m.memberNo}`} alt={`Photo of ${m.name}`} loading="lazy" />
                  <dl>
                    <dt>Name</dt><dd>{m.name}</dd>
                    <dt>Admission</dt><dd>{m.admissionNo}</dd>
                    <dt>Mobile</dt><dd>{m.phone}</dd>
                    <dt>Course</dt><dd>{m.course} · {m.branch}</dd>
                    <dt>Email</dt><dd>{m.email}</dd>
                  </dl>
                  <a className="admin-ticket-link" href={r.ticketLinks[i]} target="_blank" rel="noreferrer">View ticket ↗</a>
                </div>
              ))}
            </div>

            <footer>
              {r.status === "Approved" ? (
                <span className="admin-approved-note">✓ Approved: tickets are live in View ticket</span>
              ) : (
                <button className="btn btn-primary" disabled={busy === r.registrationId} onClick={() => approve(r)}>
                  {busy === r.registrationId ? "Approving..." : "Approve"}
                </button>
              )}
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}

// Sheet dates arrive as display strings; ISO strings come from local storage.
function formatDate(s: string) {
  const d = new Date(s);
  return /^\d{4}-\d{2}-\d{2}T/.test(s) && !isNaN(d.getTime())
    ? d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : s;
}
