"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BRANCHES,
  COLLEGE_EMAIL_DOMAIN,
  COURSES,
  EVENT,
  ORG_NAME,
  PHOTO_TYPES,
  emptyMember,
  getTeamType,
  hasErrors,
  validatePhoto,
  validateTeam,
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

  function clearError(i: number, key: keyof MemberErrors) {
    setErrors((all) => all.map((e, j) => (j === i && e[key] ? { ...e, [key]: undefined } : e)));
  }

  function setField(i: number, key: keyof Member, value: string) {
    setMembers((all) => all.map((m, j) => (j === i ? { ...m, [key]: value } : m)));
    clearError(i, key);
  }

  function setPhoto(i: number, file: File | null) {
    setPhotos((all) => all.map((p, j) => (j === i ? file : p)));
    setErrors((all) => all.map((e, j) => (j === i ? { ...e, photo: file ? validatePhoto(file) : undefined } : e)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found = validateTeam(members);
    photos.forEach((p, i) => {
      const err = validatePhoto(p);
      if (err) found[i].photo = err;
    });
    setErrors(found);
    if (hasErrors(found)) return focusFirstError(found);

    const body = new FormData();
    body.append("teamType", team.id);
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
        if (Array.isArray(json.errors)) {
          setErrors(json.errors);
          focusFirstError(json.errors);
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
          <h2>Registration successful!</h2>
          <p>
            {team.size === 1 ? `Thank you, ${members[0].name.split(" ")[0]}!` : "Your team is registered!"} See you at{" "}
            {EVENT.name}: {EVENT.tagline}.
          </p>
          <p>Your registration ID is:</p>
          <div className="reg-id">{regId}</div>
          {team.size > 1 && <p>Registered members: {members.map((m) => m.name).join(", ")}</p>}
          <p>
            {EVENT.date} · {EVENT.venue}
          </p>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 24 }}>
            Back to home
          </Link>
        </div>
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

      <form noValidate onSubmit={handleSubmit}>
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
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Submitting..." : team.size === 1 ? "Submit registration" : "Register team"}
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
            <small>{photo ? "Click to choose a different photo" : "JPG, PNG or WebP · up to 2 MB · a clear photo of the face"}</small>
          </span>
        </label>
        {err("photo")}
      </div>
    </fieldset>
  );
}
