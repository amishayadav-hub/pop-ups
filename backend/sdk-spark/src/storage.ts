import type { PopupId } from "./types";

const shownKey = (id: PopupId) => `nx_shown_${id}`;

export function markShown(id: PopupId): void {
  try {
    localStorage.setItem(shownKey(id), String(Date.now()));
    sessionStorage.setItem(shownKey(id), "1");
  } catch {
    /* ignore */
  }
}
