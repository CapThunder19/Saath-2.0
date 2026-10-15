import type { Metadata } from "next";
import Link from "next/link";
import { EVENT, ORG_NAME, TEAM_TYPES } from "@/lib/registration";

export const metadata: Metadata = { title: "Register" };

export default function RegisterPage() {
  return (
    <main className="form-page">
      <div className="container">
        <div className="team-picker">
          <span className="eyebrow">Register for {EVENT.name} · {ORG_NAME}</span>
          <h1>How are you participating?</h1>
          <p>Choose your team size. You&apos;ll fill in details for each member on the next page.</p>
          <div className="team-options">
            {TEAM_TYPES.map((t) => (
              <Link key={t.id} href={`/register/${t.id}`} className="team-option">
                <span className="team-icon" aria-hidden="true">{t.icon}</span>
                <strong>{t.label}</strong>
                <span className="team-size">
                  {t.size} {t.size === 1 ? "member" : "members"}
                </span>
                <span className="team-blurb">{t.blurb}</span>
                <span className="team-cta">Continue <span aria-hidden="true">→</span></span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
