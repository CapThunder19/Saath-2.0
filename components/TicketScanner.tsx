"use client";

import jsQR from "jsqr";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Member = {
  registrationId: string;
  memberNo: number;
  teamSize: number;
  teamType: string;
  name: string;
  admissionNo: string;
  branch: string;
  course: string;
};
type Result =
  | { status: "OK" | "ALREADY_IN"; member: Member; enteredAt: string; photo?: string }
  | { status: "NOT_APPROVED"; member: Member; photo?: string }
  | { status: "NOT_FOUND" | "FORGED" | "INVALID" }
  | { status: "ERROR"; error: string };
type Entry = { enteredAt: string; registrationId: string; memberNo: number; name: string; admissionNo: string; branch: string };

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });

const HEADLINE: Record<Result["status"], { text: string; tone: "ok" | "warn" | "bad" }> = {
  OK: { text: "✓ Entry allowed", tone: "ok" },
  ALREADY_IN: { text: "⚠ Already entered", tone: "warn" },
  NOT_APPROVED: { text: "✗ Not approved: payment not verified", tone: "bad" },
  NOT_FOUND: { text: "✗ Not registered", tone: "bad" },
  FORGED: { text: "✗ Fake or edited ticket", tone: "bad" },
  INVALID: { text: "✗ Not a Saath ticket QR", tone: "bad" },
  ERROR: { text: "Connection problem: scan again", tone: "warn" },
};

export default function TicketScanner({ isAdmin }: { isAdmin: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [camera, setCamera] = useState<"off" | "starting" | "on" | "error">("off");
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [checking, setChecking] = useState(false);
  const [manual, setManual] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [expected, setExpected] = useState(0);

  const loadEntries = useCallback(async () => {
    const res = await fetch("/api/scan/entries", { cache: "no-store" }).catch(() => null);
    if (res?.status === 401) return window.location.replace("/ticket");
    const json = await res?.json().catch(() => null);
    if (json?.entries) {
      setEntries(json.entries);
      setExpected(json.expected ?? 0);
    }
  }, []);

  useEffect(() => {
    loadEntries();
    const id = setInterval(loadEntries, 10000); // other gates' entries show up too
    return () => clearInterval(id);
  }, [loadEntries]);

  const feedback = (tone: "ok" | "warn" | "bad") => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.frequency.value = tone === "ok" ? 880 : tone === "warn" ? 520 : 200;
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (tone === "ok" ? 0.15 : 0.45));
    } catch {
      // no audio available
    }
    navigator.vibrate?.(tone === "ok" ? 80 : [200, 100, 200]);
  };

  const submit = useCallback(
    async (payload: { qr: string } | { admissionNo: string }) => {
      busyRef.current = true;
      setChecking(true);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      let r: Result;
      try {
        const res = await fetch("/api/scan/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.status === 401) return window.location.replace("/ticket");
        r = await res.json();
      } catch {
        r = { status: "ERROR", error: "Connection problem. Scan again." };
      }
      setResult(r);
      setChecking(false);
      feedback(HEADLINE[r.status].tone);
      if (r.status === "OK") loadEntries();
      // Keep the result on screen for a moment, then look for the next ticket.
      resumeTimer.current = setTimeout(() => (busyRef.current = false), r.status === "OK" ? 2500 : 4000);
    },
    [loadEntries],
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera("off");
  }, []);

  async function startCamera() {
    setCamera("starting");
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      // Keep refocusing as tickets move closer/further (supported on most Android phones).
      stream
        .getVideoTracks()[0]
        ?.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] })
        .catch(() => {});
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setCamera("on");
    } catch (err) {
      setCamera("error");
      setCameraError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access for this site in your browser settings, then try again."
          : "Couldn't open the camera. Use the manual check-in below, or try another browser.",
      );
    }
  }

  // Scan loop. Uses the phone's built-in QR reader when there is one (Chrome on Android:
  // fast and good with screens); otherwise jsQR on a small crop of the frame's centre,
  // alternating with the whole frame, so each attempt is quick.
  useEffect(() => {
    if (camera !== "on") return;
    let stopped = false;
    type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
    type DetectorClass = { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> };
    const Native = (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
    let detector: Detector | null = null;
    let attempt = 0;

    const decodeWithJsQR = (video: HTMLVideoElement) => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const full = attempt++ % 3 === 2; // every third try, look at the whole frame
      const side = full ? Math.max(vw, vh) : Math.min(vw, vh) * 0.8;
      const sx = full ? 0 : (vw - side) / 2;
      const sy = full ? 0 : (vh - side) / 2;
      const sw = full ? vw : side;
      const sh = full ? vh : side;
      const scale = Math.min(1, (full ? 640 : 480) / Math.max(sw, sh));
      const w = Math.round(sw * scale);
      const h = Math.round(sh * scale);
      const canvas = (canvasRef.current ??= document.createElement("canvas"));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
      return jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" })?.data;
    };

    (async () => {
      if (Native) {
        try {
          if ((await Native.getSupportedFormats()).includes("qr_code")) detector = new Native({ formats: ["qr_code"] });
        } catch {
          detector = null;
        }
      }
      while (!stopped) {
        const video = videoRef.current;
        if (video && !busyRef.current && video.readyState >= 2 && video.videoWidth) {
          let text: string | undefined;
          try {
            text = detector ? (await detector.detect(video))[0]?.rawValue : decodeWithJsQR(video);
          } catch {
            detector = null; // native reader failed on this device: use jsQR from now on
          }
          const now = Date.now();
          // The same ticket held in front of the camera shouldn't be checked again and again.
          if (text && !(text === lastRef.current.text && now - lastRef.current.at < 6000)) {
            lastRef.current = { text, at: now };
            submit({ qr: text });
          }
        }
        await new Promise((r) => setTimeout(r, detector ? 50 : 80));
      }
    })();
    return () => {
      stopped = true;
    };
  }, [camera, submit]);

  useEffect(() => stopCamera, [stopCamera]);

  const head = result ? HEADLINE[result.status] : null;
  const member = result && "member" in result ? result.member : null;

  return (
    <div className="scanner">
      <div className="scanner-head">
        <div>
          <span className="eyebrow">Saath 2.0 · Entry gate</span>
          <h1>Ticket scanner</h1>
          <p>
            <strong className="scanner-count">{entries.length}</strong> entered
            {expected > 0 && <> of {expected} approved members</>}
          </p>
        </div>
        <div className="admin-head-actions">
          <a className="btn btn-primary" href="/api/scan/entries/export">Download entry Excel</a>
          {isAdmin ? (
            <Link className="btn btn-outline" href="/admin">Dashboard</Link>
          ) : (
            <button
              className="btn btn-outline"
              onClick={async () => {
                await fetch("/api/scan/logout", { method: "POST" });
                window.location.replace("/ticket");
              }}
            >
              Sign out
            </button>
          )}
        </div>
      </div>

      <div className="scanner-grid">
        <div className="scanner-camera">
          <div className={`scanner-video${camera === "on" ? " is-on" : ""}`}>
            <video ref={videoRef} muted playsInline />
            {camera === "on" && <div className="scanner-frame" aria-hidden="true" />}
            {camera !== "on" && (
              <div className="scanner-placeholder">
                <button className="btn btn-primary" onClick={startCamera} disabled={camera === "starting"}>
                  {camera === "starting" ? "Opening camera…" : "Start camera"}
                </button>
                {cameraError && <p className="server-error">{cameraError}</p>}
              </div>
            )}
          </div>
          {camera === "on" && (
            <button className="btn btn-outline scanner-stop" onClick={stopCamera}>Stop camera</button>
          )}

          <form
            className="scanner-manual"
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) submit({ admissionNo: manual.trim() });
            }}
          >
            <label htmlFor="manual-adm">No QR? Check in by admission number</label>
            <div>
              <input id="manual-adm" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="e.g. 2024B0101160" autoCapitalize="characters" />
              <button className="btn btn-outline" type="submit" disabled={checking}>Check in</button>
            </div>
          </form>
        </div>

        <div className={`scanner-result${head ? ` is-${head.tone}` : ""}`} aria-live="assertive">
          {checking && <p className="scanner-wait">Checking…</p>}
          {!checking && !result && <p className="scanner-wait">Point the camera at a ticket&apos;s QR code.</p>}
          {!checking && result && head && (
            <>
              <h2>{head.text}</h2>
              {result.status === "ALREADY_IN" && <p className="scanner-when">Entered at {time(result.enteredAt)}. Don&apos;t allow a second entry.</p>}
              {result.status === "OK" && <p className="scanner-when">Checked in at {time(result.enteredAt)}</p>}
              {result.status === "FORGED" && <p className="scanner-when">This QR code&apos;s security code doesn&apos;t match. Ask for the ticket in View ticket.</p>}
              {result.status === "NOT_FOUND" && <p className="scanner-when">No registration matches this ticket.</p>}
              {result.status === "INVALID" && <p className="scanner-when">This isn&apos;t a Saath 2.0 ticket QR code.</p>}
              {result.status === "ERROR" && <p className="scanner-when">{result.error}</p>}
              {member && (
                <div className="scanner-member">
                  {"photo" in result && result.photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.photo} alt={`Photo of ${member.name}`} />
                  )}
                  <dl>
                    <dt>Name</dt><dd>{member.name}</dd>
                    <dt>Admission</dt><dd>{member.admissionNo}</dd>
                    <dt>Ticket</dt><dd>{member.registrationId}{member.teamSize > 1 && ` · member ${member.memberNo} of ${member.teamSize}`}</dd>
                    <dt>Course</dt><dd>{member.course} · {member.branch}</dd>
                  </dl>
                </div>
              )}
              {member && result.status !== "NOT_APPROVED" && <p className="scanner-tip">Check the photo matches the person.</p>}
              <button
                className="btn btn-outline"
                onClick={() => {
                  if (resumeTimer.current) clearTimeout(resumeTimer.current);
                  busyRef.current = false;
                  lastRef.current = { text: "", at: 0 };
                  setResult(null);
                }}
              >
                Scan next
              </button>
            </>
          )}
        </div>
      </div>

      <div className="scanner-recent">
        <h3>Recent entries</h3>
        {entries.length === 0 ? (
          <p className="admin-empty">No one has entered yet.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Time</th><th>Name</th><th>Admission no.</th><th>Registration ID</th><th>Branch</th></tr>
            </thead>
            <tbody>
              {entries.slice(0, 15).map((e) => (
                <tr key={`${e.registrationId}-${e.memberNo}`}>
                  <td>{time(e.enteredAt)}</td><td>{e.name}</td><td>{e.admissionNo}</td><td>{e.registrationId}-{e.memberNo}</td><td>{e.branch}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
