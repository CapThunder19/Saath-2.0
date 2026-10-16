"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { compressPhoto } from "@/lib/compressPhoto";
import {
  BRANCHES,
  COLLEGE_EMAIL_DOMAIN,
  COURSES,
  EVENT,
  ORG_NAME,
  PHOTO_PICK_MAX_BYTES,
  PHOTO_TYPES,
  UPI,
  emptyMember,
  getTeamType,
  hasErrors,
  validatePhoto,
  validateTeam,
  validateTxnId,
  type Member,
  type MemberErrors,
  type TeamType,
} from "@/lib/registration";

export default function RegistrationForm({ teamType }: { teamType: TeamType }) {
  const team = getTeamType(teamType)!;
  const [members, setMembers] = useState<Member[]>(() => Array.from({ length: team.size }, () => ({ ...emptyMember })));
  const [photos, setPhotos] = useState<(File | null)[]>(() => Array(team.size).fill(null));
  const [errors, setErrors] = useState<MemberErrors[]>(() => Array.from({ length: team.size }, () => ({})));
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [regId, setRegId] = useState("");
  const [step, setStep] = useState<"details" | "payment">("details");
  const [txnId, setTxnId] = useState("");
  const [txnError, setTxnError] = useState("");

  function clearError(i: number, key: keyof MemberErrors) {
    setErrors((all) => all.map((e, j) => (j === i && e[key] ? { ...e, [key]: undefined } : e)));
  }

  function setField(i: number, key: keyof Member, value: string) {
    setMembers((all) => all.map((m, j) => (j === i ? { ...m, [key]: value } : m)));
    clearError(i, key);
  }

  async function setPhoto(i: number, picked: File | null) {
    const pickError = picked ? validatePhoto(picked, PHOTO_PICK_MAX_BYTES) : undefined;
    const file = picked && !pickError ? await compressPhoto(picked) : picked;
    setPhotos((all) => all.map((p, j) => (j === i ? file : p)));
    setErrors((all) => all.map((e, j) => (j === i ? { ...e, photo: file ? pickError ?? validatePhoto(file) : undefined } : e)));
  }

  function goToPayment(e: React.FormEvent) {
    e.preventDefault();
    const found = validateTeam(members);
    photos.forEach((p, i) => {
      const err = validatePhoto(p);
      if (err) found[i].photo = err;
    });
    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found);
    setServerError("");
    setStep("payment");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateTxnId(txnId);
    setTxnError(err ?? "");
    if (err) return document.getElementById("txn-id")?.focus();

    const body = new FormData();
    body.append("teamType", team.id);
    body.append("txnId", txnId);
    members.forEach((m, i) => {
      for (const [k, v] of Object.entries(m)) body.append(`m${i}_${k}`, v);
      body.append(`m${i}_photo`, photos[i]!);
    });

    setSubmitting(true);
    setServerError("");
    try {
      const res = await fetch("/api/register", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        if (json.txnError) setTxnError(json.txnError);
        // Problems with member details send the student back to that step.
        if (Array.isArray(json.errors) && hasErrors(json.errors)) {
          setErrors(json.errors);
          setStep("details");
          setTimeout(() => focusFirstError(json.errors));
        }
        throw new Error(json.error || "Something went wrong.");
      }
      setRegId(json.registrationId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (regId) {
    return (
      <div className="form-wrapper">
        <div className="success">
          <div className="check">✓</div>
          <h2>Registration done!</h2>
          <p>
            Registration ID <strong className="reg-id-inline">{regId}</strong>
          </p>
          <p>
            Your payment will be verified by the HUHC team. After that, you can view your ticket in the{" "}
            <strong>View ticket</strong> section using your admission number and name.
          </p>
          <div className="tickets-actions">
            <Link href="/ticket" className="btn btn-primary">View ticket</Link>
            <Link href="/" className="btn btn-outline">Back to home</Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === "payment") {
    const upiLink = `upi://pay?pa=${UPI.id}&pn=${encodeURIComponent(UPI.name)}&am=${team.fee}&cu=INR&tn=${encodeURIComponent(`${EVENT.name} ${team.label}`)}`;
    return (
      <div className="form-wrapper">
        <div className="form-header">
          <button type="button" className="form-back" onClick={() => setStep("details")}>← Back to details</button>
          <h1>Pay ₹{team.fee} to complete registration</h1>
          <p>
            {team.label} registration fee · {team.size === 1 ? "1 member" : `${team.size} members`}
          </p>
        </div>

        <form noValidate onSubmit={handleSubmit}>
          <div className="payment">
            <div className="payment-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={team.payQr} alt={`UPI QR code to pay ₹${team.fee} to ${UPI.name}`} />
              <a className="btn btn-primary payment-app-btn" href={upiLink}>Pay ₹{team.fee} with UPI app</a>
            </div>
            <ol className="payment-steps">
              <li>
                <strong>Scan the QR code</strong> with any UPI app (GPay, PhonePe, Paytm…) and pay exactly{" "}
                <strong>₹{team.fee}</strong>. On a phone, tap <em>Pay with UPI app</em> instead.
              </li>
              <li>
                Or pay to UPI ID <strong className="payment-upi">{UPI.id}</strong> ({UPI.name}).
              </li>
              <li>
                After paying, copy the <strong>UPI transaction ID (UTR)</strong> from your payment app and paste it below.
              </li>
            </ol>
          </div>

          <div className={`field${txnError ? " invalid" : ""}`}>
            <label htmlFor="txn-id">
              UPI transaction ID (UTR) <span className="req">*</span>
            </label>
            <input
              id="txn-id"
              name="txnId"
              value={txnId}
              onChange={(e) => {
                setTxnId(e.target.value);
                setTxnError("");
              }}
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
              placeholder="e.g. 428917365012"
            />
            {txnError && <span className="error-msg">{txnError}</span>}
          </div>

          {serverError && serverError !== txnError && <p className="server-error">{serverError}</p>}

          <div className="form-nav">
            <button type="button" className="btn btn-outline" onClick={() => setStep("details")}>← Back</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit registration"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="form-wrapper">
      <div className="form-header">
        <Link href="/register" className="form-back">← Change team size</Link>
        <h1>
          Register for {EVENT.name} · {team.label}
        </h1>
        <p>
          {EVENT.tagline} · by {ORG_NAME}.{" "}
          {team.size === 1 ? "All fields are required." : `Fill in details for all ${team.size} members. All fields are required.`}
        </p>
      </div>

      <form noValidate onSubmit={goToPayment}>
        {members.map((m, i) => (
          <MemberFields
            key={i}
            index={i}
            title={team.size === 1 ? "Your details" : `Member ${i + 1}${i === 0 ? " · Team lead" : ""}`}
            member={m}
            photo={photos[i]}
            errors={errors[i]}
            onField={(key, value) => setField(i, key, value)}
            onPhoto={(file) => setPhoto(i, file)}
          />
        ))}
        <datalist id="course-options">{COURSES.map((c) => <option key={c} value={c} />)}</datalist>
        <datalist id="branch-options">{BRANCHES.map((b) => <option key={b} value={b} />)}</datalist>

        {serverError && <p className="server-error">{serverError}</p>}

        <div className="form-nav form-nav-end">
          <button type="submit" className="btn btn-primary">
            Continue to payment (₹{team.fee}) →
          </button>
        </div>
      </form>
    </div>
  );
}

function focusFirstError(errors: MemberErrors[]) {
  const i = errors.findIndex((e) => Object.keys(e).some((k) => e[k as keyof MemberErrors]));
  const key = Object.keys(errors[i] ?? {}).find((k) => errors[i][k as keyof MemberErrors]);
  if (key) document.querySelector<HTMLElement>(`[name="m${i}_${key}"]`)?.focus();
}

type MemberFieldsProps = {
  index: number;
  title: string;
  member: Member;
  photo: File | null;
  errors: MemberErrors;
  onField: (key: keyof Member, value: string) => void;
  onPhoto: (file: File | null) => void;
};

function MemberFields({ index, title, member, photo, errors, onField, onPhoto }: MemberFieldsProps) {
  const [preview, setPreview] = useState("");

  // Show a preview of the chosen photo; free the object URL when it changes.
  useEffect(() => {
    if (!photo) return setPreview("");
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const id = (key: string) => `m${index}-${key}`;
  const fieldClass = (key: keyof MemberErrors) => `field${errors[key] ? " invalid" : ""}`;
  const err = (key: keyof MemberErrors) => (errors[key] ? <span className="error-msg">{errors[key]}</span> : null);

  const text = (key: keyof Member, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className={fieldClass(key)}>
      <label htmlFor={id(key)}>
        {label} <span className="req">*</span>
      </label>
      <input id={id(key)} name={`m${index}_${key}`} value={member[key]} onChange={(e) => onField(key, e.target.value)} {...props} />
      {err(key)}
    </div>
  );

  return (
    <fieldset className="member-block">
      <legend>{title}</legend>
      <div className="grid-2">
        <div className="full">{text("name", "Full name", { autoComplete: index === 0 ? "name" : "off" })}</div>
        {text("admissionNo", "Admission number", { autoCapitalize: "characters", placeholder: "e.g. 2024BTCS0123" })}
        {text("phone", "Mobile number", {
          type: "tel",
          inputMode: "numeric",
          maxLength: 10,
          placeholder: "10-digit number",
          autoComplete: index === 0 ? "tel-national" : "off",
          onChange: (e) => onField("phone", e.target.value.replace(/\D/g, "")),
        })}
        {text("course", "Course", { list: "course-options", placeholder: "e.g. B.Tech" })}
        {text("branch", "Branch", { list: "branch-options", placeholder: "e.g. CSE" })}
        <div className="full">
          {text("email", "College email", {
            type: "email",
            autoComplete: index === 0 ? "email" : "off",
            placeholder: COLLEGE_EMAIL_DOMAIN ? `you@${COLLEGE_EMAIL_DOMAIN}` : "you@college.edu",
          })}
        </div>
      </div>

      <div className={fieldClass("photo")}>
        <span className="field-label">
          Photo <span className="req">*</span>
        </span>
        <label className="photo-upload">
          <input type="file" name={`m${index}_photo`} accept={PHOTO_TYPES.join(",")} onChange={(e) => onPhoto(e.target.files?.[0] ?? null)} />
          {preview ? <img src={preview} alt="Selected photo" /> : <span className="photo-placeholder" aria-hidden="true">📷</span>}
          <span className="photo-text">
            <strong>{photo ? photo.name : "Upload photo"}</strong>
            <small>{photo ? "Click to choose a different photo" : "JPG, PNG or WebP · a clear photo of the face"}</small>
          </span>
        </label>
        {err("photo")}
      </div>
    </fieldset>
  );
}
