import type { Frequency, PopupId } from "./types";

const shownKey = (id: PopupId) => `nx_shown_${id}`;

export function canShow(id: PopupId, frequency: Frequency): boolean {
  if (frequency === "always") return true;
  try {
    const raw = localStorage.getItem(shownKey(id));
    if (!raw) return true;
    const last = Number(raw);
    if (Number.isNaN(last)) return true;
    const now = Date.now();
    if (frequency === "once-per-visitor") return false;
    if (frequency === "once-per-session") {
      return sessionStorage.getItem(shownKey(id)) !== "1";
    }
    if (frequency === "once-per-day") return now - last > 24 * 60 * 60 * 1000;
    return true;
  } catch {
    return true;
  }
}

export function markShown(id: PopupId): void {
  try {
    localStorage.setItem(shownKey(id), String(Date.now()));
    sessionStorage.setItem(shownKey(id), "1");
  } catch {
    /* ignore */
  }
}
