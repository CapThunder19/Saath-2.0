// Keeps a half-filled registration on the student's device, so leaving the page
// (to pay in a UPI app, pressing Back, the phone reloading the tab) doesn't wipe it.
// Cleared after a successful registration; drafts older than a day are ignored.

import type { Member } from "@/lib/registration";

export type Draft = {
  members: Member[];
  photos: (string | null)[]; // data URLs of the (already shrunk) photos
  step: "details" | "payment";
  txnId: string;
  submissionKey: string;
  savedAt: number;
};

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function loadDraft(key: string, teamSize: number): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(key) ?? "null") as Draft | null;
    if (!d || Date.now() - d.savedAt > MAX_AGE_MS || d.members?.length !== teamSize) return null;
    return d;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, draft: Omit<Draft, "savedAt">) {
  const value = { ...draft, savedAt: Date.now() };
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: keep at least the typed details, without photos.
    try {
      localStorage.setItem(key, JSON.stringify({ ...value, photos: value.photos.map(() => null) }));
    } catch {
      // storage unavailable (e.g. private mode); nothing more we can do
    }
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// Each photo is encoded once, not on every keystroke.
const encoded = new WeakMap<File, Promise<string>>();
export function fileToDataUrl(file: File): Promise<string> {
  let p = encoded.get(file);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    encoded.set(file, p);
  }
  return p;
}

export async function dataUrlToFile(dataUrl: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], name, { type: blob.type || "image/jpeg" });
  encoded.set(file, Promise.resolve(dataUrl));
  return file;
}
