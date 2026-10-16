import Link from "next/link";

export default function VerificationPending({ registrationId }: { registrationId: string }) {
  return (
    <div className="form-wrapper">
      <div className="success">
        <div className="check pending-icon">⏳</div>
        <h2>Verification in progress</h2>
        <p>
          Registration <strong className="reg-id-inline">{registrationId}</strong> is being reviewed by the HUHC team.
        </p>
        <p>Once it&apos;s approved, your ticket will show up in <strong>View ticket</strong>. Please check back later.</p>
        <Link href="/" className="btn btn-outline" style={{ marginTop: 20 }}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
