const VISITOR_KEY = "nx_vid";
const SESSION_KEY = "nx_sid";
const FIRST_VISIT_KEY = "nx_first_seen";

function rid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getVisitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = rid();
      localStorage.setItem(VISITOR_KEY, v);
      localStorage.setItem(FIRST_VISIT_KEY, String(Date.now()));
    }
    return v;
  } catch {
    return rid();
  }
}

export function getSessionId(): string {
  try {
    let s = sessionStorage.getItem(SESSION_KEY);
    if (!s) {
      s = rid();
      sessionStorage.setItem(SESSION_KEY, s);
    }
    return s;
  } catch {
    return rid();
  }
}

export function isFirstVisit(): boolean {
  try {
    const seen = localStorage.getItem(FIRST_VISIT_KEY);
    if (!seen) return true;
    return Date.now() - Number(seen) < 60_000;
  } catch {
    return false;
  }
}

export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches || /Mobi|Android/i.test(navigator.userAgent);
}
